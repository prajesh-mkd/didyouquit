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
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Loader2, Trash2, Pencil, RefreshCw, CheckCircle2, XCircle, Target, Settings, Calendar, Flame, Info } from "lucide-react";
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
import { notifyFollowers } from "@/lib/notifications";
import { getFriendlyErrorMessage } from "@/lib/error-utils";
import { PaywallModal } from "@/components/subscription/PaywallModal";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getCurrentWeekKey, getWeekLabel } from "@/lib/date-utils";
import { clsx } from "clsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DeleteConfirmDialog } from "@/components/dashboard/DeleteConfirmDialog";
import { EditResolutionDialog } from "@/components/dashboard/EditResolutionDialog";
import { format, setWeek, startOfWeek, endOfWeek, subWeeks, getISOWeek, getYear, getISOWeekYear } from "date-fns";
import { EmailVerificationBanner } from "@/components/dashboard/EmailVerificationBanner";
import { TimelinePills } from "@/components/resolutions/TimelinePills";
import { CheckInDialog } from "@/components/resolutions/CheckInDialog";
import { calculateStreak } from "@/lib/streak-utils";
import { AppConfig, UserProfile } from "@/lib/types"; // Ensure UserProfile is imported
import { getDoc } from "firebase/firestore";

import { useSimulatedDate } from "@/lib/hooks/use-simulated-date";

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

    // Check-in State (for Dashboard Card)
    const [checkInRes, setCheckInRes] = useState<Resolution | null>(null);
    const [initialCheckInStatus, setInitialCheckInStatus] = useState<boolean | null>(null);

    const simulation = useSimulatedDate();

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
    // We trust userData.isPro as the source of truth (handled by backend webhooks)
    // Fallback manual check for safety, including past_due
    const isPro = userData?.isPro || userData?.subscriptionStatus === 'active' || userData?.subscriptionStatus === 'trialing' || userData?.subscriptionStatus === 'past_due';

    // Get active pricing details
    // Get active pricing details
    const mode = config?.mode || 'test';
    const strategy = config?.strategy || 'sale';


    // Deep fallback if config is completely missing to avoid crash
    const pricing = {
        features: ['Unlimited Resolutions', 'Advanced Analytics', 'Community Badges'],
        displayMonthly: '$1.99',
        displayYearly: '$19.99',
        marketingHeader: 'Start Your Journey',
        marketingSubtext: 'Invest in yourself today.',
        ...(config?.[mode]?.[strategy] || {})
    };

    // handleSubscribe and renderPrice moved to PaywallModal component

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

    // Profile Check with Safety Buffer
    // Prevents "Onboarding Flash" where userData might lag behind authLoading for a split second.
    const [profileCheckBuffer, setProfileCheckBuffer] = useState(true);

    useEffect(() => {
        // Start buffer timer on mount
        const timer = setTimeout(() => setProfileCheckBuffer(false), 800);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!authLoading && !profileCheckBuffer) {
            if (!user) {
                router.push("/");
            } else if (!userData) {
                // Only redirect to onboarding if we are SURE userData is missing after buffer
                router.push("/onboarding");
            }
        }
    }, [authLoading, user, userData, router, profileCheckBuffer]);

    // Don't fetch resolutions until we have user
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
        if (!newResTitle.trim() || !newResDescription.trim() || !user) return;
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

    const handleSaveEdit = async (newTitle: string, newDescription: string) => {
        if (!editRes) return;
        const resRef = doc(db, "resolutions", editRes.id);
        const updates: any = { title: newTitle };
        if (newDescription !== undefined) {
            updates.description = newDescription;
        }
        await updateDoc(resRef, updates);
        toast.success("Resolution updated");
        setEditRes(null);
    };

    const handleCheckIn = async (res: Resolution, weekKey: string, status: boolean, note?: string) => {
        if (!isPro) {
            setShowPaywall(true);
            return;
        }

        try {
            const resRef = doc(db, "resolutions", res.id);
            const updates: any = {
                [`weeklyLog.${weekKey}`]: status,
            };
            if (note !== undefined) {
                updates[`weeklyNotes.${weekKey}`] = note;
            }
            await updateDoc(resRef, updates);

            // Sync to Public Journal Entries if a note exists
            if (note && note.trim().length > 0) {
                try {
                    await addDoc(collection(db, "journal_entries"), {
                        uid: user?.uid,
                        username: userData?.username || "Anonymous",
                        photoURL: userData?.photoURL || null,
                        resolutionId: res.id,
                        resolutionTitle: res.title,
                        content: note,
                        weekKey,
                        createdAt: serverTimestamp(),
                        likes: 0
                    });

                    // Notify followers
                    if (user?.uid) {
                        await notifyFollowers(user.uid, 'new_journal', {
                            senderUid: user.uid,
                            senderUsername: userData?.username || "Anonymous",
                            senderPhotoURL: userData?.photoURL,
                            refId: res.id, // Linking to resolution for now, ideally to the journal ID but we just created it async
                            refText: `Posted a check-in for ${res.title}`
                        });
                    }
                } catch (err) {
                    console.error("Failed to sync journal", err);
                }
            }

            toast.success("Check-in saved!");
        } catch (error: any) {
            toast.error("Failed to update status");
        }
    };

    const currentYear = simulation.date.getFullYear();
    const currentWeekInfo = getCurrentWeekKey(); // e.g., "2026-W01"
    const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

    const getWeekRange = (weekNum: number) => {
        const now = simulation.date;
        const targetDate = setWeek(now, weekNum, { weekStartsOn: 1 });
        const start = startOfWeek(targetDate, { weekStartsOn: 1 });
        const end = endOfWeek(targetDate, { weekStartsOn: 1 });
        return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
    };

    // Show loader during Auth, initial Load, OR Profile Buffer
    if (authLoading || loading || (user && !userData && profileCheckBuffer)) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F0FDF4]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    // Calculate Last Week Info for Check-in
    // We want to prompt for the *last completed week*
    const now = simulation.date;
    const currentWeekNum = getISOWeek(now);
    const isFirstWeek = currentWeekNum === 1;

    // Logic:
    // If it's Week 1: Show Week 1, but DISABLE check-in (Waiting for next Monday).
    // If it's Week 2+: Show Previous Week, ENABLE check-in.

    let targetWeekDate = isFirstWeek ? now : subWeeks(now, 1);
    const targetWeekNum = getISOWeek(targetWeekDate);
    const targetYear = getISOWeekYear(targetWeekDate);
    const targetWeekKey = `${targetYear}-W${targetWeekNum.toString().padStart(2, '0')}`;
    const targetWeekEnd = endOfWeek(targetWeekDate, { weekStartsOn: 1 });

    // For Week 1, the "Next Monday" is the start of Week 2
    const checkinStartDate = format(startOfWeek(setWeek(now, 2, { weekStartsOn: 1 }), { weekStartsOn: 1 }), "EEE, MMM d");

    // Filter for Check-ins
    // If First Week: Show ALL resolutions (none are checked in yet).
    // If Normal: Show only MISSING resolutions for *Last Week*.
    const pendingResolutions = resolutions.filter(res => {
        // 1. Is the check-in missing?
        if (res.weeklyLog[targetWeekKey] !== undefined) return false;

        // 2. Did the resolution exist during that week?
        const createdAtMs = res.createdAt?.seconds * 1000 || Date.now();
        if (createdAtMs > targetWeekEnd.getTime()) return false;

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
                                            <label className="text-sm text-slate-500 font-medium">
                                                Why is this important to you? <span className="text-xs text-black font-normal ml-1">(Required)</span>
                                            </label>
                                            <Textarea
                                                placeholder="Sharing your 'why' creates a stronger commitment and helps others understand your journey."
                                                value={newResDescription}
                                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewResDescription(e.target.value)}
                                                className="min-h-[100px]"
                                                required
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
                </div>


                {/* Weekly Check-in Card - Show if Pending OR First Week */}
                {
                    resolutions.length > 0 && (
                        <div className="bg-white rounded-xl p-6 border border-emerald-100 shadow-sm mb-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-emerald-100 p-2 rounded-full">
                                    <RefreshCw className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="font-bold text-lg text-emerald-950">Weekly Check-in</h2>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Info className="h-4 w-4 text-emerald-400 cursor-pointer hover:text-emerald-600 transition-colors" />
                                            </PopoverTrigger>
                                            <PopoverContent className="max-w-xs text-center p-3 text-sm">
                                                <p>Check-ins are for the week that just completed. They become available every Monday to help you reflect on your progress.</p>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        Week {targetWeekNum} ({getWeekRange(targetWeekNum)})
                                    </p>
                                </div>
                            </div>

                            {pendingResolutions.length === 0 ? (
                                <div className="text-center py-6 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                                    <p className="text-emerald-700 font-medium">✨ All caught up!</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-xs text-muted-foreground/60 italic text-center mb-2">
                                        {isFirstWeek
                                            ? `You can check-in starting ${checkinStartDate}.`
                                            : "Did you keep your resolutions last week?"
                                        }
                                    </p>
                                    {pendingResolutions.map(res => (
                                        <div key={res.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <span className="font-medium text-slate-700">{res.title}</span>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={isFirstWeek}
                                                    onClick={() => {
                                                        if (!isPro) { setShowPaywall(true); return; }
                                                        setCheckInRes(res);
                                                        setInitialCheckInStatus(true);
                                                    }}
                                                    className={clsx(
                                                        "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200",
                                                        isFirstWeek && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-emerald-600"
                                                    )}
                                                >
                                                    <CheckCircle2 className="mr-1 h-4 w-4" /> Kept It
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={isFirstWeek}
                                                    onClick={() => {
                                                        if (!isPro) { setShowPaywall(true); return; }
                                                        setCheckInRes(res);
                                                        setInitialCheckInStatus(false);
                                                    }}
                                                    className={clsx(
                                                        "text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200",
                                                        isFirstWeek && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-red-600"
                                                    )}
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
                            <Button
                                onClick={() => !isPro ? setShowPaywall(true) : setIsDialogOpen(true)}
                                variant="outline"
                                className="border-emerald-200 text-emerald-700"
                            >
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
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600" onClick={() => !isPro ? setShowPaywall(true) : setEditRes(res)}>
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Edit</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => !isPro ? setShowPaywall(true) : setDeleteRes(res)}>
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
                                                        {calculateStreak(res.weeklyLog, simulation.date) > 0 && (
                                                            <TooltipProvider delayDuration={0}>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 rounded-full border border-orange-100 cursor-help">
                                                                            <Flame className="h-3 w-3 text-orange-500 fill-orange-500" />
                                                                            <span className="text-[10px] font-bold text-orange-600">{calculateStreak(res.weeklyLog, simulation.date)}</span>
                                                                        </div>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>{calculateStreak(res.weeklyLog, simulation.date)} Week Streak!</p>
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
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600" onClick={() => !isPro ? setShowPaywall(true) : setEditRes(res)}>
                                                                        <Pencil className="h-4 w-4" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>Edit Resolution</TooltipContent>
                                                            </Tooltip>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => !isPro ? setShowPaywall(true) : setDeleteRes(res)}>
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
                    )
                }
            </main >

            <Footer />

            <EditResolutionDialog
                open={!!editRes}
                onOpenChange={(open) => !open && setEditRes(null)}
                initialTitle={editRes?.title || ""}
                initialDescription={editRes?.description}
                onSave={handleSaveEdit}
            />

            <DeleteConfirmDialog
                open={!!deleteRes}
                onOpenChange={(open) => !open && setDeleteRes(null)}
                onConfirm={handleDelete}
                isDeleting={isDeleting}
            />

            {/* Paywall Dialog */}
            <PaywallModal
                open={showPaywall}
                onOpenChange={setShowPaywall}
                pricing={pricing}
                user={user}
            />

            {/* Reused Check-in Dialog for Dashboard Card */}
            <CheckInDialog
                open={!!checkInRes}
                onOpenChange={(open) => {
                    if (!open) setCheckInRes(null);
                }}
                title={`Weekly Check-in: ${checkInRes?.title}`}
                initialStatus={initialCheckInStatus}
                onSave={(status, note) => {
                    if (checkInRes) {
                        handleCheckIn(checkInRes, targetWeekKey, status, note);
                        setCheckInRes(null);
                    }
                }}
            />
        </div >
    );
}
