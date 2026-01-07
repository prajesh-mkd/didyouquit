
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
    try {
        // 1. Verify Auth Token
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const token = authHeader.split("Bearer ")[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        console.log(`[API] Starting secure account deletion for user: ${userId}`);

        // 2. Cascade Delete Logic (Backend Ver.)

        // A. Delete Resolutions
        const resRef = adminDb.collection("resolutions");
        const resSnap = await resRef.where("uid", "==", userId).get(); // Use 'uid' consistent with other backend logic
        // Note: Check 'userId' field too if schema is mixed?
        // User previously saw inconsistent IDs. Let's cover bases.
        const resSnap2 = await resRef.where("userId", "==", userId).get();

        const resDocs = new Map();
        resSnap.docs.forEach(d => resDocs.set(d.id, d));
        resSnap2.docs.forEach(d => resDocs.set(d.id, d));

        console.log(`[API] Found ${resDocs.size} resolutions.`);

        for (const doc of resDocs.values()) {
            // Delete Journal Entries for this resolution
            const journalsRef = adminDb.collection("journal_entries");
            const journalsSnap = await journalsRef.where("resolutionId", "==", doc.id).get();

            const batch = adminDb.batch();
            let opCount = 0;

            for (const jDoc of journalsSnap.docs) {
                // Delete comments (subcollection)
                const commentsRef = jDoc.ref.collection("comments");
                const commentsSnap = await commentsRef.get(); // Admin SDK listCollections() better? 
                // Admin SDK can delete collections recursively using invalid client SDK method?
                // Actually `firestore.recursiveDelete(ref)` is available in Admin SDK!
                // Let's use THAT for maximum power and simplicity.

                // NO wait, recursiveDelete is a utility function in `firebase-admin/firestore`?
                // Yes: `await adminDb.recursiveDelete(doc.ref)`
                // But let's verify if available in this version.
                // Safest to stick to manual or batch if I'm not sure, but recursiveDelete is standard in modern Admin SDK.
                // Let's try manual batching for safety and control, or just use delete() on doc if subcollections are small.
                // Actually, standard Delete DOES NOT delete subcollections.

                commentsSnap.forEach(c => {
                    batch.delete(c.ref);
                    opCount++;
                });
                batch.delete(jDoc.ref);
                opCount++;
            }
            // Logic above fits in memory?
            if (opCount > 0) {
                await batch.commit();
            }
            await doc.ref.delete(); // Delete resolution
        }

        // B. Delete Notifications
        const notifRef = adminDb.collection("notifications");
        const recSnap = await notifRef.where("recipientUid", "==", userId).get();
        const sentSnap = await notifRef.where("senderUid", "==", userId).get();

        const notifBatch = adminDb.batch();
        recSnap.forEach(d => notifBatch.delete(d.ref));
        sentSnap.forEach(d => notifBatch.delete(d.ref));
        await notifBatch.commit();
        console.log(`[API] Deleted notifications.`);

        // C. Delete Forum Topics (and their subcollections)
        const topicsRef = adminDb.collection("forum_topics");
        const topicsSnap = await topicsRef.where("author.uid", "==", userId).get();

        for (const tDoc of topicsSnap.docs) {
            const commentsRef = tDoc.ref.collection("comments");
            const commentsSnap = await commentsRef.get();
            const tBatch = adminDb.batch();
            commentsSnap.forEach(c => tBatch.delete(c.ref));
            tBatch.delete(tDoc.ref);
            await tBatch.commit();
        }
        console.log(`[API] Deleted ${topicsSnap.size} forum topics.`);

        // D. Delete Social Connections
        const followersRef = adminDb.collection("users").doc(userId).collection("followers");
        const followersSnap = await followersRef.get();
        const fBatch = adminDb.batch();

        followersSnap.forEach(d => {
            // Remove ME from THEIR following list
            const theirFollowingRef = adminDb.collection("users").doc(d.id).collection("following").doc(userId);
            fBatch.delete(theirFollowingRef);
            // Delete the follower record on MY profile
            fBatch.delete(d.ref);
        });

        const followingRef = adminDb.collection("users").doc(userId).collection("following");
        const followingSnap = await followingRef.get();

        followingSnap.forEach(d => {
            // Remove ME from THEIR followers list
            const theirFollowerRef = adminDb.collection("users").doc(d.id).collection("followers").doc(userId);

            fBatch.delete(theirFollowerRef);
            // Delete the following record on MY profile
            fBatch.delete(d.ref);
        });

        await fBatch.commit();
        console.log(`[API] Cleaned up social connections.`);

        // E. Delete Ghost Comments (Replies on others' threads)
        // using Collection Group to find subcollection documents
        // WRAPPED in try/catch to ensure account deletion proceeds even if this cleanup fails (e.g. index issues)
        try {
            const ghostCommentsQ = await adminDb.collectionGroup("comments").where("author.uid", "==", userId).get();
            // Fallback for simulation data
            const ghostCommentsQ2 = await adminDb.collectionGroup("comments").where("authorUid", "==", userId).get();

            const allGhostComments = new Map();
            ghostCommentsQ.forEach(d => allGhostComments.set(d.id, d));
            ghostCommentsQ2.forEach(d => allGhostComments.set(d.id, d));

            if (allGhostComments.size > 0) {
                const batch = adminDb.batch();
                const topicDecrements: Record<string, number> = {};
                const journalDecrements: Record<string, number> = {};

                for (const doc of allGhostComments.values()) {
                    const parentDoc = doc.ref.parent.parent;
                    if (parentDoc) {
                        const parentColName = parentDoc.parent.id;
                        if (parentColName === 'forum_topics') {
                            topicDecrements[parentDoc.id] = (topicDecrements[parentDoc.id] || 0) + 1;
                        } else if (parentColName === 'journal_entries') {
                            journalDecrements[parentDoc.id] = (journalDecrements[parentDoc.id] || 0) + 1;
                        }
                    }
                    batch.delete(doc.ref);
                }

                // To be safe against batch failure, let's run decrements independently.
                const decrementPromises = [];
                for (const [id, count] of Object.entries(topicDecrements)) {
                    decrementPromises.push(
                        adminDb.collection('forum_topics').doc(id).update({ commentCount: FieldValue.increment(-count) }).catch(() => { })
                    );
                }
                for (const [id, count] of Object.entries(journalDecrements)) {
                    decrementPromises.push(
                        adminDb.collection('journal_entries').doc(id).update({ commentCount: FieldValue.increment(-count) }).catch(() => { })
                    );
                }

                await batch.commit(); // Delete comments
                await Promise.all(decrementPromises); // Update counts (best effort)
                console.log(`[API] Deleted ${allGhostComments.size} ghost comments.`);
            }
        } catch (error) {
            console.error("[API] Ghost comment cleanup failed (non-fatal):", error);
            // Non-blocking: Proceed to delete user account
        }

        // E. Delete User Profile
        await adminDb.collection("users").doc(userId).delete();

        // F. Delete Auth User
        await adminAuth.deleteUser(userId);

        console.log(`[API] Account deletion complete.`);
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("[API] Deletion failed:", error);
        return NextResponse.json({ error: error.message || "Deletion failed" }, { status: 500 });
    }
}
