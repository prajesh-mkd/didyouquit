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
        // Environment-Scoped Monetization
        // We detect the environment (development or production) and read the specific mode setting.
        const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || 'production') as 'development' | 'production';
        const mode = config.modes?.[appEnv] || config.mode || 'test';

        const apiKey = mode === 'live'
            ? process.env.STRIPE_SECRET_KEY_LIVE
            : process.env.STRIPE_SECRET_KEY_TEST;

        if (!apiKey) {
            return NextResponse.json({ error: `Missing Stripe API Key for mode: ${mode}` }, { status: 500 });
        }

        const stripe = new Stripe(apiKey, {
            apiVersion: "2025-12-15.clover" as any, // Cast to any to avoid strict type mismatch if needed, or matches lint
        });

        // 3. Determine Price ID
        // Logic: specific config based on mode (test/live) AND strategy (sale/regular)
        const envConfig = mode === 'live' ? config.live : config.test;
        const strategy = config.strategy || 'sale'; // Default to sale if missing
        const tierConfig = envConfig[strategy];

        if (!tierConfig) {
            return NextResponse.json({ error: `Invalid configuration for mode: ${mode}` }, { status: 500 });
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
            success_url: `${req.headers.get("origin")}/subscription?success=true`,
            cancel_url: `${req.headers.get("origin")}/subscription?canceled=true`,
            // Optional: allow promotion codes
            allow_promotion_codes: true,
        });

        return NextResponse.json({ sessionId: session.id, url: session.url });
    } catch (err: any) {
        console.error("Checkout Session Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
