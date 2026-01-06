
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, writeBatch, doc, deleteDoc } from "firebase/firestore";

/**
 * Deletes a Forum Topic and all its comments.
 */
export async function deleteTopicCascade(topicId: string) {
    if (!topicId) return;

    try {
        const batch = writeBatch(db);

        // 1. Get all comments
        const commentsRef = collection(db, "forum_topics", topicId, "comments");
        const commentsSnap = await getDocs(commentsRef);

        commentsSnap.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // 2. Delete Topic
        const topicRef = doc(db, "forum_topics", topicId);
        batch.delete(topicRef);

        await batch.commit();
        console.log(`Deleted topic ${topicId} and ${commentsSnap.size} comments.`);
    } catch (error) {
        console.error("Error deleting topic:", error);
        throw error;
    }
}

/**
 * Recursively deletes a comment and all its replies.
 * Works for both Forum Topics and Journal Entries since they share the same structure.
 * 
 * @param parentDocPath Path to the parent document (e.g., "forum_topics/123" or "journal_entries/456")
 * @param commentId The ID of the comment to delete
 */
export async function deleteCommentCascade(parentDocPath: string, commentId: string) {
    if (!parentDocPath || !commentId) return;

    try {
        const commentsRef = collection(db, `${parentDocPath}/comments`);

        // 1. Find all descendants (bfs/dfs)
        // Since we can't easily query "all descendants" in one go without a recursive field,
        // we will do a targeted traversal. 
        // Note: usage of this function assumes the tree isn't massive.

        const toDeleteIds = new Set<string>();
        toDeleteIds.add(commentId);

        const queue = [commentId];

        while (queue.length > 0) {
            const currentId = queue.shift();
            // Find direct children
            const q = query(commentsRef, where("parentId", "==", currentId));
            const snap = await getDocs(q);

            snap.forEach(doc => {
                toDeleteIds.add(doc.id);
                queue.push(doc.id);
            });
        }

        // 2. Batch delete
        const batch = writeBatch(db);
        toDeleteIds.forEach(id => {
            batch.delete(doc(commentsRef, id));
        });

        await batch.commit();
        console.log(`Deleted comment ${commentId} and ${toDeleteIds.size - 1} replies.`);

        return toDeleteIds.size; // Return count to update UI
    } catch (error) {
        console.error("Error deleting comment:", error);
        throw error;
    }
}
