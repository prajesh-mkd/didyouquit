import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
    try {
        const { stripeCustomerId, uid } = await req.json();

        if (!stripeCustomerId) {
            return NextResponse.json({ error: "No customer ID provided" }, { status: 400 });
        }

        // Default to config-based mode, but override if we detect specific ID match
        const configDoc = await adminDb.collection("app_config").doc("subscription_settings").get();
        const config = configDoc.data() as any;
        const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || 'production') as 'development' | 'production';
        let mode = config.modes?.[appEnv] || config.mode || 'test';

        // --- SMART MODE RESOLUTION ---
        if (uid) {
            const userDoc = await adminDb.collection('users').doc(uid).get();
            const userData = userDoc.data();
            if (userData?.stripeIds) {
                if (userData.stripeIds.test === stripeCustomerId) {
                    mode = 'test';
                    console.log(`[Portal] ID ${stripeCustomerId} matched TEST mode.`);
                } else if (userData.stripeIds.live === stripeCustomerId) {
                    mode = 'live';
                    console.log(`[Portal] ID ${stripeCustomerId} matched LIVE mode.`);
                }
            } else {
                console.log(`[Portal] No stripeIds map found for user ${uid}, using default mode: ${mode}`);
            }
        }

        const apiKey = mode === 'live'
            ? process.env.STRIPE_SECRET_KEY_LIVE
            : process.env.STRIPE_SECRET_KEY_TEST;

        const portalConfigId = config?.[mode]?.portalConfigId;

        if (!apiKey) {
            return NextResponse.json({ error: `Stripe Config Missing for mode: ${mode}` }, { status: 500 });
        }

        const stripe = new Stripe(apiKey, { apiVersion: "2025-12-15.clover" as any });

        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${req.headers.get("origin")}/subscription`,
            configuration: portalConfigId
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error("[Portal Error]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
