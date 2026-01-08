
const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkUser(email) {
    console.log(`Searching for user with email: ${email}...`);
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();

    if (snapshot.empty) {
        console.log('No user found.');
        return;
    }

    snapshot.forEach(doc => {
        console.log('User ID:', doc.id);
        const data = doc.data();
        console.log('Subscription Status:', data.subscriptionStatus);
        console.log('Stripe Customer ID:', data.stripeCustomerId);
        console.log('Stripe IDs Map:', JSON.stringify(data.stripeIds, null, 2));
        console.log('Is Pro?', data.isPro);
        console.log('Plan Interval:', data.planInterval);
    });
}

checkUser('contact@didyouquit.com');
