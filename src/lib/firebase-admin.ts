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

function initAdmin() {
    // [MODIFICATION] FOR LOCAL DEV:
    // We use a specifically named app "LOCAL_ADMIN" to avoid conflict with Next.js HMR/Default app issues.
    // If we have a Service Account Key locally, we use it to bypass ADC completely.
    try {
        // Use process.cwd() and fs to reliably find the file in Next.js server context without Webpack bundling issues
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const path = require("path");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require("fs");

        const serviceAccountPath = path.join(process.cwd(), "didyouquit-17e0a-firebase-adminsdk-fbsvc-7e438fe988.json");
        const fileContent = fs.readFileSync(serviceAccountPath, "utf8");
        const serviceAccount = JSON.parse(fileContent);

        // Check if "LOCAL_ADMIN_DEBUG" is already initialized
        const existingApp = getApps().find(app => app.name === "LOCAL_ADMIN_DEBUG");
        if (existingApp) {
            return existingApp;
        }

        console.log("[Firebase Admin] Initializing 'LOCAL_ADMIN_DEBUG' with explicit Service Account Key.");
        console.log(`[Firebase Admin] Key path: ${serviceAccountPath}`);

        return initializeApp({
            credential: cert(serviceAccount),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        }, "LOCAL_ADMIN_DEBUG");

    } catch (error) {
        console.error("[Firebase Admin] FATAL: Failed to load Service Account Key:", error);
        // Do NOT fallback. We need to know why this is failing.
        throw error;
    }
}

const adminApp = initAdmin();

// Export services bound to the specific app (adminApp)
// This works even if adminApp is 'LOCAL_ADMIN' or '[DEFAULT]'
export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
