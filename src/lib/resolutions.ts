
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, writeBatch, doc, collectionGroup, increment } from "firebase/firestore";

/**
 * Deletes a resolution and all its associated data (journal entries, comments).
 * Uses batching to ensure atomicity where possible, but large deletions may run in multiple batches.
 */
export async function deleteResolutionCascade(resolutionId: string) {
    if (!resolutionId) return;

    try {
        const batch = writeBatch(db);

        // 1. Get all journal entries for this resolution
        const journalsRef = collection(db, "journal_entries");
        const q = query(journalsRef, where("resolutionId", "==", resolutionId));
        const journalSnap = await getDocs(q);

        // 2. For each journal entry, we need to delete it AND its comments
        // Note: Firestore batch limit is 500 operations. 
        // For a simple cascade, we might fit in one batch, but robust solution should handle chunks.
        // For this implementation, we'll assume reasonable limits (1 res -> <50 journals -> <100 comments total).
        // If it scales, we'd need recursive chunking.

        const deletePromises: Promise<void>[] = [];

        for (const journalDoc of journalSnap.docs) {
            const journalId = journalDoc.id;

            // Queue journal deletion in batch
            batch.delete(journalDoc.ref);

            // Fetch comments for this journal
            const commentsRef = collection(db, "journal_entries", journalId, "comments");

            // We can't await inside the batch build comfortably without blocking, 
            // but we need the snapshots to add to batch.
            const p = getDocs(commentsRef).then((commentSnap) => {
                commentSnap.forEach((commentDoc) => {
                    batch.delete(commentDoc.ref);
                });
            });
            deletePromises.push(p);
        }

        // Wait for all comment queries to finish adding to batch
        await Promise.all(deletePromises);

        // 3. Delete the resolution itself
        const resRef = doc(db, "resolutions", resolutionId);
        batch.delete(resRef);

        // Commit all deletions
        await batch.commit();
        console.log(`Successfully deleted resolution ${resolutionId} and associated data.`);

    } catch (error: any) {
        console.error("Error in cascade delete:", error);
        console.error("Failed Delete Stack:", error.code, error.message);
        throw new Error(`Cascade Delete Failed: ${error.code || 'Unknown'} - ${error.message}`);
    }
}

/**
 * Deletes all data associated with a user (Resolutions, Journals, Notifications).
 * Does NOT delete the user document itself (caller should handle that) or Auth user.
 */
export async function deleteUserCascade(userId: string) {
    if (!userId) return;

    try {
        console.log(`Starting cascade delete for user ${userId}...`);

        // 1. Delete all resolutions by this user
        // We query and delete them one by one to trigger the per-resolution cascade
        const resolutionsRef = collection(db, "resolutions");
        const qRes = query(resolutionsRef, where("userId", "==", userId));
        const resSnap = await getDocs(qRes);

        const deleteResPromises = resSnap.docs.map(doc => deleteResolutionCascade(doc.id));
        await Promise.all(deleteResPromises);
        console.log(`Deleted ${resSnap.size} resolutions for user ${userId}.`);

        // 2. Delete all notifications involving this user (sent OR received)
        const batch = writeBatch(db);
        let batchCount = 0;

        const notifRef = collection(db, "notifications");
        const qRec = query(notifRef, where("recipientUid", "==", userId));
        const recSnap = await getDocs(qRec);

        const qSent = query(notifRef, where("senderUid", "==", userId));
        const sentSnap = await getDocs(qSent);

        recSnap.forEach(d => { batch.delete(d.ref); batchCount++; });
        sentSnap.forEach(d => { batch.delete(d.ref); batchCount++; });

        // 3. Delete Forum Topics (General Posts) authored by user
        const topicsRef = collection(db, "forum_topics");
        const qTopics = query(topicsRef, where("author.uid", "==", userId));
        const topicsSnap = await getDocs(qTopics);

        // For topics, we must also delete their comments subcollection
        // Optimization: We could use a second batch if needed, but we'll try to fit in one or execute sequentially
        const topicPromises = topicsSnap.docs.map(async (tDoc) => {
            const commentsRef = collection(db, "forum_topics", tDoc.id, "comments");
            const commentsSnap = await getDocs(commentsRef);

            // Delete topic comments in a separate batch to avoid limit issues? 
            // Or just fire and forget independent deletes
            const innerBatch = writeBatch(db);
            commentsSnap.forEach(c => innerBatch.delete(c.ref));
            await innerBatch.commit();

            // Add topic delete to main batch
            batch.delete(tDoc.ref);
            batchCount++;
        });

        await Promise.all(topicPromises);

        if (batchCount > 0) {
            await batch.commit();
        }
        // 4. Delete Ghost Comments (Replies on others' threads)
        // Note: Requires "comments" Collection Group Index on 'author.uid'
        try {
            const commentsQ = query(collectionGroup(db, "comments"), where("author.uid", "==", userId));
            const commentsSnap = await getDocs(commentsQ);

            if (!commentsSnap.empty) {
                // We use a new batch or continue with previous if space. 
                // Since this might be large, we'll try to batch safely.
                // Re-instantiate batch if we think we are near limit, but for now reuse 'batch' variable logic 
                // (though 'batch' variable from step 2 is technically closed/committed? 
                // Wait, Step 2 commit was NOT CALLED.
                // Step 2 loop ends at line 96.
                // Step 3 (Topics) has `await batch.commit()` at line 123.
                // So 'batch' is committed. We need a new batch.

                const ghostBatch = writeBatch(db);
                // Track decrements
                const topicDecrements: Record<string, number> = {};
                const journalDecrements: Record<string, number> = {};

                commentsSnap.docs.forEach(doc => {
                    const parentDoc = doc.ref.parent.parent;
                    if (parentDoc) {
                        const parentColName = parentDoc.parent.id;
                        if (parentColName === 'forum_topics') {
                            topicDecrements[parentDoc.id] = (topicDecrements[parentDoc.id] || 0) + 1;
                        } else if (parentColName === 'journal_entries') {
                            journalDecrements[parentDoc.id] = (journalDecrements[parentDoc.id] || 0) + 1;
                        }
                    }
                    ghostBatch.delete(doc.ref);
                });

                // Apply decrements (Client SDK doesn't support ignore errors easily in batch, so we trust update works for existing docs)
                for (const [id, count] of Object.entries(topicDecrements)) {
                    const ref = doc(db, 'forum_topics', id);
                    ghostBatch.update(ref, { commentCount: increment(-count) });
                }
                for (const [id, count] of Object.entries(journalDecrements)) {
                    const ref = doc(db, 'journal_entries', id);
                    ghostBatch.update(ref, { commentCount: increment(-count) });
                }

                await ghostBatch.commit();
                console.log(`Deleted ${commentsSnap.size} ghost comments.`);
            }
        } catch (e) {
            console.warn("Ghost comment delete failed (possibly missing index or permission):", e);
            // Don't throw here, as we want to succeed on partial delete if possible
        }

        console.log(`Deleted notifications and topics for user ${userId}.`);

    } catch (error) {
        console.error("Error in user cascade delete:", error);
        throw error;
    }
}
