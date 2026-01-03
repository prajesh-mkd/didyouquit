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

    let event: Stripe.Event;
    // We instantiate with a default key just to get value-added types.
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2025-01-27.acacia" });

    try {
        event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
        console.error("Webhook Signature Verification Failed", err.message);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // Handle the event
    try {
        if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const uid = session.metadata?.uid;
            const customerId = session.customer as string;
            const subscriptionId = session.subscription as string;

            if (uid) {
                await adminDb.collection("users").doc(uid).update({
                    subscriptionStatus: 'active',
                    stripeCustomerId: customerId,
                    subscriptionId: subscriptionId,
                    isPro: true
                });
                console.log(`[Webhook] User ${uid} upgraded to PRO.`);
            }
        }
        else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
            const sub = event.data.object as Stripe.Subscription;
            const customerId = sub.customer as string;
            const status = sub.status; // 'active', 'canceled', 'past_due'

            // Find user by customerId
            const usersSnap = await adminDb.collection("users").where("stripeCustomerId", "==", customerId).get();
            if (!usersSnap.empty) {
                const userDoc = usersSnap.docs[0];
                await userDoc.ref.update({
                    subscriptionStatus: status,
                    isPro: status === 'active' || status === 'trialing'
                });
                console.log(`[Webhook] User ${userDoc.id} subscription updated: ${status}`);
            } else {
                console.log(`[Webhook] No user found for customer ${customerId}`);
            }
        }
    } catch (error) {
        console.error("Webhook processing logic failed", error);
        return NextResponse.json({ error: "Processing logic failed" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
