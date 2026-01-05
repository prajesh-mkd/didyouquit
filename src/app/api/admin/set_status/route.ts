import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { headers } from "next/headers";

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

        // Calculate isPro based on our new logic
        // active, trialing, past_due => Pro
        // unpaid, canceled, none => Not Pro
        const isPro = ['active', 'trialing', 'past_due'].includes(status);

        await adminDb.collection("users").doc(uid).update({
            subscriptionStatus: status,
            isPro: isPro
        });

        return NextResponse.json({ success: true, status, isPro });

    } catch (error: any) {
        console.error("Set Status Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
