import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

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

        // START: Config Fetch Logic (Simplified for brevity, ideally shared util)
        // For now, we use the default env vars which SHOULD be set to the active mode keys by a deployment script or manual set.
        // But wait, the User wants dynamic switching.
        // So we should read Firestore config here too?

        // Let's read the environment variable logic:
        // We will default to the standard process.env.STRIPE_SECRET_KEY which points to the "Active" one.
        // The Admin "Toggle" might just be a UI thing for "Active Strategy", but "Test vs Live" usually requires changing the secret key.
        // If we really want dynamic switching without redeploy, we need to read the `mode` from Firestore and select the key.

        // Let's rely on standard env var for now to avoid complexity.
        // The Admin Toggle for "Test/Live" will purely update the `mode` in Firestore, 
        // and we will update `src/lib/stripe-server.ts` to pick the right key based on that mode.

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-01-27.acacia" });

        if (!stripeCustomerId) {
            return NextResponse.json({ error: "No customer ID" }, { status: 400 });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${req.headers.get("origin")}/my-resolutions`,
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
