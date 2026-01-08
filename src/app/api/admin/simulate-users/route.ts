
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { IMAGINATIVE_USERNAMES } from '@/lib/constants/usernames';
import { generateAvatar } from '@/lib/generateAvatar';

import { COUNTRIES } from '@/lib/constants/countries';

export async function POST(req: Request) {
    try {
        // 1. Verify Super Admin
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        // Check if email matches strict super admin list
        const SUPER_ADMINS = ['contact@didyouquit.com'];
        if (!decodedToken.email || !SUPER_ADMINS.includes(decodedToken.email)) {
            return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
        }

        const body = await req.json();
        const count = Math.min(Math.max(1, body.count || 1), 50); // Cap at 50 per batch
        const requestedCountry = body.country; // Optional

        const createdUsers = [];

        for (let i = 0; i < count; i++) {
            // 2. Generate Identity
            let username = body.username;
            if (!username) {
                // Username: Random Name + 2-4 digits (High Fidelity)
                const randomBase = IMAGINATIVE_USERNAMES[Math.floor(Math.random() * IMAGINATIVE_USERNAMES.length)];
                const suffix = Math.floor(Math.random() * 9900) + 100; // 100-9999
                username = `${randomBase}${suffix}`;
            } else {
                // Safety: Check if username already exists to prevent dupes (e.g. Nomad1033)
                const existingCheck = await adminDb.collection('users').where('username', '==', username).get();
                if (!existingCheck.empty) {
                    throw new Error(`Username '${username}' is already taken. Please choose another.`);
                }
            }

            // Email: Internal Bot Format
            const randomId = Math.random().toString(36).substring(2, 8);
            const email = `bot.${randomId}@simulated.didyouquit.com`;
            const password = `sim-pass-${Math.random().toString(36).substring(2)}`;

            // Country
            // If requestedCountry is valid and in our list, use it. Otherwise random.
            let country = requestedCountry;
            if (!country || !COUNTRIES.includes(country)) {
                country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
            }

            // 3. Create Auth User
            // Note: Firebase Auth requires a valid HTTPS URL for photoURL. Data URIs causing crash.
            // We use a safe placeholder for Auth, but save the rich Data URI to Firestore.
            const userRecord = await adminAuth.createUser({
                email,
                password,
                displayName: username,
                // photoURL: `https://ui-avatars.com/api/?name=${username}&background=random`, <--- VIOLATION REMOVED
                // Use a safe static placeholder for Auth (App reads from Firestore anyway)
                photoURL: `https://didyouquit.com/images/default-avatar.png`,
                emailVerified: true
            });

            // 4. Create Firestore Profile (Pro, Configured, Empty Content)
            const userDoc = {
                uid: userRecord.uid,
                username,
                email,
                country,
                photoURL: generateAvatar(username), // High-fidelity SVG Data URI stored here
                createdAt: FieldValue.serverTimestamp(),
                // Simulation Flags
                isSimulated: true,
                // Pro Status
                isPro: true,
                subscriptionStatus: 'active',
                stripeCustomerId: `sim_cust_${userRecord.uid}`,
                planInterval: 'year'
            };

            await adminDb.collection('users').doc(userRecord.uid).set(userDoc);
            createdUsers.push(username);
        }

        return NextResponse.json({
            success: true,
            message: `Spawned ${createdUsers.length} users`,
            users: createdUsers
        });

    } catch (error: any) {
        console.error('Simulation Factory Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        // 1. Verify Super Admin (Same logic)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        if (decodedToken.email !== 'contact@didyouquit.com') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const { uid, bulk, retainUsers } = await req.json();

        // ---------------------------------------------------------
        // MODE A: BULK DELETE
        // ---------------------------------------------------------
        if (bulk) {
            const usersSnap = await adminDb.collection('users').where('isSimulated', '==', true).get();
            let processed = 0;

            for (const doc of usersSnap.docs) {
                const data = doc.data();
                // Safety: Email Guard
                if (!data.email?.endsWith('@simulated.didyouquit.com')) continue;

                // 1. Clean Content
                await nukeUserContent(doc.id);

                // 2. Delete User (Unless retained)
                if (!retainUsers) {
                    try {
                        await adminAuth.deleteUser(doc.id);
                        await doc.ref.delete();
                    } catch (e: any) {
                        if (e.code !== 'auth/user-not-found') {
                            console.error(`Failed to delete auth for ${doc.id}`, e);
                        }
                    }
                }

                processed++;
            }
            return NextResponse.json({
                success: true,
                message: `Processed ${processed} users. Content deleted. ${retainUsers ? 'Users retained.' : 'Users deleted.'}`
            });
        }

        // ---------------------------------------------------------
        // MODE B: SINGLE DELETE
        // ---------------------------------------------------------
        if (!uid) return NextResponse.json({ error: 'Missing UID' }, { status: 400 });

        // 2. Safety Check: MUST be simulated
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const userData = userDoc.data();
        if (!userData?.isSimulated) {
            return NextResponse.json({ error: 'SAFETY STOP: Attempted to delete a REAL user via Simulation API.' }, { status: 403 });
        }

        // 3. Clean Content
        await nukeUserContent(uid);

        // 4. Delete Auth & Firestore Profile
        await adminAuth.deleteUser(uid);
        await adminDb.collection('users').doc(uid).delete();

        return NextResponse.json({ success: true, message: 'Simulated user nuked' });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Helper: Cascading Content Deletion
async function nukeUserContent(uid: string) {
    // Order: Notifications -> Comments -> Posts -> Journal Entries -> Resolutions
    const collectionsToClean = [
        { name: 'notifications', field: 'senderUid' },
        { name: 'comments', field: 'authorUid' },
        { name: 'posts', field: 'authorUid' }, // Handled specifically below
        { name: 'journal_entries', field: 'uid' },
        { name: 'resolutions', field: 'uid' }
    ];

    for (const col of collectionsToClean) {
        try {
            let q;
            if (col.name === 'comments') {
                // Use Collection Group for subcollections
                q = await adminDb.collectionGroup(col.name).where(col.field, '==', uid).get();
                const q2 = await adminDb.collectionGroup(col.name).where('author.uid', '==', uid).get();

                const docs = new Map();
                q.docs.forEach(d => docs.set(d.id, d));
                q2.docs.forEach(d => docs.set(d.id, d));

                if (docs.size > 0) {
                    const batch = adminDb.batch();
                    const topicDecrements: Record<string, number> = {};
                    const journalDecrements: Record<string, number> = {};

                    for (const doc of docs.values()) {
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

                    // Decrement Counts
                    for (const [id, count] of Object.entries(topicDecrements)) {
                        const ref = adminDb.collection('forum_topics').doc(id);
                        batch.update(ref, { commentCount: FieldValue.increment(-count) });
                    }
                    for (const [id, count] of Object.entries(journalDecrements)) {
                        const ref = adminDb.collection('journal_entries').doc(id);
                        batch.update(ref, { commentCount: FieldValue.increment(-count) });
                    }

                    await batch.commit();
                }
                continue;

            } else if (col.name === 'posts') {
                // Special Handling for Posts (Forum Topics)
                const q1 = await adminDb.collection('forum_topics').where('authorUid', '==', uid).get();
                const q2 = await adminDb.collection('forum_topics').where('author.uid', '==', uid).get();

                const docs = new Map();
                q1.docs.forEach(d => docs.set(d.id, d));
                q2.docs.forEach(d => docs.set(d.id, d));

                if (docs.size > 0) {
                    const batch = adminDb.batch();

                    // RECURSIVE DELETE: Delete comments sub-collection for each topic first
                    for (const topicDoc of docs.values()) {
                        const commentsSnap = await topicDoc.ref.collection('comments').get();
                        commentsSnap.docs.forEach(c => batch.delete(c.ref));

                        // Delete the topic itself
                        batch.delete(topicDoc.ref);
                    }

                    await batch.commit();
                }
                continue;

            } else {
                // Standard Top-Level Collection Query
                q = await adminDb.collection(col.name).where(col.field, '==', uid).get();
            }

            if (!q.empty) {
                const batch = adminDb.batch();
                q.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        } catch (err) {
            console.error(`Failed to clean ${col.name} for ${uid}`, err);
        }
    }
}
