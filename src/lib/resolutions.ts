
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, writeBatch, doc } from "firebase/firestore";

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

    } catch (error) {
        console.error("Error in cascade delete:", error);
        throw error; // Re-throw to let UI handle error display
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
        console.log(`Deleted notifications and topics for user ${userId}.`);

    } catch (error) {
        console.error("Error in user cascade delete:", error);
        throw error;
    }
}
