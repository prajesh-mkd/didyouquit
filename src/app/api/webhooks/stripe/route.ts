import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";
import { AppConfig } from "@/lib/types";

export async function POST(req: NextRequest) {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    if (!sig) {
        return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // To construct event, we need the RIGHT secret key + webhook secret.
    // The Webhook Secret (whsec_...) is usually specific to the Endpoint defined in Stripe Dashboard.
    // We might have different secrets for Test and Live Endpoints?
    // OR we might have one endpoint that handles both (but that's tricky).
    // Usually you define TWO endpoints in your backend, or use one URL but different secrets.
    // Since we only have one route via Next.js, we assume the user will configure the Environment Variable `STRIPE_WEBHOOK_SECRET` 
    // to match the one provided by Stripe for this specific deployment URL.

    // BUT we also need the API Key to initialize Stripe object (though `constructEvent` is static/doesn't need network, it needs the library).
    // Just using any key to init the library is fine for signature check? No, constructEvent is standalone.
    // BUT we might use `stripe` later for API calls.

    // Let's assume process.env.STRIPE_SECRET_KEY is set to default (Test) or whatever.
    // The safest bet is: verify signature first.

    // Note: If you want to support both Test and Live webhooks at the same URL simultaneously, you'd need logic to try both secrets.
    // For now, we assume one active environment.

    // 1. Verify Signature
    let event: Stripe.Event;

    // We only need the library for constructEvent, key doesn't matter yet
    const stripeShim = new Stripe("sk_test_placeholder", { apiVersion: "2025-12-15.clover" as any });

    try {
        const secretLive = process.env.STRIPE_WEBHOOK_SECRET_LIVE;
        const secretTest = process.env.STRIPE_WEBHOOK_SECRET_TEST;

        if (!secretLive && !secretTest) {
            throw new Error("Missing both STRIPE_WEBHOOK_SECRET_LIVE and _TEST");
        }

        try {
            // First try LIVE
            if (secretLive) {
                event = stripeShim.webhooks.constructEvent(body, sig, secretLive);
            } else {
                throw new Error("No Live Secret");
            }
        } catch (errLive) {
            // If Live fails, try TEST
            if (secretTest) {
                try {
                    event = stripeShim.webhooks.constructEvent(body, sig, secretTest);
                } catch (errTest: any) {
                    // Both failed
                    console.error(`[Webhook] Signature Verification Failed (Live & Test). Live Error: ${(errLive as Error).message}. Test Error: ${errTest.message}`);
                    return NextResponse.json({ error: `Webhook Error: Signature verification failed.` }, { status: 400 });
                }
            } else {
                console.error(`[Webhook] Sig Verification Failed (Live) and NO Test Secret set. Error: ${(errLive as Error).message}`);
                return NextResponse.json({ error: `Webhook Error: ${(errLive as Error).message}` }, { status: 400 });
            }
        }
    } catch (err: any) {
        console.error(`[Webhook] Config Error: ${err.message}`);
        return NextResponse.json({ error: `Webhook Config Error: ${err.message}` }, { status: 500 });
    }

    // 2. Initialize Real Stripe Instance based on Mode
    const apiKey = event.livemode ? process.env.STRIPE_SECRET_KEY_LIVE : process.env.STRIPE_SECRET_KEY_TEST;
    if (!apiKey) {
        console.error(`[Webhook] Missing API Key for mode: ${event.livemode ? 'live' : 'test'}`);
        // We can still proceed if we don't need API calls, but we DO need them below.
    }
    const stripe = new Stripe(apiKey || "", { apiVersion: "2025-12-15.clover" as any });

    // Handle the event
    try {
        if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const uid = session.metadata?.uid;
            const customerId = session.customer as string;
            const subscriptionId = session.subscription as string;

            if (uid) {
                // Retrieve the subscription to get the period end and cancellation status
                let currentPeriodEnd = null;
                let cancelAtPeriodEnd = false;
                let planInterval = 'month';

                try {
                    const sub = await stripe.subscriptions.retrieve(subscriptionId);
                    // Safe cleanup of timestamp
                    const periodEndRaw = (sub as any).current_period_end;
                    if (typeof periodEndRaw === 'number' && !isNaN(periodEndRaw)) {
                        currentPeriodEnd = new Date(periodEndRaw * 1000);
                    } else {
                        console.error(`[Webhook] Invalid current_period_end: ${periodEndRaw}`);
                    }

                    cancelAtPeriodEnd = (sub as any).cancel_at_period_end || !!((sub as any).cancel_at);
                    planInterval = (sub as any).items?.data?.[0]?.price?.recurring?.interval || 'month';
                    console.log(`[Webhook] Fetched Sub: ${subscriptionId}, End: ${currentPeriodEnd}`);
                } catch (e: any) {
                    console.error("[Webhook] Error fetching sub details:", e.message);
                }

                // Dual-Mode ID Logic
                const modeKey = event.livemode ? 'live' : 'test';

                // Ensure currentPeriodEnd is valid for Firestore
                const validPeriodEnd = (currentPeriodEnd && !isNaN(currentPeriodEnd.getTime()))
                    ? currentPeriodEnd
                    : null;

                await adminDb.collection("users").doc(uid).set({
                    subscriptionStatus: 'active',
                    stripeCustomerId: customerId, // Keep legacy for backward compat
                    subscriptionId: subscriptionId, // Keep legacy
                    stripeIds: {
                        [modeKey]: customerId
                    },
                    subscriptionIds: {
                        [modeKey]: subscriptionId
                    },
                    currentPeriodEnd: validPeriodEnd,
                    cancelAtPeriodEnd: cancelAtPeriodEnd,
                    planInterval: planInterval,
                    isPro: true
                }, { merge: true }); // Merge is critical to preserve other mode's IDs
                console.log(`[Webhook] User ${uid} upgraded to PRO (${modeKey}).`);
            }
        }
        else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
            const sub = event.data.object as Stripe.Subscription;
            const customerId = sub.customer as string;
            const status = sub.status; // 'active', 'canceled', 'past_due'

            let currentPeriodEnd = null;
            const periodEndRaw = (sub as any).current_period_end;
            if (typeof periodEndRaw === 'number' && !isNaN(periodEndRaw)) {
                currentPeriodEnd = new Date(periodEndRaw * 1000);
            }

            const cancelAtPeriodEnd = (sub as any).cancel_at_period_end || !!((sub as any).cancel_at);
            const planInterval = (sub as any).items?.data?.[0]?.price?.recurring?.interval || 'month';

            // Find user by customerId (Robust Search)
            let userDoc = null;

            // 1. Try Legacy ID
            const legacySnap = await adminDb.collection("users").where("stripeCustomerId", "==", customerId).get();
            if (!legacySnap.empty) {
                userDoc = legacySnap.docs[0];
            } else {
                // 2. Try Test ID
                const testSnap = await adminDb.collection("users").where("stripeIds.test", "==", customerId).get();
                if (!testSnap.empty) {
                    userDoc = testSnap.docs[0];
                } else {
                    // 3. Try Live ID
                    const liveSnap = await adminDb.collection("users").where("stripeIds.live", "==", customerId).get();
                    if (!liveSnap.empty) {
                        userDoc = liveSnap.docs[0];
                    }
                }
            }

            if (userDoc) {
                await userDoc.ref.update({
                    subscriptionStatus: status,
                    currentPeriodEnd: currentPeriodEnd,
                    cancelAtPeriodEnd: cancelAtPeriodEnd,
                    planInterval: planInterval,
                    isPro: status === 'active' || status === 'trialing' || status === 'past_due'
                });
                console.log(`[Webhook] User ${userDoc.id} subscription updated: ${status}`);
                return NextResponse.json({ received: true, status: "updated", uid: userDoc.id });
            } else {
                console.log(`[Webhook] No user found for customer ${customerId}`);
                return NextResponse.json({ received: true, status: "ignored_no_user_found", customerId }, { status: 200 }); // 200 to verify logic ran
            }
        }
    } catch (error: any) {
        console.error("Webhook processing logic failed", error);
        return NextResponse.json({
            error: `Processing logic failed: ${error.message || error}`,
            stack: error.stack
        }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
