
export interface UserProfile {
    uid: string;
    username: string;
    displayName: string | null;
    photoURL: string | null;
    email: string | null;
    createdAt: any; // Firestore Timestamp
    country?: string; // e.g. "US", "IN"

    // Subscription / Monetization
    subscriptionStatus?: 'active' | 'past_due' | 'canceled' | 'none' | 'trialing' | 'unpaid';
    stripeCustomerId?: string; // Legacy/Default
    subscriptionId?: string;   // Legacy/Default
    stripeIds?: {
        test?: string; // customer_...
        live?: string; // customer_...
    };
    subscriptionIds?: {
        test?: string; // sub_...
        live?: string; // sub_...
    };
    currentPeriodEnd?: any; // Firestore Timestamp or string
    cancelAtPeriodEnd?: boolean;
    planInterval?: 'month' | 'year';
    isPro?: boolean; // Convenience flag
}

export interface AppConfig {
    mode: 'test' | 'live'; // Deprecated, but kept for migration/fallback
    modes?: {
        production: 'test' | 'live';
        development: 'test' | 'live';
    };
    strategy: 'sale' | 'regular';
    test: EnvironmentConfig;
    live: EnvironmentConfig;
}

export interface EnvironmentConfig {
    sale: PricingTier;
    regular: PricingTier;
}

export interface PricingTier {
    monthlyPriceId: string;
    yearlyPriceId: string;
    displayMonthly: string;
    displayYearly: string;
    marketingHeader: string;
    marketingSubtext: string;
    features: string[];
    crossoutMonthly?: string;
    crossoutYearly?: string;
    promoMonthly?: string;
    promoYearly?: string;
}
