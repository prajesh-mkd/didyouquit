import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb } from "@/lib/firebase-admin";
import { AppConfig } from "@/lib/types";

export async function POST(req: NextRequest) {
    try {
        const { uid, email, interval } = await req.json(); // interval: 'month' | 'year'

        if (!uid || !email) {
            return NextResponse.json({ error: "Missing user data" }, { status: 400 });
        }

        // 1. Fetch App Config via Admin SDK
        const configDoc = await adminDb.collection("app_config").doc("subscription_settings").get();
        if (!configDoc.exists) {
            return NextResponse.json({ error: "Configuration missing" }, { status: 500 });
        }
        const config = configDoc.data() as AppConfig;

        // 2. Determine Mode & Keys
        const mode = config.mode || 'test';
        const apiKey = mode === 'live'
            ? process.env.STRIPE_SECRET_KEY_LIVE
            : process.env.STRIPE_SECRET_KEY_TEST;

        if (!apiKey) {
            return NextResponse.json({ error: `Missing Stripe API Key for mode: ${mode}` }, { status: 500 });
        }

        const stripe = new Stripe(apiKey, {
            apiVersion: "2025-01-27.acacia",
        });

        // 3. Determine Price ID
        const tier = config.activeTier || 'promo_jan';
        const tierConfig = (config as any)[tier]; // e.g. config.promo_jan

        if (!tierConfig) {
            return NextResponse.json({ error: `Invalid tier configuration: ${tier}` }, { status: 500 });
        }

        const priceId = interval === 'year' ? tierConfig.yearlyPriceId : tierConfig.monthlyPriceId;

        if (!priceId) {
            return NextResponse.json({ error: "Price ID not configured in settings." }, { status: 400 });
        }

        // 4. Create Session
        const session = await stripe.checkout.sessions.create({
            customer_email: email,
            metadata: {
                uid: uid,
            },
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: "subscription",
            success_url: `${req.headers.get("origin")}/my-resolutions?success=true`,
            cancel_url: `${req.headers.get("origin")}/my-resolutions?canceled=true`,
            // Optional: allow promotion codes
            allow_promotion_codes: true,
        });

        return NextResponse.json({ sessionId: session.id });
    } catch (err: any) {
        console.error("Checkout Session Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
