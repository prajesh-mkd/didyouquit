"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, Trash2, Pencil, RefreshCw, CheckCircle2, XCircle, Target, Settings, Calendar, Flame } from "lucide-react";
import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    deleteDoc,
    doc,
    updateDoc,
    serverTimestamp,
} from "firebase/firestore";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/error-utils";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getCurrentWeekKey, getWeekLabel } from "@/lib/date-utils";
import { clsx } from "clsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DeleteConfirmDialog } from "@/components/dashboard/DeleteConfirmDialog";
import { EditResolutionDialog } from "@/components/dashboard/EditResolutionDialog";
import { format, setWeek, startOfWeek, endOfWeek, subWeeks, getISOWeek, getYear } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmailVerificationBanner } from "@/components/dashboard/EmailVerificationBanner";
import { TimelinePills } from "@/components/resolutions/TimelinePills";
import { calculateStreak } from "@/lib/streak-utils";
import { AppConfig, UserProfile } from "@/lib/types"; // Ensure UserProfile is imported
import { getDoc } from "firebase/firestore";
import { loadStripe } from "@stripe/stripe-js";

interface Resolution {
    id: string;
    title: string;
    weeklyLog: Record<string, boolean>;
    weeklyNotes?: Record<string, string>;
    createdAt: any;
    description?: string;
}

export default function Dashboard() {
    const { user, userData, loading: authLoading } = useAuth();
    const router = useRouter();
    const [resolutions, setResolutions] = useState<Resolution[]>([]);
    const [loading, setLoading] = useState(true);
    const [newResTitle, setNewResTitle] = useState("");
    const [newResDescription, setNewResDescription] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit/Delete State
    const [editRes, setEditRes] = useState<Resolution | null>(null);
    const [deleteRes, setDeleteRes] = useState<Resolution | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Monetization State
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [showPaywall, setShowPaywall] = useState(false);
    const [loadingCheckout, setLoadingCheckout] = useState<'month' | 'year' | null>(null);

    // Initial Config Fetch
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // We assume public read is allowed for app_config/subscription_settings 
                // If not, we should rely on a public API route. 
                // For now, let's try direct read. If it fails, we fall back to generic values?
                // Actually, let's just Log error.
                // Note: You must ensure Firestore Rules allow read on this doc!
                const snap = await getDoc(doc(db, "app_config", "subscription_settings"));
                if (snap.exists()) {
                    setConfig(snap.data() as AppConfig);
                }
            } catch (error) {
                console.error("Failed to load subs settings", error);
            }
        };
        fetchConfig();

        // Check for success param
        const params = new URLSearchParams(window.location.search);
        if (params.get('success') === 'true') {
            toast.success("Subscription Active! You have full access.");
            router.replace('/my-resolutions');
        }
    }, [router]);

    // Derived Logic for Paywall
    const isPro = userData?.subscriptionStatus === 'active' || userData?.subscriptionStatus === 'trialing';

    // Get active pricing details
    const activeTierKey = config?.activeTier || 'promo_jan';
    // @ts-ignore
    const pricing = config?.[activeTierKey] || {
        displayMonthly: '$1.99',
        displayYearly: '$19.99',
        marketingHeader: 'Start Your Journey',
        marketingSubtext: 'Invest in yourself today.'
    };

    const handleSubscribe = async (interval: 'month' | 'year') => {
        if (!user) return;
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
            if (data.sessionId) {
                const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
                await stripe?.redirectToCheckout({ sessionId: data.sessionId });
            }
        } catch (error: any) {
            toast.error(error.message || "Checkout failed");
        } finally {
            setLoadingCheckout(null);
        }
    };

    const handleManageSubscription = async () => {
        if (!userData?.stripeCustomerId) return;
        try {
            const res = await fetch('/api/portal_session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stripeCustomerId: userData.stripeCustomerId })
            });
            const data = await res.json();
            if (data.url) window.location.href = data.url;
        } catch (error) {
            toast.error("Failed to load portal");
        }
    };

    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push("/");
            } else if (!userData) {
                router.push("/onboarding");
            }
        }
    }, [authLoading, user, userData, router]);

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, "resolutions"),
            where("uid", "==", user.uid)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const resData: Resolution[] = [];
            snapshot.forEach((doc) => {
                resData.push({ id: doc.id, ...doc.data() } as Resolution);
            });
            resData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            setResolutions(resData);
            setLoading(false);
        }, (error) => {
            console.error(error);
            toast.error("Could not load resolutions.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const handleCreateResolution = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newResTitle.trim() || !user) return;
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "resolutions"), {
                uid: user.uid,
                title: newResTitle,
                description: newResDescription,
                weeklyLog: {},
                weeklyNotes: {},
                createdAt: serverTimestamp(),
                randomSortKey: Math.random(),
                user: {
                    username: userData?.username || "Anonymous",
                    country: userData?.country || "Unknown",
                    photoURL: userData?.photoURL || null
                }
            });
            setNewResTitle("");
            setNewResDescription("");
            setIsDialogOpen(false);
            toast.success("Resolution created!");
        } catch (error: any) {
            const msg = getFriendlyErrorMessage(error);
            if (msg) toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteRes) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, "resolutions", deleteRes.id));
            toast.success("Resolution deleted");
            setDeleteRes(null);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSaveEdit = async (newTitle: string) => {
        if (!editRes) return;
        const resRef = doc(db, "resolutions", editRes.id);
        await updateDoc(resRef, { title: newTitle });
        toast.success("Resolution updated");
        setEditRes(null);
    };

    const handleCheckIn = async (res: Resolution, weekKey: string, status: boolean, note?: string) => {
        try {
            const resRef = doc(db, "resolutions", res.id);
            const updates: any = {
                [`weeklyLog.${weekKey}`]: status,
            };
            if (note !== undefined) {
                updates[`weeklyNotes.${weekKey}`] = note;
            }
            await updateDoc(resRef, updates);
            toast.success("Check-in saved!");
        } catch (error: any) {
            toast.error("Failed to update status");
        }
    };

    const currentYear = new Date().getFullYear();
    const currentWeekInfo = getCurrentWeekKey(); // e.g., "2026-W01"
    const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

    const getWeekRange = (weekNum: number) => {
        const now = new Date();
        const targetDate = setWeek(now, weekNum, { weekStartsOn: 1 });
        const start = startOfWeek(targetDate, { weekStartsOn: 1 });
        const end = endOfWeek(targetDate, { weekStartsOn: 1 });
        return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
    };

    if (authLoading || loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F0FDF4]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    // Calculate Last Week Info for Check-in
    // We want to prompt for the *last completed week*
    const now = new Date();
    const lastWeekDate = subWeeks(now, 1);
    const lastWeekKey = `${getYear(lastWeekDate)}-W${getISOWeek(lastWeekDate).toString().padStart(2, '0')}`;
    const lastWeekEnd = endOfWeek(lastWeekDate, { weekStartsOn: 1 });

    // Filter for "Last Week Check-in"
    const pendingResolutions = resolutions.filter(res => {
        // 1. Is the check-in missing?
        if (res.weeklyLog[lastWeekKey] !== undefined) return false;

        // 2. Did the resolution exist during that week?
        // We compare creation time. If created AFTER the week ended, skip it.
        const createdAtMs = res.createdAt?.seconds * 1000 || Date.now();
        if (createdAtMs > lastWeekEnd.getTime()) return false;

        return true;
    });

    return (
        <div className="min-h-screen flex flex-col bg-[#F0FDF4]">
            <Header />
            <main className="container py-8 px-4 flex-1">

                {user && <EmailVerificationBanner user={user} />}

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-emerald-950">My Resolutions</h1>
                        <p className="text-emerald-800/60 mt-1">Track your progress and stay consistent.</p>
                    </div>
                </div>

                {!isPro ? (
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 shadow-md"
                        onClick={() => setShowPaywall(true)}
                    >
                        <Plus className="mr-1 h-4 w-4" /> Add New Resolution
                    </Button>
                ) : (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 shadow-md">
                                <Plus className="mr-1 h-4 w-4" /> Add New Resolution
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Resolution</DialogTitle>
                                <DialogDescription>Try to be more specific.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleCreateResolution}>
                                <div className="grid gap-4 py-4">

                                    <Input
                                        placeholder="E.g. Exercise three times a week..."
                                        value={newResTitle}
                                        onChange={(e) => setNewResTitle(e.target.value)}
                                        required
                                    />
                                    <div className="space-y-1">
                                        <label className="text-sm text-slate-500 font-medium">Why is this important to you?</label>
                                        <Textarea
                                            placeholder="Sharing your 'why' creates a stronger commitment and helps others understand your journey."
                                            value={newResDescription}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewResDescription(e.target.value)}
                                            className="min-h-[100px]"
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Add Resolution"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}


                {/* Weekly Check-in Card - Only show if there are resolutions */}
                {
                    resolutions.length > 0 && (
                        <div className="bg-white rounded-xl p-6 border border-emerald-100 shadow-sm mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-emerald-100 p-2 rounded-full">
                                    <RefreshCw className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-lg text-emerald-950">Weekly Check-in</h2>
                                    <p className="text-sm text-slate-500">
                                        Week {lastWeekKey.split('-W')[1]} ({getWeekRange(parseInt(lastWeekKey.split('-W')[1]))})
                                    </p>
                                </div>
                            </div>

                            {pendingResolutions.length === 0 ? (
                                <div className="text-center py-6 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                                    <p className="text-emerald-700 font-medium">✨ All caught up!</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-xs text-muted-foreground/60 italic text-center mb-2">"Honesty is the best policy."</p>
                                    {pendingResolutions.map(res => (
                                        <div key={res.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <span className="font-medium text-slate-700">{res.title}</span>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleCheckIn(res, lastWeekKey, true)}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                >
                                                    <CheckCircle2 className="mr-1 h-4 w-4" /> Kept It
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleCheckIn(res, lastWeekKey, false)}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                                >
                                                    <XCircle className="mr-1 h-4 w-4" /> Missed It
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                }

                {
                    resolutions.length === 0 ? (
                        <div className="text-center py-20 bg-white/50 rounded-xl border border-dashed border-emerald-200/50">
                            <h3 className="text-xl font-medium mb-2 text-emerald-900">No resolutions yet</h3>
                            <p className="text-emerald-800/60 mb-6">
                                Start by adding your first resolution for the year.
                            </p>
                            <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="border-emerald-200 text-emerald-700">
                                Add Resolution
                            </Button>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                            {/* Mobile View */}
                            <div className="md:hidden divide-y divide-slate-100">
                                {resolutions.map((res) => (
                                    <div key={res.id} className="p-4 space-y-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="font-medium text-slate-900 break-words flex-1">
                                                {res.title}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <TooltipProvider delayDuration={0}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600" onClick={() => setEditRes(res)}>
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Edit</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => setDeleteRes(res)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Delete</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                                            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider font-semibold">Progress (52 Weeks)</p>
                                            <div className="w-full">
                                                <TimelinePills
                                                    resId={res.id}
                                                    weeklyLog={res.weeklyLog}
                                                    currentYear={currentYear}
                                                    onStatusChange={(weekKey, status, note) => handleCheckIn(res, weekKey, status, note)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse table-fixed">
                                    <thead className="bg-emerald-50/50 text-emerald-900">
                                        <tr>
                                            <th className="p-4 pl-12 font-semibold border-b border-emerald-100 w-[60%]">
                                                <div className="flex items-center gap-2">
                                                    <Target className="h-4 w-4 text-emerald-600" />
                                                    Resolution
                                                </div>
                                            </th>
                                            <th className="p-4 font-semibold border-b border-emerald-100 w-[150px]">
                                                <div className="flex items-center gap-2">
                                                    <Settings className="h-4 w-4 text-emerald-600" />
                                                    Actions
                                                </div>
                                            </th>
                                            <th className="p-4 pr-10 font-semibold border-b border-emerald-100">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-emerald-600" />
                                                    Progress (52 Weeks - Click to Edit)
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {resolutions.map((res) => (
                                            <tr key={res.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="p-4 pl-12 align-middle">
                                                    <div className="flex items-center gap-2">
                                                        <div className="font-medium text-slate-900">{res.title}</div>
                                                        {calculateStreak(res.weeklyLog) > 0 && (
                                                            <TooltipProvider delayDuration={0}>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 rounded-full border border-orange-100 cursor-help">
                                                                            <Flame className="h-3 w-3 text-orange-500 fill-orange-500" />
                                                                            <span className="text-[10px] font-bold text-orange-600">{calculateStreak(res.weeklyLog)}</span>
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>{calculateStreak(res.weeklyLog)} Week Streak!</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        )}
                                                    </div>
                                                    {res.description && (
                                                        <div className="text-sm text-slate-500 italic mt-0.5 max-w-[90%] line-clamp-2">
                                                            "{res.description}"
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 align-middle">
                                                    <div className="flex items-center gap-1">
                                                        <TooltipProvider delayDuration={0}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600" onClick={() => setEditRes(res)}>
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Edit Resolution</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => setDeleteRes(res)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Delete Resolution</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                </td>
                                                <td className="p-4 pr-10 align-middle">
                                                    <TimelinePills
                                                        resId={res.id}
                                                        weeklyLog={res.weeklyLog}
                                                        weeklyNotes={res.weeklyNotes}
                                                        currentYear={currentYear}
                                                        onStatusChange={(weekKey, status, note) => handleCheckIn(res, weekKey, status, note)}
                                                    />
                                                </td>

                                            </tr>
                                        ))
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>

        </main >

            <Footer />

            <EditResolutionDialog
                open={!!editRes}
                onOpenChange={(open) => !open && setEditRes(null)}
                initialTitle={editRes?.title || ""}
                onSave={handleSaveEdit}
            />

            <DeleteConfirmDialog
                open={!!deleteRes}
                onOpenChange={(open) => !open && setDeleteRes(null)}
                onConfirm={handleDelete}
                isDeleting={isDeleting}
            />

            {/* Paywall Dialog */}
            <Dialog open={showPaywall} onOpenChange={setShowPaywall}>
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
                                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Unlimited Resolutions</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Advanced Analytics</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Community Badges</li>
                            </ul>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => handleSubscribe('month')}
                                disabled={!!loadingCheckout}
                                className="flex flex-col items-center justify-center p-4 border-2 border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50/10 transition-all"
                            >
                                <span className="text-sm font-medium text-slate-500">Monthly</span>
                                <span className="text-2xl font-bold text-slate-900">{pricing.displayMonthly}</span>
                                {loadingCheckout === 'month' && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
                            </button>
                            <button
                                onClick={() => handleSubscribe('year')}
                                disabled={!!loadingCheckout}
                                className="flex flex-col items-center justify-center p-4 border-2 border-emerald-500 bg-emerald-50/10 rounded-xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] px-2 py-0.5 font-bold rounded-bl-lg">BEST VALUE</div>
                                <span className="text-sm font-medium text-slate-500">Yearly</span>
                                <span className="text-2xl font-bold text-slate-900">{pricing.displayYearly}</span>
                                {loadingCheckout === 'year' && <Loader2 className="h-4 w-4 animate-spin mt-2" />}
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
