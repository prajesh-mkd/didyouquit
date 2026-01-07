import type { Metadata } from 'next';
import { adminDb } from '@/lib/firebase-admin';

type Props = {
    params: Promise<{ username: string }>;
};

export async function generateMetadata(
    { params }: Props,
): Promise<Metadata> {
    const { username } = await params;

    // Defaults
    let title = `${username} | DidYouQuit?`;
    let description = `Check out ${username}'s resolutions on DidYouQuit. Public accountability tracker for 2026.`;

    try {
        // Attempt to fetch user to get display name or verify existence (Optional but good for SEO)
        // Query by 'username' field, not doc ID (doc ID is UID)
        const usersRef = adminDb.collection('users');
        const snapshot = await usersRef.where('username', '==', username).limit(1).get();

        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            title = `${userData.username}'s Resolutions | DidYouQuit?`;
            description = `See what ${userData.username} is committing to in 2026. Join them on DidYouQuit.`;
        } else {
            title = "User Not Found | DidYouQuit?";
            description = "This user profile could not be found.";
        }
    } catch (error) {
        console.error(`[SEO] Failed to fetch metadata for user: ${username}`, error);
    }

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'profile',
        },
    };
}

export default function UserLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
