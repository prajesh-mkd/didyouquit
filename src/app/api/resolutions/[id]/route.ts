import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function DELETE(
    req: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        const resolutionId = params.id;
        if (!resolutionId) {
            return NextResponse.json({ error: "Missing Resolution ID" }, { status: 400 });
        }

        // 1. Verify Auth Token
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const token = authHeader.split("Bearer ")[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        console.log(`[API] Deleting resolution ${resolutionId} by user ${userId}`);

        // 2. Verify Ownership
        const resRef = adminDb.collection("resolutions").doc(resolutionId);
        const resSnap = await resRef.get();

        if (!resSnap.exists) {
            return NextResponse.json({ error: "Resolution not found" }, { status: 404 });
        }

        const resData = resSnap.data();
        if (resData?.uid !== userId) {
            return NextResponse.json({ error: "Forbidden: You do not own this resolution" }, { status: 403 });
        }

        // 3. Cascade Delete (Journals & Comments)
        const batch = adminDb.batch();
        let opCount = 0;

        // Fetch Journals linked to this resolution
        const journalsRef = adminDb.collection("journal_entries");
        const journalsSnap = await journalsRef.where("resolutionId", "==", resolutionId).get();

        for (const jDoc of journalsSnap.docs) {
            // Delete comments subcollection (Best effort batching)
            const commentsRef = jDoc.ref.collection("comments");
            const commentsSnap = await commentsRef.get();

            commentsSnap.forEach(c => {
                batch.delete(c.ref);
                opCount++;
            });

            // Delete Journal Entry
            batch.delete(jDoc.ref);
            opCount++;
        }

        // Delete Resolution
        batch.delete(resRef);
        opCount++;

        // Commit (Admin SDK batch limit is 500, unlikely to hit here for single resolution, but good to know)
        await batch.commit();

        console.log(`[API] Successfully deleted resolution ${resolutionId}`);
        return NextResponse.json({ success: true, count: opCount });

    } catch (error: any) {
        console.error("[API] Resolution delete failed:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
