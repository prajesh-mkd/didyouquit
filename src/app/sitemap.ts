import { MetadataRoute } from 'next';
import { adminDb } from '@/lib/firebase-admin';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://didyouquit.com';

    // 1. Static Routes
    const staticRoutes = [
        '',
        '/subscription',
        '/forums',
        '/privacy',
        '/terms',
        '/public-resolutions',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: route === '' ? 1 : 0.8,
    }));

    // 2. Fetch Users (for Public Profiles)
    // Only fetch users who have a username (public profiles)
    let userUrls: MetadataRoute.Sitemap = [];
    try {
        const usersSnapshot = await adminDb.collection('users').select('username', 'lastActive').get();

        userUrls = usersSnapshot.docs
            .map((doc) => {
                const data = doc.data();
                if (!data.username) return null;
                return {
                    url: `${baseUrl}/${data.username}`,
                    lastModified: data.lastActive ? new Date(data.lastActive) : new Date(),
                    changeFrequency: 'weekly' as const,
                    priority: 0.6,
                };
            })
            .filter((url): url is NonNullable<typeof url> => url !== null);
    } catch (error) {
        console.error('Sitemap: Failed to fetch users', error);
    }

    // 3. Fetch Forum Topics
    let forumUrls: MetadataRoute.Sitemap = [];
    try {
        const topicsSnapshot = await adminDb.collection('forum_topics').select('updatedAt').get();

        forumUrls = topicsSnapshot.docs.map((doc) => {
            const data = doc.data();
            const lastMod = data.updatedAt ? data.updatedAt.toDate() : new Date();
            return {
                url: `${baseUrl}/forums/${doc.id}`,
                lastModified: lastMod,
                changeFrequency: 'daily' as const,
                priority: 0.7,
            };
        });
    } catch (error) {
        console.error('Sitemap: Failed to fetch forum topics', error);
    }

    return [...staticRoutes, ...userUrls, ...forumUrls];
}
