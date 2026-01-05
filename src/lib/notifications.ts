
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, getDocs } from "firebase/firestore";

export type NotificationType = 'reply' | 'new_journal' | 'new_resolution' | 'follow';

interface BaseNotificationParams {
    senderUid: string;
    senderUsername: string;
    senderPhotoURL?: string | null;
    refId: string; // ID of the post, journal, or user (for follow)
    refText?: string; // Snippet of content or context
}

/**
 * Creates a single notification for a specific user.
 */
export async function createNotification(recipientUid: string, type: NotificationType, params: BaseNotificationParams) {
    if (recipientUid === params.senderUid) return; // Prevent self-notification

    try {
        await addDoc(collection(db, "notifications"), {
            recipientUid,
            senderUid: params.senderUid,
            senderUsername: params.senderUsername || "Anonymous",
            senderPhotoURL: params.senderPhotoURL || null,
            type,
            refId: params.refId,
            refText: params.refText ? params.refText.slice(0, 60) + (params.refText.length > 60 ? "..." : "") : "",
            createdAt: serverTimestamp(),
            read: false
        });
    } catch (error) {
        console.error("Error creating notification", error);
    }
}

/**
 * Notifies all followers of a specific user.
 * Used for new journals, resolutions, etc.
 */
export async function notifyFollowers(uid: string, type: NotificationType, params: BaseNotificationParams) {
    try {
        const followersSnap = await getDocs(collection(db, "users", uid, "followers"));

        // Execute in parallel
        const promises = followersSnap.docs.map(doc =>
            createNotification(doc.id, type, params)
        );

        await Promise.all(promises);
    } catch (error) {
        console.error("Error notifying followers", error);
    }
}
