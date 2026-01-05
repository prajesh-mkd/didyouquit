import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import Stripe from "stripe";
import { AppConfig } from "@/lib/types";

export async function POST(req: NextRequest) {
    try {
        const idToken = req.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(idToken);
        } catch (authError: any) {
            console.error("Admin Auth Verification Failed:", authError);
            return NextResponse.json({ error: `Auth Error: ${authError.message}` }, { status: 401 });
        }
        const uid = decodedToken.uid;

        // 1. Fetch User Data
        let userData;
        try {
            const userDoc = await adminDb.collection("users").doc(uid).get();
            userData = userDoc.data();
        } catch (dbError: any) {
            console.error("Admin DB Read Failed:", dbError);
            return NextResponse.json({ error: `DB Error: ${dbError.message}` }, { status: 500 });
        }

        // 2. Init Stripe (Moved up to allow customer search)
        const configDoc = await adminDb.collection("app_config").doc("subscription_settings").get();
        const config = configDoc.data() as AppConfig;
        const mode = config?.mode || 'test';
        const apiKey = mode === 'live'
            ? process.env.STRIPE_SECRET_KEY_LIVE
            : process.env.STRIPE_SECRET_KEY_TEST;

        if (!apiKey) {
            return NextResponse.json({ error: "Stripe Config Missing" }, { status: 500 });
        }

        const stripe = new Stripe(apiKey, {
            apiVersion: "2025-12-15.clover" as any,
        });

        // 3. Resolve Stripe Customer ID
        let stripeCustomerId = userData?.stripeCustomerId;

        if (!stripeCustomerId) {
            console.log("Sync: No local stripeCustomerId. Searching Stripe by email...");
            // Fallback: Search by email
            let email = userData?.email;
            if (!email) {
                const authUser = await adminAuth.getUser(uid);
                email = authUser.email;
            }

            if (!email) {
                return NextResponse.json({ error: "No email found for user to search Stripe." }, { status: 400 });
            }

            const customers = await stripe.customers.list({
                email: email,
                limit: 1
            });

            if (customers.data.length > 0) {
                stripeCustomerId = customers.data[0].id;
                console.log("Sync: Found Customer ID via email match:", stripeCustomerId);
                // Save it for future
                await adminDb.collection("users").doc(uid).update({ stripeCustomerId });
            } else {
                return NextResponse.json({ error: `No Stripe Customer found for email: ${email}. Please subscribe first.` }, { status: 404 });
            }
        }

        // 4. List Subscriptions
        const subs = await stripe.subscriptions.list({
            customer: stripeCustomerId,
            status: 'all',
            limit: 1,
        });

        if (subs.data.length === 0) {
            return NextResponse.json({ message: "No subscriptions found", status: 'none' });
        }

        const sub = subs.data[0] as any;
        const status = sub.status;
        console.log(`[Sync] Found Sub: ${sub.id}, Status: ${status}, CancelAtPeriodEnd: ${sub.cancel_at_period_end}`);

        let currentPeriodEnd = null;
        if (sub.current_period_end) {
            currentPeriodEnd = new Date(sub.current_period_end * 1000);
        } else if (sub.cancel_at) {
            // Fallback: If current_period_end is missing but we have a cancel date, use that
            currentPeriodEnd = new Date(sub.cancel_at * 1000);
        }

        // Fix: logic to determine if canceling
        const cancelAtPeriodEnd = sub.cancel_at_period_end || (sub.cancel_at !== null && sub.cancel_at !== undefined);
        const planInterval = sub.items?.data[0]?.price?.recurring?.interval || 'month';

        // 4. Update Firestore
        await adminDb.collection("users").doc(uid).update({
            subscriptionStatus: status,
            subscriptionId: sub.id,
            currentPeriodEnd: currentPeriodEnd,
            cancelAtPeriodEnd: cancelAtPeriodEnd,
            planInterval: planInterval,
            isPro: status === 'active' || status === 'trialing'
        });

        return NextResponse.json({
            success: true,
            status,
            isPro: status === 'active' || status === 'trialing'
        });

    } catch (error: any) {
        console.error("Sync Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
