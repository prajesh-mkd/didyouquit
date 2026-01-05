"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/layout/Header";
import { Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { AppConfig } from "@/lib/types";
import { PaywallModal } from "@/components/subscription/PaywallModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DiscussionsTab } from "@/components/forums/DiscussionsTab";
import { WeeklyJournalsTab } from "@/components/forums/WeeklyJournalsTab";
import { NotificationsTab } from "@/components/forums/NotificationsTab";
import { Footer } from "@/components/layout/Footer";

export default function ForumsPage() {
    const { user, userData, loading: authLoading } = useAuth();
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
        <div className="min-h-screen flex flex-col bg-[#F0FDF4]">
            <Header />
            <main className="container py-8 px-4 flex-1 max-w-4xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-emerald-950">Community Forum</h1>
                    <p className="text-emerald-800/60 mt-1">Discuss progress, challenges, share tips, and find support.</p>
                </div>

                <Tabs defaultValue="discussions" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-8 bg-emerald-100/50 p-1 rounded-xl">
                        <TabsTrigger value="discussions" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">Discussions</TabsTrigger>
                        <TabsTrigger value="journals" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">Weekly Journals</TabsTrigger>
                        <TabsTrigger value="notifications" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">Notifications</TabsTrigger>
                    </TabsList>

                    <TabsContent value="discussions" className="outline-none">
                        <DiscussionsTab onShowPaywall={() => setShowPaywall(true)} />
                    </TabsContent>

                    <TabsContent value="journals" className="outline-none">
                        <WeeklyJournalsTab />
                    </TabsContent>

                    <TabsContent value="notifications" className="outline-none">
                        <NotificationsTab />
                    </TabsContent>
                </Tabs>
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
