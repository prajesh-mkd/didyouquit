
export interface UserProfile {
    uid: string;
    username: string;
    displayName: string | null;
    photoURL: string | null;
    email: string | null;
    createdAt: any; // Firestore Timestamp
    country?: string; // e.g. "US", "IN"

    // Subscription / Monetization
    subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'none';
    stripeCustomerId?: string;
    subscriptionId?: string;
    isPro?: boolean; // Convenience flag
}

export interface AppConfig {
    mode: 'test' | 'live';
    activeTier: string;
    promo_jan: PricingTier;
    standard: PricingTier;
}

export interface PricingTier {
    monthlyPriceId: string;
    yearlyPriceId: string;
    displayMonthly: string;
    displayYearly: string;
    marketingHeader: string;
    marketingSubtext: string;
}
