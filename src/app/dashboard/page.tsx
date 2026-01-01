"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, Trash2, Pencil, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
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
import { format, setWeek, startOfWeek, endOfWeek } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Resolution {
    id: string;
    title: string;
    weeklyLog: Record<string, boolean>;
    createdAt: any;
}

export default function Dashboard() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [resolutions, setResolutions] = useState<Resolution[]>([]);
    const [loading, setLoading] = useState(true);
    const [newResTitle, setNewResTitle] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit/Delete State
    const [editRes, setEditRes] = useState<Resolution | null>(null);
    const [deleteRes, setDeleteRes] = useState<Resolution | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/");
        }
    }, [authLoading, user, router]);

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
                weeklyLog: {},
                createdAt: serverTimestamp(),
            });
            setNewResTitle("");
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

    const toggleWeek = async (res: Resolution, weekKey: string, value: boolean) => {
        try {
            const resRef = doc(db, "resolutions", res.id);
            await updateDoc(resRef, {
                [`weeklyLog.${weekKey}`]: value,
            });
            // No toast needed for quick toggles, feels snappier
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

    // Filter for "This Week Check-in"
    const pendingResolutions = resolutions.filter(res => res.weeklyLog[currentWeekInfo] === undefined);

    return (
        <div className="min-h-screen flex flex-col bg-[#F0FDF4]">
            <Header />
            <main className="container py-8 px-4 flex-1">

                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-emerald-950">My Resolutions</h1>
                        <p className="text-emerald-800/60 mt-1">Track your progress and stay consistent.</p>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 shadow-md">
                                <Plus className="mr-2 h-4 w-4" /> Add New Resolution
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Resolution</DialogTitle>
                                <DialogDescription>What do you want to achieve or quit this year?</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleCreateResolution}>
                                <div className="grid gap-4 py-4">
                                    <Input
                                        placeholder="e.g. Quit Smoking, Read more books..."
                                        value={newResTitle}
                                        onChange={(e) => setNewResTitle(e.target.value)}
                                        required
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Add Resolution"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Weekly Check-in Card - Only show if there are resolutions */}
                {resolutions.length > 0 && (
                    <div className="bg-white rounded-xl p-6 border border-emerald-100 shadow-sm mb-10">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-emerald-100 p-2 rounded-full">
                                <RefreshCw className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg text-emerald-950">Weekly Check-in</h2>
                                <p className="text-sm text-slate-500">
                                    Week {currentWeekInfo.split('-W')[1]} ({getWeekRange(parseInt(currentWeekInfo.split('-W')[1]))})
                                </p>
                            </div>
                        </div>

                        {pendingResolutions.length === 0 ? (
                            <div className="text-center py-6 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                                <p className="text-emerald-700 font-medium">✨ All caught up for this week! Great job.</p>
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
                                                onClick={() => toggleWeek(res, currentWeekInfo, true)}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                            >
                                                <CheckCircle2 className="mr-1 h-4 w-4" /> Kept It
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => toggleWeek(res, currentWeekInfo, false)}
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
                )}

                {resolutions.length === 0 ? (
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
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-emerald-50/50 text-emerald-900">
                                    <tr>
                                        <th className="p-4 font-semibold border-b border-emerald-100 min-w-[200px]">Resolution</th>
                                        <th className="p-4 font-semibold border-b border-emerald-100 w-[100px]">Actions</th>
                                        <th className="p-4 font-semibold border-b border-emerald-100 min-w-[300px]">Progress (52 Weeks - Click to Edit)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {resolutions.map((res) => (
                                        <tr key={res.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="p-4 font-medium text-slate-900">
                                                {res.title}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1">
                                                    <TooltipProvider delayDuration={0}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-600" onClick={() => setEditRes(res)}>
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Rename Resolution</TooltipContent>
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
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-2.5 max-w-[800px]">
                                                    <TooltipProvider delayDuration={0}>
                                                        {weeks.map((week) => {
                                                            const weekKey = `${currentYear}-W${week.toString().padStart(2, '0')}`;
                                                            const status = res.weeklyLog?.[weekKey]; // true, false, or undefined
                                                            const isFuture = weekKey > currentWeekInfo;

                                                            let colorClass = "bg-slate-200 border-slate-300";
                                                            if (status === true) colorClass = "bg-emerald-500 border-emerald-500";
                                                            if (status === false) colorClass = "bg-red-400 border-red-400";
                                                            if (isFuture) colorClass += " opacity-50 cursor-not-allowed";

                                                            return (
                                                                <Popover key={week}>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <PopoverTrigger asChild disabled={isFuture}>
                                                                                <button
                                                                                    className={`w-3.5 h-3.5 rounded-full border ${colorClass} shrink-0 transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1`}
                                                                                    disabled={isFuture}
                                                                                />
                                                                            </PopoverTrigger>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="bg-slate-800 text-white border-0 text-xs">
                                                                            <p className="font-bold mb-0.5">Week {week}</p>
                                                                            <p className="text-slate-300 font-normal">{getWeekRange(week)}</p>
                                                                            {!isFuture && <p className="text-xs text-slate-400 mt-1 italic">Click to edit</p>}
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                    <PopoverContent className="w-40 p-2">
                                                                        <div className="grid gap-1">
                                                                            <p className="text-xs font-medium text-center mb-1 text-slate-500">Set Week {week}</p>
                                                                            <Button size="sm" variant="ghost" className="justify-start h-8 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50" onClick={() => toggleWeek(res, weekKey, true)}>
                                                                                <CheckCircle2 className="mr-2 h-4 w-4" /> Kept it
                                                                            </Button>
                                                                            <Button size="sm" variant="ghost" className="justify-start h-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => toggleWeek(res, weekKey, false)}>
                                                                                <XCircle className="mr-2 h-4 w-4" /> Missed it
                                                                            </Button>
                                                                        </div>
                                                                    </PopoverContent>
                                                                </Popover>
                                                            );
                                                        })}
                                                    </TooltipProvider>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

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
        </div>
    );
}
