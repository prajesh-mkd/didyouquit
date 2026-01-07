
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
// Inline generateAvatar to avoid module resolution issues
function generateAvatar(seed: string): string {
    // Using UI Avatars for consistency with script usage
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(seed)}&background=random`;
}

// Initialize Admin SDK
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const serviceAccount = require("../service-account.json");
initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

// --- DATA DEFINITIONS ---

const USERS = [
    { username: 'Nomad1033', country: 'United States', ageRange: '25-34', gender: 'Male' },
    { username: 'Vault4328', country: 'United States', ageRange: '35-44', gender: 'Female' }, // Added placeholder demographics
    { username: 'Core6800', country: 'Canada', ageRange: '18-24', gender: 'Male' }, // Added placeholder demographics
    { username: 'Momentum9143', country: 'Canada', ageRange: '25-34', gender: 'Female' }, // Added placeholder demographics
];

// Helper to get Timestamp from "YYYY-MM-DD HH:MM" string (New York Time assumed for input, converting to UTC)
function getTimestamp(dateStr: string): Timestamp {
    const date = new Date(dateStr); // This parses as local time (system time), creating potentialoffset issues if running locally vs server.
    // Given the task, let's treat the input string as consistent 'Server Time'.
    return Timestamp.fromDate(date);
}

// Map username -> uid
const USER_MAP: Record<string, string> = {};

async function main() {
    console.log("Starting data injection...");

    // 1. Create Users
    for (const u of USERS) {
        console.log(`Processing User: ${u.username}`);
        let uid = '';

        // Check if exists
        try {
            const userRecord = await auth.getUserByEmail(`${u.username.toLowerCase()}@simulated.didyouquit.com`);
            uid = userRecord.uid;
            console.log(`  - Found existing Auth user: ${uid}`);
        } catch (e) {
            // Create
            const userRecord = await auth.createUser({
                email: `${u.username.toLowerCase()}@simulated.didyouquit.com`,
                password: 'password123',
                displayName: u.username,
                emailVerified: true,
                photoURL: `https://ui-avatars.com/api/?name=${u.username}&background=random`
            });
            uid = userRecord.uid;
            console.log(`  - Created new Auth user: ${uid}`);
        }

        USER_MAP[u.username] = uid;

        // Upsert Firestore Profile
        await db.collection('users').doc(uid).set({
            uid,
            username: u.username,
            email: `${u.username.toLowerCase()}@simulated.didyouquit.com`,
            country: u.country,
            photoURL: generateAvatar(u.username),
            isSimulated: true,
            isPro: true,
            createdAt: FieldValue.serverTimestamp(),
            // Demographics (optional, but requested)
            ageRange: u.ageRange,
            gender: u.gender
        }, { merge: true });
    }

    const nomadUid = USER_MAP['Nomad1033'];

    // 2. Create Resolution (R-US-002)
    console.log("Creating Resolution...");
    const resRef = db.collection('resolutions').doc(); // Auto-ID, but we can store reference
    const resolutionId = resRef.id;

    await resRef.set({
        uid: nomadUid,
        title: "Save $5,000 by the end of the year",
        category: "Money",
        why: "I’m honestly tired of stressing about money all the time. Even small things make me anxious. I want to feel like I have some control and not panic every time something unexpected comes up.",
        commitmentType: "weekly",
        active: true,
        visibility: "public",
        createdAt: getTimestamp("2026-01-01 00:00"), // Assume start of year
        updatedAt: FieldValue.serverTimestamp()
    });

    // 3. Weekly Journal (WJ-US-002)
    console.log("Creating Weekly Journal...");
    const journalRef = db.collection('journal_entries').doc();
    await journalRef.set({
        uid: nomadUid,
        resolutionId: resolutionId,
        content: "I tracked all my spending this week and actually stuck to it. I did not use my credit card once, which is new for me. I moved a small amount into savings. It’s not a big number, but it felt good to start. Curious how others are handling money stuff early on.",
        weekStartDate: "2025-12-29",
        weekEndDate: "2026-01-04",
        status: "success", // Kept It
        createdAt: getTimestamp("2026-01-06 09:10"),
        commentCount: 2, // 2 Direct replies
        reactionCount: 0,
        author: {
            uid: nomadUid,
            username: "Nomad1033",
            photoURL: generateAvatar("Nomad1033"),
            country: "United States"
        }
    });

    // 4. Replies to Journal
    console.log("Adding Journal Replies...");

    // RP-003 (Vault4328)
    await journalRef.collection('comments').add({
        authorUid: USER_MAP['Vault4328'],
        author: {
            uid: USER_MAP['Vault4328'],
            username: 'Vault4328',
            photoURL: generateAvatar('Vault4328'),
            country: 'United States'
        },
        content: "That’s a solid start. Tracking alone opened my eyes too. Small wins add up faster than you think.",
        createdAt: getTimestamp("2026-01-06 09:34"),
        parentId: null
    });

    // RP-004 (Core6800)
    await journalRef.collection('comments').add({
        authorUid: USER_MAP['Core6800'],
        author: {
            uid: USER_MAP['Core6800'],
            username: 'Core6800',
            photoURL: generateAvatar('Core6800'),
            country: 'Canada'
        },
        content: "I’m doing the same thing right now. The first week feels slow, but it helps build the habit.",
        createdAt: getTimestamp("2026-01-06 10:02"),
        parentId: null
    });


    // 5. Progress Post (PP-US-014)
    console.log("Creating Progress Post...");
    const postRef = db.collection('forum_topics').doc();
    await postRef.set({
        uid: nomadUid, // Legacy field
        author: {
            uid: nomadUid,
            username: "Nomad1033",
            photoURL: generateAvatar("Nomad1033"),
            country: "United States"
        },
        resolutionId: resolutionId,
        title: "Small Win: Cooking at Home", // Infer title context
        content: "Skipped ordering food today and cooked at home instead. Was tempted to just tap my card, but didn’t. Felt like a small win.",
        category: "Money",
        type: "general", // or "update"
        createdAt: getTimestamp("2026-01-04 16:45"),
        commentCount: 2, // 1 reply + 1 nested
        reactionCount: 0
    });

    // 6. Replies to Progress Post
    console.log("Adding Post Replies...");

    // RP-005 (Momentum9143)
    const reply5Ref = await postRef.collection('comments').add({
        authorUid: USER_MAP['Momentum9143'],
        author: {
            uid: USER_MAP['Momentum9143'],
            username: 'Momentum9143',
            photoURL: generateAvatar('Momentum9143'),
            country: 'Canada'
        },
        content: "Those small choices matter more than we realize. Nice job catching yourself.",
        createdAt: getTimestamp("2026-01-04 17:10"),
        parentId: null
    });

    // RP-006 (Nomad1033) -> Reply to RP-005
    await postRef.collection('comments').add({
        authorUid: nomadUid,
        author: {
            uid: nomadUid,
            username: 'Nomad1033',
            photoURL: generateAvatar('Nomad1033'),
            country: 'United States'
        },
        content: "Yeah, it’s harder than I thought. Appreciate the encouragement.",
        createdAt: getTimestamp("2026-01-04 17:18"),
        parentId: reply5Ref.id // Nested
    });

    console.log("Injection Complete! 🚀");
}

main().catch(console.error);
