import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// We need a Service Account for Admin SDK.
// BUT we heavily rely on "Automatic" credentials in some environments (like Cloud Functions / App Engine).
// In local dev, we might not have GOOGLE_APPLICATION_CREDENTIALS set.
// However, since this is a Next.js app, maybe we can use the CLIENT SDK in Node mode?
// Actually, `firebase-admin` requires credentials.
// If the user hasn't provided a service account JSON, we might be blocked on writing to Firestore from the backend if Rules block it.
// WORKAROUND: For the Stripe Webhook, maybe we use the "Test Mode" where we just Log for now, 
// OR we guide the user to download a service account?
// Wait, the user has `process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID`.
// 
// Let's TRY to initialize without explicit certs. In some local setups (logging in via `gcloud auth application-default login`), it works.
// If the user has `firebase-tools` installed and logged in, it might work?
//
// If this fails, the webhook will 500.

const firebaseAdminConfig = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

export function initAdmin() {
    if (getApps().length === 0) {
        initializeApp(firebaseAdminConfig);
    }
}

// We lazily initialize?
// Or just init at top level?
// Next.js hot reloading dislikes top-level side effects sometimes.
// But getApps().length check handles it.

if (getApps().length === 0) {
    try {
        initializeApp(firebaseAdminConfig);
    } catch (error) {
        console.error("Firebase Admin Init Error", error);
    }
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
