
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
            // Username: Random Name + 2-4 digits (High Fidelity)
            const randomBase = IMAGINATIVE_USERNAMES[Math.floor(Math.random() * IMAGINATIVE_USERNAMES.length)];
            const suffix = Math.floor(Math.random() * 9900) + 100; // 100-9999
            const username = `${randomBase}${suffix}`;

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
                photoURL: `https://ui-avatars.com/api/?name=${username}&background=random`,
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

        const { uid } = await req.json();
        if (!uid) return NextResponse.json({ error: 'Missing UID' }, { status: 400 });

        // 2. Safety Check: MUST be simulated
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const userData = userDoc.data();
        if (!userData?.isSimulated) {
            return NextResponse.json({ error: 'SAFETY STOP: Attempted to delete a REAL user via Simulation API.' }, { status: 403 });
        }

        // 3. Delete Auth & Firestore Profile
        await adminAuth.deleteUser(uid);
        await adminDb.collection('users').doc(uid).delete();

        // 4. CLEANUP: Delete ALL content generated by this user
        // Order: Notifications -> Comments -> Posts -> Journal Entries -> Resolutions
        // Note: Batch limits apply (500 ops), so we do them sequentially or we need a chunker for production.
        // For simulation scale, sequential batches per collection is fine.

        const collectionsToClean = [
            { name: 'notifications', field: 'senderUid' },
            { name: 'comments', field: 'authorUid' },
            { name: 'posts', field: 'authorUid' },
            { name: 'journal_entries', field: 'uid' },
            { name: 'resolutions', field: 'uid' }
        ];

        for (const col of collectionsToClean) {
            try {
                let q;
                if (col.name === 'comments') {
                    // Use Collection Group for subcollections
                    q = await adminDb.collectionGroup(col.name).where(col.field, '==', uid).get();

                    // Safety: Also check 'author.uid' just in case data structure varied
                    const q2 = await adminDb.collectionGroup(col.name).where('author.uid', '==', uid).get();
                    // Merge results
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

                        for (const [id, count] of Object.entries(topicDecrements)) {
                            const ref = adminDb.collection('forum_topics').doc(id);
                            batch.update(ref, { commentCount: FieldValue.increment(-count) });
                        }
                        for (const [id, count] of Object.entries(journalDecrements)) {
                            const ref = adminDb.collection('journal_entries').doc(id);
                            batch.update(ref, { commentCount: FieldValue.increment(-count) });
                        }

                        await batch.commit();
                        console.log(`Cleanup: Deleted ${docs.size} comments (ghost replies) for ${uid}`);
                    }
                    continue; // Skip standard processing
                } else {
                    // Standard Top-Level Collection Query
                    q = await adminDb.collection(col.name).where(col.field, '==', uid).get();
                }

                if (!q.empty) {
                    const batch = adminDb.batch();
                    q.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                    console.log(`Cleanup: Deleted ${q.size} ${col.name} from ${uid}`);
                }
            } catch (err) {
                console.error(`Failed to clean ${col.name} for ${uid}`, err);
            }
        }

        // Note: Sub-collections (resolutions, etc.) might remain orphan if we don't use a recursive delete,
        // but for simulations, usually fine. Or we can implement recursive delete later.

        return NextResponse.json({ success: true, message: 'Simulated user nuked' });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
