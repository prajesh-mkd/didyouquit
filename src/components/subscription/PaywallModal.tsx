"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { User } from "firebase/auth";

interface PaywallModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pricing: any; // We'll infer structure or import type if strictly needed, but flexible for now
    user: User | null;
}

export function PaywallModal({ open, onOpenChange, pricing, user }: PaywallModalProps) {
    const [loadingCheckout, setLoadingCheckout] = useState<'month' | 'year' | null>(null);

    const handleSubscribe = async (interval: 'month' | 'year') => {
        if (!user) {
            toast.error("Please log in to subscribe.");
            return;
        }
        setLoadingCheckout(interval);
        try {
            const res = await fetch('/api/checkout_session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    interval
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            if (data.url) {
                window.location.href = data.url;
            } else {
                toast.error("Failed to start checkout: No URL returned");
            }
        } catch (error: any) {
            toast.error(error.message || "Checkout failed");
        } finally {
            setLoadingCheckout(null);
        }
    };

    const renderPrice = (price: string) => {
        if (!price) return null;
        const parts = price.split('.');
        if (parts.length === 2) {
            return (
                <div className="flex items-baseline text-slate-900 font-bold">
                    <span className="text-3xl">{parts[0]}</span>
                    <span className="text-lg font-semibold text-slate-800">.{parts[1]}</span>
                </div>
            );
        }
        return <span className="text-3xl font-bold text-slate-900">{price}</span>;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center text-emerald-950">
                        {pricing.marketingHeader || "Unleash Your Potential"}
                    </DialogTitle>
                    <DialogDescription className="text-center text-base">
                        {pricing.marketingSubtext || "Join the community of doers."}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-2">
                        <ul className="space-y-2 text-sm text-emerald-900">
                            {(pricing.features || []).map((feature: string, i: number) => (
                                <li key={i} className="flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {feature}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => handleSubscribe('month')}
                            disabled={!!loadingCheckout}
                            className="relative flex flex-col items-center justify-center p-4 border border-slate-300 rounded-xl hover:border-emerald-500 hover:bg-emerald-50/50 transition-all"
                        >
                            <span className="text-sm font-medium text-slate-500">Monthly</span>
                            <div className="flex items-center gap-2">
                                {pricing.crossoutMonthly && (
                                    <span className="text-sm text-slate-400 line-through">{pricing.crossoutMonthly}</span>
                                )}
                                {pricing.promoMonthly && (
                                    <span className="text-sm font-bold text-emerald-700">{pricing.promoMonthly}</span>
                                )}
                                {renderPrice(pricing.displayMonthly)}
                            </div>
                            {loadingCheckout === 'month' && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl">
                                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                                </div>
                            )}
                        </button>
                        <button
                            onClick={() => handleSubscribe('year')}
                            disabled={!!loadingCheckout}
                            className="relative flex flex-col items-center justify-center p-4 border-2 border-emerald-500 bg-emerald-50/10 hover:bg-emerald-50/50 transition-all rounded-xl overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] px-2 py-0.5 font-bold rounded-bl-lg">BEST VALUE</div>
                            <span className="text-sm font-medium text-slate-500 mt-2">Yearly</span>
                            <div className="flex items-center gap-2">
                                {pricing.crossoutYearly && (
                                    <span className="text-sm text-slate-400 line-through font-semibold opacity-70">{pricing.crossoutYearly}</span>
                                )}
                                {pricing.promoYearly && (
                                    <span className="text-sm font-bold text-emerald-700">{pricing.promoYearly}</span>
                                )}
                                {renderPrice(pricing.displayYearly)}
                            </div>
                            {loadingCheckout === 'year' && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl z-10">
                                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                                </div>
                            )}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
