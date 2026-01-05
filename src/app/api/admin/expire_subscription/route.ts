import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
        return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
    }

    try {
        const idToken = req.headers.get("Authorization")?.split("Bearer ")[1];
        if (!idToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // Force update to expired state
        // Set date to yesterday to ensure it's in the past
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        await adminDb.collection("users").doc(uid).update({
            subscriptionStatus: 'canceled',
            currentPeriodEnd: yesterday, // Firestore Timestamp conversion happens automatically or matches Date
            cancelAtPeriodEnd: false, // Since it's already canceled/expired
            isPro: false
        });

        return NextResponse.json({ success: true, message: "Subscription forcefully expired (simulated)" });

    } catch (error: any) {
        console.error("Expire Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
