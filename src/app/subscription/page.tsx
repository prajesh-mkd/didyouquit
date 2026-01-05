"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, CreditCard, ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { PaywallModal } from "@/components/subscription/PaywallModal";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AppConfig } from "@/lib/types";

export default function SubscriptionPage() {
    const { user, userData, loading: authLoading } = useAuth();
    const router = useRouter();
    const [loadingPortal, setLoadingPortal] = useState(false);
    const [loadingSync, setLoadingSync] = useState(false);
    const [loadingResume, setLoadingResume] = useState(false);
    const [loadingExpire, setLoadingExpire] = useState(false);
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [showPaywall, setShowPaywall] = useState(false);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const snap = await getDoc(doc(db, "app_config", "subscription_settings"));
                if (snap.exists()) {
                    setConfig(snap.data() as AppConfig);
                }
            } catch (error) {
                console.error("Failed to load subs settings", error);
            }
        };
        fetchConfig();
    }, []);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/");
        }
    }, [authLoading, user, router]);

    const handleManageSubscription = async () => {
        if (!userData?.stripeCustomerId) return;
        setLoadingPortal(true);
        try {
            const res = await fetch('/api/portal_session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stripeCustomerId: userData.stripeCustomerId })
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                toast.error("Could not redirect to subscription portal.");
                setLoadingPortal(false);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load portal");
            setLoadingPortal(false);
        }
    };

    const handleResume = async () => {
        if (!user) return;
        setLoadingResume(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/subscription/resume', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Membership Resumed!");
                window.location.reload();
            } else {
                toast.error(data.error || "Failed to resume");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error resuming membership");
        } finally {
            setLoadingResume(false);
        }
    };

    const handleSync = async () => {
        if (!user) return;
        setLoadingSync(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/subscription/sync', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();

            if (data.success) {
                toast.success("Subscription updated!");
                // Force reload to get fresh data
                window.location.reload();
            } else if (data.status === 'none') {
                toast.info("No active subscription found.");
            } else {
                toast.error(data.error || "Sync failed.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to sync subscription");
        } finally {
            setLoadingSync(false);
        }
    };

    const handleExpire = async () => {
        if (!user) return;
        setLoadingExpire(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/expire_subscription', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Simulated Expiry: Subscription is now Canceled/Inactive");
                window.location.reload();
            } else {
                toast.error(data.error || "Failed to expire");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to call expire endpoint");
        } finally {
            setLoadingExpire(false);
        }
    };

    if (authLoading || !userData) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F0FDF4]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    const isPro = userData.isPro;
    const planInterval = userData.planInterval === 'year' ? 'Yearly' : 'Monthly';

    // Parse date from Firestore Timestamp or string
    let renewalDate: Date | null = null;
    if (userData.currentPeriodEnd) {
        if (userData.currentPeriodEnd.seconds) {
            renewalDate = new Date(userData.currentPeriodEnd.seconds * 1000);
        } else if (typeof userData.currentPeriodEnd === 'string') {
            renewalDate = new Date(userData.currentPeriodEnd);
        }
    }

    const isCanceled = userData.cancelAtPeriodEnd;

    // Get active pricing details
    const mode = config?.mode || 'test';
    const strategy = config?.strategy || 'sale';

    const pricing = {
        features: ['Unlimited Resolutions', 'Advanced Analytics', 'Community Badges'],
        displayMonthly: '$1.99',
        displayYearly: '$19.99',
        marketingHeader: 'Start Your Journey',
        marketingSubtext: 'Invest in yourself today.',
        ...(config?.[mode]?.[strategy] || {})
    };

    const isDev = process.env.NODE_ENV === 'development';

    return (
        <div className="min-h-screen flex flex-col bg-[#F0FDF4]">
            <Header />
            <main className="container max-w-4xl py-12 px-4 flex-1">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-emerald-950">Subscription Management</h1>
                    <p className="text-emerald-800/60 mt-2">Manage your plan, billing details, and subscription status.</p>
                </div>

                <div className="grid gap-6">
                    {/* Status Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {isPro ? (
                                    <Button
                                        onClick={handleManageSubscription}
                                        disabled={loadingPortal}
                                        className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 shadow-sm"
                                    >
                                        {loadingPortal ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <CreditCard className="mr-2 h-4 w-4" />
                                        )}
                                        Manage Subscription
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            onClick={() => setShowPaywall(true)}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                                        >
                                            View Plans
                                        </Button>
                                        {isDev && (
                                            <Button
                                                variant="outline"
                                                onClick={handleSync}
                                                disabled={loadingSync}
                                                className="border-slate-200 text-slate-600 hover:bg-slate-50"
                                            >
                                                {loadingSync ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="mr-2 h-4 w-4" />
                                                )}
                                                Refresh Status
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                {isDev && (
                                    <>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleSync}
                                            disabled={loadingSync}
                                            className="h-8 w-8 text-slate-400 hover:text-emerald-600"
                                            title="Refresh Subscription Status (Dev Only)"
                                        >
                                            <RefreshCw className={cn("h-4 w-4", loadingSync && "animate-spin")} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={handleExpire}
                                            disabled={loadingExpire}
                                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                                            title="Debug: Simulate Expiry (Time Travel)"
                                        >
                                            <AlertCircle className={cn("h-4 w-4", loadingExpire && "animate-pulse")} />
                                        </Button>
                                    </>
                                )}
                                {isPro ? (
                                    <div className="flex flex-col items-end">
                                        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 border border-emerald-200">
                                            Active
                                        </span>
                                        {isCanceled && renewalDate && (
                                            <span className="text-[10px] font-medium text-amber-600 mt-2">
                                                Cancels {renewalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide bg-slate-100 text-slate-500 border border-slate-200">
                                        Inactive
                                    </span>
                                )}
                            </div>
                        </div>


                    </div>

                    {/* FAQ / Info Section could go here */}


                </div>
            </main>
            <Footer />
            <PaywallModal
                open={showPaywall}
                onOpenChange={setShowPaywall}
                pricing={pricing}
                user={user}
            />
        </div>
    );
}
