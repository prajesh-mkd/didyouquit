
const admin = require('firebase-admin');
const serviceAccount = require('../didyouquit-17e0a-firebase-adminsdk-fbsvc-7e438fe988.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function fixGhostUser(email) {
    console.log(`Fixing ghost user: ${email}...`);
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();

    if (snapshot.empty) {
        console.log('No user found.');
        return;
    }

    snapshot.forEach(async doc => {
        console.log(`Found User ID: ${doc.id}`);

        // We only clear the Stripe/Subscription fields.
        // We DO NOT delete the user, so Admin access (based on UID/Email) should remain safe.
        await doc.ref.update({
            stripeCustomerId: admin.firestore.FieldValue.delete(),
            subscriptionStatus: 'canceled', // Reset to 'free' state
            stripeIds: admin.firestore.FieldValue.delete(), // Clear the map of bad IDs
            isPro: false,
            subscriptionId: admin.firestore.FieldValue.delete(),
            currentPeriodEnd: admin.firestore.FieldValue.delete()
        });

        console.log(`✅ Successfully wiped legacy Stripe data for ${email}.`);
        console.log(`They can now re-subscribe to generate a valid ID in the new Stripe account.`);
    });
}

fixGhostUser('contact@didyouquit.com');
