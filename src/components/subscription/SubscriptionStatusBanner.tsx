"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SubscriptionStatusBanner() {
    const { userData, loading } = useAuth();

    if (loading || !userData) return null;

    const status = userData.subscriptionStatus;

    if (status !== 'past_due' && status !== 'unpaid') {
        return null;
    }

    const bgColor = status === 'past_due' ? "bg-amber-600" : "bg-red-600";

    return (
        <div className={`${bgColor} text-white px-4 py-3 shadow-md relative z-50`}>
            <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <span className="font-medium">
                        {status === 'past_due'
                            ? "Your last payment failed. Please update your payment method to avoid losing Pro access."
                            : "Your subscription is suspended due to payment failure. Update payment to restore Pro access."}
                    </span>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    asChild
                    className={`whitespace-nowrap bg-white ${status === 'past_due' ? 'text-amber-700 hover:bg-amber-50' : 'text-red-600 hover:bg-red-50'}`}
                >
                    <Link href="/subscription">
                        Update Payment <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                </Button>
            </div>
        </div>
    );
}
