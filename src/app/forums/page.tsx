"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { AppConfig } from "@/lib/types";
import { PaywallModal } from "@/components/subscription/PaywallModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DiscussionsTab } from "@/components/forums/DiscussionsTab";
import { WeeklyJournalsTab } from "@/components/forums/WeeklyJournalsTab";
import { NotificationsTab } from "@/components/forums/NotificationsTab";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

// Wrap contents in Suspense because usage of useSearchParams() causes client-side deopt
// if not wrapped in Suspense boundary when SSG/SSR involved?
// Actually in Next 13 App Router, page components using useSearchParams in 'use client' are fine usually?
// But let's build the inner component to be safe or just add it.

// Wait, I can't wrap 'export default function' easily without renaming.
// I'll just add the hook inside ForumsPage. "use client" is already set.

export default function ForumsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#F0FDF4]" />}>
            <ForumsContent />
        </Suspense>
    );
}

function ForumsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");
    const defaultTab = (tabParam === "general" || tabParam === "notifications") ? tabParam : "journals";

    const { user, userData, loading: authLoading } = useAuth();
    // ... rest of logic

    const [config, setConfig] = useState<AppConfig | null>(null);
    const [showPaywall, setShowPaywall] = useState(false);

    // Fetch config for paywall
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

    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F0FDF4]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <>
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-emerald-950">Community Forum</h1>
                <p className="text-emerald-800/60 mt-1">Discuss progress, challenges, share tips, and find support.</p>
            </div>

            <Tabs
                defaultValue="journals"
                value={defaultTab}
                onValueChange={(val) => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("tab", val);
                    router.push(`/forums?${params.toString()}`);
                }}
                className="w-full"
            >
                <TabsList className="grid w-full grid-cols-3 gap-1 mb-8 bg-emerald-100/50 p-1 rounded-xl">
                    <TabsTrigger value="journals" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm hover:bg-white/60 hover:text-emerald-900 transition-all">Weekly Journals</TabsTrigger>
                    <TabsTrigger value="general" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm hover:bg-white/60 hover:text-emerald-900 transition-all">General</TabsTrigger>
                    <TabsTrigger value="notifications" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm hover:bg-white/60 hover:text-emerald-900 transition-all">Notifications</TabsTrigger>
                </TabsList>

                <TabsContent value="journals" className="outline-none">
                    <WeeklyJournalsTab />
                </TabsContent>

                <TabsContent value="general" className="outline-none">
                    <DiscussionsTab onShowPaywall={() => setShowPaywall(true)} />
                </TabsContent>

                <TabsContent value="notifications" className="outline-none">
                    <NotificationsTab />
                </TabsContent>
            </Tabs>

            <PaywallModal
                open={showPaywall}
                onOpenChange={setShowPaywall}
                pricing={pricing}
                user={user}
            />
        </>
    );
}
