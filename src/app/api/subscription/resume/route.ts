import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import Stripe from "stripe";
import { AppConfig } from "@/lib/types";

export async function POST(req: NextRequest) {
    try {
        const idToken = req.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // 1. Get User Subscription ID
        const userDoc = await adminDb.collection("users").doc(uid).get();
        const userData = userDoc.data();
        const subscriptionId = userData?.subscriptionId;

        if (!subscriptionId) {
            return NextResponse.json({ error: "No subscription found" }, { status: 404 });
        }

        // 2. Init Stripe
        const configDoc = await adminDb.collection("app_config").doc("subscription_settings").get();
        const config = configDoc.data() as AppConfig;
        const mode = config?.mode || 'test';
        const apiKey = mode === 'live' ? process.env.STRIPE_SECRET_KEY_LIVE : process.env.STRIPE_SECRET_KEY_TEST;

        if (!apiKey) return NextResponse.json({ error: "Stripe Config Missing" }, { status: 500 });

        const stripe = new Stripe(apiKey, { apiVersion: "2025-12-15.clover" as any });

        // 3. Reactivate Subscription
        const sub = await stripe.subscriptions.update(subscriptionId, {
            cancel_at_period_end: false,
        });

        // 4. Update Firestore
        await adminDb.collection("users").doc(uid).update({
            cancelAtPeriodEnd: false,
            subscriptionStatus: sub.status, // Should be 'active'
            // We might want to clear currentPeriodEnd fallback if it was set from cancel_at, 
            // but usually we just keep tracking the period end.
            // If we used `cancel_at` as fallback for `currentPeriodEnd` in Sync, 
            // we should probably refresh the real current_period_end now.
            currentPeriodEnd: new Date((sub as any).current_period_end * 1000)
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Resume Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
