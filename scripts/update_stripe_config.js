const admin = require('firebase-admin');
const path = require('path');

// 1. Load Service Account
// We know it's in the root
const serviceAccountPath = path.join(__dirname, '..', 'didyouquit-17e0a-firebase-adminsdk-fbsvc-7e438fe988.json');
const serviceAccount = require(serviceAccountPath);

// 2. Initialize Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 3. Update Configuration
async function updateConfig() {
    console.log("Updating Firestore 'app_config/subscription_settings'...");

    const configRef = db.collection('app_config').doc('subscription_settings');

    // We set the structure exactly as the app expects
    const data = {
        mode: 'test',
        activeTier: 'promo_jan',
        promo_jan: {
            marketingHeader: 'Pro Membership',
            marketingSubtext: 'Unlock unlimited resolutions & analytics.',
            displayMonthly: '$1.99',
            displayYearly: '$19.99',
            monthlyPriceId: 'price_1SlbcNGYyqOLcT4Y3EqK37Fp',
            yearlyPriceId: 'price_1SlbdtGYyqOLcT4YqtGZE08n'
        }
    };

    try {
        await configRef.set(data, { merge: true });
        console.log("✅ Success! Firestore updated with new Price IDs.");
        console.log("   Monthly: price_1SlbcNGYyqOLcT4Y3EqK37Fp");
        console.log("   Yearly:  price_1SlbdtGYyqOLcT4YqtGZE08n");
    } catch (error) {
        console.error("❌ Failed to update config:", error);
    }
}

updateConfig();
