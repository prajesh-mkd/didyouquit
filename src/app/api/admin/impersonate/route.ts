
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: Request) {
    try {
        // 1. Verify Super Admin
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);

        // Strict Super Admin Check
        const SUPER_ADMINS = ['contact@didyouquit.com'];
        if (!decodedToken.email || !SUPER_ADMINS.includes(decodedToken.email)) {
            return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 });
        }

        const { targetUid } = await req.json();

        // 2. If targetUid is provided, we are IMPERSONATING
        if (targetUid) {
            // Safety: Verify target is Simulated
            const userDoc = await adminDb.collection('users').doc(targetUid).get();
            if (!userDoc.exists || !userDoc.data()?.isSimulated) {
                return NextResponse.json({ error: 'Can only impersonate Simulated Users' }, { status: 403 });
            }

            // Mint Token for Target
            const targetToken = await adminAuth.createCustomToken(targetUid);

            // Mint Token for Admin (Self) - to stash for return
            const adminToken = await adminAuth.createCustomToken(decodedToken.uid);

            return NextResponse.json({
                success: true,
                targetToken,
                adminToken
            });
        }

        return NextResponse.json({ error: 'Missing targetUid' }, { status: 400 });

    } catch (error: any) {
        console.error('Impersonation Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
