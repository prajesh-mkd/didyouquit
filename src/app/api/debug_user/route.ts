import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    const secret = searchParams.get('secret');

    // Simple protection
    if (secret !== 'antigravity_debug_123') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!uid) {
        return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    }

    try {
        const docSnap = await adminDb.collection('users').doc(uid).get();
        if (!docSnap.exists) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const data = docSnap.data();

        // Serialize Timestamps for readout
        const serialized = {};
        for (const [key, value] of Object.entries(data || {})) {
            if (value && typeof value === 'object' && 'toDate' in value) {
                // It's a timestamp
                (serialized as any)[key] = {
                    _type: 'Timestamp',
                    seconds: value.seconds,
                    nanoseconds: value.nanoseconds,
                    toDate: value.toDate().toISOString()
                };
            } else if (value instanceof Date) {
                (serialized as any)[key] = {
                    _type: 'Date',
                    iso: value.toISOString()
                };
            } else {
                (serialized as any)[key] = value;
            }
        }

        if (searchParams.get('fix_customer_id')) {
            const newId = searchParams.get('fix_customer_id');
            await adminDb.collection('users').doc(uid).update({
                'stripeIds.test': newId,
                'stripeCustomerId': newId // Keep legacy in sync
            });
            return NextResponse.json({ success: true, message: `Updated Stripe ID to ${newId}` });
        }

        return NextResponse.json({ uid, data: serialized });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
