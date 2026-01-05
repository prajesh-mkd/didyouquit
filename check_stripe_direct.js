const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');

// Try to load env from .env.local
let secretKey = process.env.STRIPE_SECRET_KEY_TEST;

if (!secretKey) {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const match = envFile.match(/STRIPE_SECRET_KEY_TEST=(sk_test_[a-zA-Z0-9]+)/);
        if (match) {
            secretKey = match[1];
        }
    } catch (e) {
        console.log("Could not read .env.local");
    }
}

if (!secretKey) {
    console.error("No STRIPE_SECRET_KEY_TEST found.");
    process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: '2025-12-15.clover' });

async function check() {
    const customerId = "cus_TjADZjZn0sHhmB";
    console.log(`Checking customer: ${customerId}`);

    try {
        const subs = await stripe.subscriptions.list({
            customer: customerId,
            status: 'all',
            limit: 5
        });

        console.log(`Found ${subs.data.length} subscriptions.`);
        subs.data.forEach(sub => {
            console.log(`ID: ${sub.id}`);
            console.log(`Status: ${sub.status}`);
            console.log(`Cancel At Period End: ${sub.cancel_at_period_end}`);
            console.log(`Cancel At: ${sub.cancel_at}`);
            console.log(`Current Period End (Raw): ${sub.current_period_end}`);
            console.log("-------------------");
        });

    } catch (e) {
        console.error(e);
    }
}

check();
