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
        const mode = config?.mode || 'test';
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
            return NextResponse.json({ error: "No customer ID" }, { status: 400 });
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
