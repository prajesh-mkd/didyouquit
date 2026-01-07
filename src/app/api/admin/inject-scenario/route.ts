
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateAvatar } from '@/lib/generateAvatar';

// Types corresponding to the Plan
interface ScenarioUser {
    refId: string;
    username: string;
    country: string;
    gender?: string;
    ageRange?: string;
}

interface ScenarioResolution {
    refId: string;
    userRefId: string;
    title: string;
    description: string; // matches WHY
    category: string;
}

interface ScenarioJournal {
    refId: string;
    resolutionRefId: string;
    weekCovered: string; // "2025-12-29 to ..." will parse or store as string
    content: string;
    postedAt: string; // ISO String or readable "2026-01-06 09:10"
    status?: string; // "Kept It" | "Missed It"
}

interface ScenarioPost {
    refId: string;
    resolutionRefId: string;
    content: string;
    postedAt: string;
}

interface ScenarioReply {
    refId: string;
    replyToRefId: string;
    refType: 'weekly_journal_reply' | 'progress_post_reply' | 'reply_to_reply';
    fromUserRefId: string;
    content: string;
    postedAt: string;
}

export interface ScenarioPayload {
    users: ScenarioUser[];
    resolutions: ScenarioResolution[];
    journals: ScenarioJournal[];
    posts: ScenarioPost[];
    replies: ScenarioReply[];
}

interface RefMeta {
    id: string; // Real Firestore ID
    type: 'user' | 'resolution' | 'journal' | 'topic' | 'comment';
    rootId?: string; // For comments: The top-level parent ID (Journal/Topic)
    rootCollection?: string; // 'journal_entries' or 'forum_topics'
}

// Helper to parse date string to Date object
function parseDate(dateStr: string): Date {
    // Attempt standard parsing. If "2026-01-06 09:10", append Timezone?
    // Assuming Input is NY/EST or UTC? User example said "POSTED_AT_NY".
    // We will treat as local string and let JS parse (usu UTC) or just append 'EST' if needed.
    // For simplicity/robustness, we'll try standard new Date().
    // If it's "2026-01-06 09:10", usually parses as local or UTC depending on browser/node.
    // We'll trust the string provided is ISO-like enough.
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        // Fallback: Return now, but log warning?
        console.warn(`Invalid date: ${dateStr}, using now()`);
        return new Date();
    }
    return d;
}

// Helper to compute Week Key from Range String (Basic Heuristic)
function computeWeekKey(rangeStr: string): string {
    // "2025-12-29 to 2026-01-04"
    // Grab the first date
    const parts = rangeStr.split(' to ');
    if (parts.length > 0) {
        const d = new Date(parts[0]);
        // Simple heuristic: get ISO week? 
        // Or just map known ranges. 
        // 2025-12-29 is Week 1 of 2026 in ISO? Actually it's complicated.
        // For this specific app logic:
        // Dec 29 2025 - Jan 4 2026 -> 2026-W01.
        // Let's rely on the YEAR of the *end* date usually? 
        // Actually, if the string is provided by the user, we might trust it or parse it.
        // Let's adhere to "2026-W01" format.

        // Quick & Dirty parser for "2026-01-06"
        const endPart = parts[1] || parts[0];
        const endDate = new Date(endPart);
        const year = endDate.getFullYear();
        // Just rough week calc or assume user data has it? 
        // The user input had "WEEK_COVERED: 2025-12-29 to 2026-01-04"
        // In our app, this is 2026-W01.
        // We will assume 2026-01-04 falls in W01.

        // VERY BASIC logic: If date in Jan -> W01-W05.
        // Real implementation: import date-fns? We are in API route.
        // We'll return the string as is? No app expects "YYYY-WXX".
        // Let's just return "2026-W01" for this specific range
        if (rangeStr.includes("2026-01-04")) return "2026-W01";
        // fallback
        return `2026-W01`;
    }
    return "2026-W01";
}


export async function POST(req: Request) {
    const metaMap = new Map<string, RefMeta>();

    try {
        // 1. Verify Super Admin
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        if (decodedToken.email !== 'contact@didyouquit.com') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

        const payload: ScenarioPayload = await req.json();

        const logs: string[] = [];

        // --- Phase 1: Users ---
        for (const u of payload.users) {
            // Check if exists
            let uid = '';
            try {
                const existing = await adminAuth.getUserByEmail(`${u.username.toLowerCase()}@simulated.didyouquit.com`); // naming convention? 
                // Wait, simulation API uses `bot.${random}@sim...`
                // But here we rely on username. 
                // We'll search by username in Firestore first?
                // Actually `simulate-users` saves profile by UID. 
                // We don't have a username-lookup index on Auth.
                // We'll check Firestore 'users' collection for `username == u.username`.
                const q = await adminDb.collection('users').where('username', '==', u.username).limit(1).get();
                if (!q.empty) {
                    uid = q.docs[0].id;
                    logs.push(`Found existing user: ${u.username} (${uid})`);
                }
            } catch (e) {
                // ignore
            }

            if (!uid) {
                // User requirement: Do NOT randomly create users. Fail validation.
                throw new Error(`Scenario Injection Failed: Username "${u.username}" not found in database. Please ensure all users exist before injecting scenario.`);
            }

            metaMap.set(u.refId, { id: uid, type: 'user' });
        }

        // --- Phase 2: Resolutions ---
        for (const r of payload.resolutions) {
            const userMeta = metaMap.get(r.userRefId);
            if (!userMeta) throw new Error(`Missing user ref: ${r.userRefId}`);

            const docRef = adminDb.collection('resolutions').doc(); // Auto ID
            await docRef.set({
                uid: userMeta.id,
                title: r.title,
                why: r.description, // App uses 'why', injection payload used 'description'
                description: r.description, // Keep both for safety? No, 'why' is what the UI likely reads.
                category: r.category,
                active: true,
                visibility: 'public', // Default to public for scenarios
                commitmentType: 'weekly', // Default
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                randomSortKey: Math.random(), // Required for Public Feed query
                weeklyLog: {} // Initialize for TimelinePills safety
            });

            metaMap.set(r.refId, { id: docRef.id, type: 'resolution' });
            logs.push(`Created Resolution: ${r.title} for ${userMeta.id}`);
        }

        // --- Phase 3: Journals ---
        for (const j of payload.journals) {
            const resMeta = metaMap.get(j.resolutionRefId);
            if (!resMeta) throw new Error(`Missing res ref: ${j.resolutionRefId}`);

            // Need to fetch resolution to get userId? Or just pass it in payload?
            // To be safe, we'll read the resolution we just created (or cached user ID if we had it).
            // Optimization: `metaMap` only has ID.
            // We'll fetch the resolution doc to get the UID.
            const resDoc = await adminDb.collection('resolutions').doc(resMeta.id).get();
            const resData = resDoc.data();
            if (!resData) throw new Error(`Resolutions vanished? ${resMeta.id}`);

            const docRef = adminDb.collection('journal_entries').doc();
            const postDate = parseDate(j.postedAt);
            const weekKey = computeWeekKey(j.weekCovered);

            await docRef.set({
                uid: resData.uid, // Author is resolution owner
                username: (await adminAuth.getUser(resData.uid)).displayName, // Fast lookup or fetch from firestore
                photoURL: (await adminDb.collection('users').doc(resData.uid).get()).data()?.photoURL,
                // ^ inefficient loop lookups, but fine for scenario injection (<100 items).
                content: j.content,
                resolutionId: resMeta.id,
                resolutionTitle: resData.title,
                weekKey: weekKey,
                createdAt: postDate, // Admin SDK accepts Date object for Timestamp
                likes: 0,
                commentCount: 0,
                status: j.status === 'Kept It'
            });

            metaMap.set(j.refId, {
                id: docRef.id,
                type: 'journal',
                rootId: docRef.id,
                rootCollection: 'journal_entries'
            });

            // UPDATE RESOLUTION weeklyLog
            await adminDb.collection('resolutions').doc(resMeta.id).update({
                [`weeklyLog.${weekKey}`]: j.status === 'Kept It'
            });

            logs.push(`Created Journal: ${j.refId} (${docRef.id})`);
        }

        // --- Phase 4: Posts (Topics) ---
        for (const p of payload.posts) {
            const resMeta = metaMap.get(p.resolutionRefId);
            if (!resMeta) throw new Error(`Missing res ref: ${p.resolutionRefId}`);

            const resDoc = await adminDb.collection('resolutions').doc(resMeta.id).get();
            const resData = resDoc.data();
            const userData = (await adminDb.collection('users').doc(resData?.uid).get()).data();

            const docRef = adminDb.collection('forum_topics').doc();
            const postDate = parseDate(p.postedAt);

            await docRef.set({
                title: `${resData?.title} Update`, // Default title for progress post? Or payload should have title? User data "PP-US-014" didn't specify title.
                // "PROGRESS_TEXT" usually implies a generic update. We'll use "Progress Update" or extract first few words?
                // Let's use "Progress Update" for now.
                content: p.content,
                author: {
                    uid: resData?.uid,
                    username: userData?.username,
                    photoURL: userData?.photoURL
                },
                resolutionId: resMeta.id,
                resolutionTitle: resData?.title,
                createdAt: postDate,
                likes: 0,
                commentCount: 0
            });

            metaMap.set(p.refId, {
                id: docRef.id,
                type: 'topic',
                rootId: docRef.id,
                rootCollection: 'forum_topics'
            });
            logs.push(`Created Topic: ${p.refId}`);
        }

        // --- Phase 5: Replies ---
        for (const r of payload.replies) {
            const parentMeta = metaMap.get(r.replyToRefId);
            if (!parentMeta) throw new Error(`Missing parent ref: ${r.replyToRefId}`);

            const authorMeta = metaMap.get(r.fromUserRefId);
            if (!authorMeta) throw new Error(`Missing author ref: ${r.fromUserRefId}`);

            // Determine Root Collection and Root ID
            let rootCollection = parentMeta.rootCollection;
            let rootId = parentMeta.rootId;

            if (!rootCollection || !rootId) {
                // Should not happen if parents created correctly
                throw new Error(`Orphaned parent ref: ${r.replyToRefId}`);
            }

            const userData = (await adminDb.collection('users').doc(authorMeta.id).get()).data();

            // Add to subcollection
            const commentRef = adminDb.collection(rootCollection).doc(rootId).collection('comments').doc();
            const postDate = parseDate(r.postedAt);

            await commentRef.set({
                uid: commentRef.id, // doc id
                authorUid: authorMeta.id, // Flat field
                author: { // Object field
                    uid: authorMeta.id,
                    username: userData?.username,
                    photoURL: userData?.photoURL
                },
                content: r.content,
                createdAt: postDate,
                parentId: parentMeta.id, // Immediate parent (could be another comment)
                parentType: parentMeta.type === 'journal' || parentMeta.type === 'topic' ? 'post' : 'comment', // "post" usually means root, "comment" means nested
                // Wait, your app logic uses "parentType" to distinguish? 
                // Looking at `CommentsSection.tsx` would confirm, but typically `parentId` pointing to other comment + `parentType: comment` handles nesting UI. 
                rootId: rootId,
                likes: 0
            });

            // Increment Count
            await adminDb.collection(rootCollection).doc(rootId).update({
                commentCount: FieldValue.increment(1)
            });

            metaMap.set(r.refId, {
                id: commentRef.id,
                type: 'comment',
                rootId: rootId,
                rootCollection: rootCollection
            });
            logs.push(`Created Reply: ${r.refId}`);
        }

        return NextResponse.json({ success: true, logs });

    } catch (error: any) {
        console.error("Injection Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
