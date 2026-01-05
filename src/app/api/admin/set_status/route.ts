import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
    try {
        const { uid, status } = await req.json();

        // Verify Super Admin
        const headerList = await headers();
        const authorization = headerList.get("Authorization");
        if (!authorization?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const token = authorization.split("Bearer ")[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        if (decodedToken.email !== 'contact@didyouquit.com') {
            return NextResponse.json({ error: "Forbidden: Super Admin Only" }, { status: 403 });
        }

        if (!uid || !status) {
            return NextResponse.json({ error: "Missing uid or status" }, { status: 400 });
        }

        let finalStatus = status;
        let finalIsPro = false;

        if (status === 'sync') {
            // === FORCE SYNC WITH STRIPE ===
            // 1. Get Config to find Mode & Keys
            const configDoc = await adminDb.collection("app_config").doc("subscription_settings").get();
            const config = configDoc.data() as any;

            // Environment-Scoped Monetization
            const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || 'production') as 'development' | 'production';
            const mode = config.modes?.[appEnv] || config.mode || 'test';

            const apiKey = mode === 'live'
                ? process.env.STRIPE_SECRET_KEY_LIVE
                : process.env.STRIPE_SECRET_KEY_TEST;

            if (!apiKey) {
                // Fail safe: If no API key, assume valid check cannot be done -> safely default to free.
                console.error("Missing Stripe Config for Sync. Defaulting to Unpaid.");
                finalStatus = 'unpaid';
                finalIsPro = false;
            } else {
                const stripe = new Stripe(apiKey, { apiVersion: '2025-12-15.clover' }); // Use latest or matching version

                // 2. Get User's Stripe Customer ID
                const userDoc = await adminDb.collection("users").doc(uid).get();
                const userData = userDoc.data();

                // Prioritize Dual-Mode IDs
                let stripeCustomerId = userData?.stripeIds?.[mode];

                // Fallback to legacy if mode match or if using legacy data
                if (!stripeCustomerId && userData?.stripeCustomerId) {
                    stripeCustomerId = userData.stripeCustomerId;
                }

                if (!stripeCustomerId) {
                    finalStatus = 'unpaid';
                    finalIsPro = false;
                } else {
                    // 3. Fetch Subscription from Stripe
                    const subscriptions = await stripe.subscriptions.list({
                        customer: stripeCustomerId,
                        limit: 1,
                        status: 'all', // Get any status
                        expand: ['data.default_payment_method']
                    });

                    if (subscriptions.data.length === 0) {
                        finalStatus = 'unpaid';
                        finalIsPro = false;
                    } else {
                        // Use the status of the most recent subscription
                        const sub = subscriptions.data[0];
                        finalStatus = sub.status;
                        // active, trialing, past_due => Pro
                        finalIsPro = ['active', 'trialing', 'past_due'].includes(sub.status);
                    }
                }
            }
        } else {
            // === MANUAL FORCE ===
            finalStatus = status;
            // active, trialing, past_due => Pro
            finalIsPro = ['active', 'trialing', 'past_due'].includes(status);
        }

        await adminDb.collection("users").doc(uid).update({
            subscriptionStatus: finalStatus,
            isPro: finalIsPro
        });

        return NextResponse.json({ success: true, status: finalStatus, isPro: finalIsPro, mode: status === 'sync' ? 'synced' : 'forced' });

    } catch (error: any) {
        console.error("Set Status Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
