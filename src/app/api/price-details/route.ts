import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
    try {
        const { priceId, env } = await req.json(); // env: 'test' | 'live'

        if (!priceId || !env) {
            return NextResponse.json({ error: "Missing priceId or env" }, { status: 400 });
        }

        const apiKey = env === 'live'
            ? process.env.STRIPE_SECRET_KEY_LIVE
            : process.env.STRIPE_SECRET_KEY_TEST;

        if (!apiKey) {
            return NextResponse.json({ error: `Missing Stripe API Key for env: ${env}` }, { status: 500 });
        }
        const stripe = new Stripe(apiKey, {
            apiVersion: "2025-12-15.clover" as any,
            typescript: true,
        });

        const price = await stripe.prices.retrieve(priceId);

        let formattedPrice = 'N/A';
        if (price.unit_amount !== null && price.currency) {
            formattedPrice = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: price.currency,
            }).format(price.unit_amount / 100);
        }

        return NextResponse.json({
            received: true,
            priceId: price.id,
            currency: price.currency,
            amount: price.unit_amount,
            displayString: formattedPrice
        });

    } catch (error: any) {
        console.error("Stripe Price Fetch Error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch price" }, { status: 500 });
    }
}
