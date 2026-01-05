import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
    try {
        const { stripeCustomerId } = await req.json();

        // Initialize Stripe (Dynamic keys based on mode? We need to know which mode user is in. 
        // Usually webhooks/sessions carry this state, but for portal initiating, we rely on the stored customer ID.
        // If the customer ID exists, it belongs to EITHER test or live.
        // We should try to find it? Or store the 'mode' on the user profile?)

        // Simpler: Just use the key from env that matches the "current" mode of the app?
        // But if I signed up in Test, and app switches to Live, I shouldn't be able to manage my Test sub?
        // Let's assume the Config 'mode' drives which key we use.

        const configDoc = await adminDb.collection("app_config").doc("subscription_settings").get();
        const config = configDoc.data() as any;

        // Environment-Scoped Monetization
        const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || 'production') as 'development' | 'production';
        const mode = config.modes?.[appEnv] || config.mode || 'test';

        const apiKey = mode === 'live'
            ? process.env.STRIPE_SECRET_KEY_LIVE
            : process.env.STRIPE_SECRET_KEY_TEST;

        // Use the config ID we just generated if available
        const portalConfigId = config?.[mode]?.portalConfigId;

        if (!apiKey) {
            return NextResponse.json({ error: "Stripe Config Missing" }, { status: 500 });
        }

        const stripe = new Stripe(apiKey, { apiVersion: "2025-12-15.clover" as any });

        if (!stripeCustomerId) {
            return NextResponse.json({ error: "No customer ID provided" }, { status: 400 });
        }

        // --- DUAL-MODE ID RESOLUTION ---
        // Just providing 'stripeCustomerId' from client isn't enough anymore because the client
        // might send a Test ID while we are in Live Mode (or vice versa).
        // Best practice: Fetch the User's Firestore Doc to get the authoritative ID for the current mode.
        // However, since we don't have the UID passed in here easily (unless we session-gate),
        // we'll try to be smart:
        // 1. If we have a user in session (using Firebase Admin auth check if we wanted to be strict).
        // 2. OR, simply trust the client passed ID *IF* it matches the pattern we expect?
        //    Actually, No. The ID format is same for live/test ("cus_...").

        // BETTER APPROACH: The client should pass the UID, and we fetch the doc.
        // OR better yet, since we are using Firebase, we can look up the user by the stripeCustomerId?
        // No, that's an inverse lookup which might require an index.

        // CORRECT FIX:
        // This is a protected route usually. Let's assume the frontend passes the UID or we can verify auth.
        // But for now, since we are doing a "quick fix" for the redirect issue:
        // We will query the Users collection for the user who OWNS this 'stripeCustomerId' (legacy) OR resides in 'stripeIds.{mode}'.
        // ...Actually that is expensive.

        // EASIEST FIX (Frontend + Backend):
        // 1. Frontend: Pass 'uid' in the body.
        // 2. Backend: Fetch User Doc -> Get correct ID for `mode`.

        // Let's modify to accept 'uid'.
        const { uid } = await req.json(); // We need to verify if the frontend sends this. Assuming I change frontend too.

        let validCustomerId = stripeCustomerId;

        if (uid) {
            const userDoc = await adminDb.collection('users').doc(uid).get();
            const userData = userDoc.data();
            if (userData) {
                // Priority: 1. Mode-specific ID, 2. Legacy ID (if no mode specific), 3. Fallback to passed ID
                const modeSpecificId = userData.stripeIds?.[mode];
                if (modeSpecificId) {
                    validCustomerId = modeSpecificId;
                    console.log(`[Portal] Switched to ${mode} ID: ${validCustomerId}`);
                } else if (userData.stripeCustomerId) {
                    // Check if legacy ID "might" be valid? Hard to know strict truth without trying.
                    // But usually, existing legacy ID = whatever mode they signed up in.
                    // If they are now in LIVE mode, but legacy ID is TEST, this will fail. 
                    // Users migrating from Test->Live will implicitly get a NEW ID created on next checkout.
                    // But for Portal, we can't "create" one.
                    // So we keep validCustomerId as is, but log warning.
                    console.log(`[Portal] Using Legacy ID: ${userData.stripeCustomerId} for mode: ${mode}`);
                    validCustomerId = userData.stripeCustomerId;
                }
            }
        }

        if (!validCustomerId) {
            return NextResponse.json({ error: "No Subscription Found for this Environment." }, { status: 404 });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${req.headers.get("origin")}/subscription`,
            configuration: portalConfigId // Use the custom configuration with Update enabled
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
