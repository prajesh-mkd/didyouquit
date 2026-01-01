"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Globe, Target } from "lucide-react";
import Link from "next/link";
import { startOfWeek, endOfWeek, format, setWeek, getISOWeek, getYear } from "date-fns";

interface PublicResolution {
    id: string;
    uid: string;
    title: string;
    weeklyLog?: { [key: string]: boolean };
    user?: {
        username: string;
        container: string;
        photoURL?: string;
        country?: string;
    };
}

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function PublicResolutionsPage() {
    const [resolutions, setResolutions] = useState<PublicResolution[]>([]);
    const [loading, setLoading] = useState(true);

    const getWeekRange = (weekNum: number) => {
        const year = new Date().getFullYear();
        // Simple approximation for visualization, date-fns is better but requires careful ISO handling
        // We will use date-fns if available or write a simple helper.
        // Assuming ISO weeks.
        const now = new Date();
        // Create a date in the target week
        const targetDate = setWeek(now, weekNum, { weekStartsOn: 1 });
        const start = startOfWeek(targetDate, { weekStartsOn: 1 });
        const end = endOfWeek(targetDate, { weekStartsOn: 1 });
        return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
    };

    useEffect(() => {
        const fetchResolutions = async () => {
            try {
                // Fetch last 100 resolutions
                const q = query(
                    collection(db, "resolutions"),
                    orderBy("createdAt", "desc"),
                    limit(100)
                );
                const querySnapshot = await getDocs(q);

                const resList: PublicResolution[] = [];

                // Parallel fetch user data (optimized would be denormalization, but this works for <100)
                await Promise.all(querySnapshot.docs.map(async (resDoc) => {
                    const data = resDoc.data();
                    const uid = data.uid;

                    let userData = { username: "Anonymous", country: "Unknown", photoURL: "" };

                    try {
                        // Try to get user cache or doc
                        // Ideally this data should be on the resolution doc itself for performance (denormalization)
                        // If not, we fetch.
                        if (uid) {
                            const userDoc = await getDoc(doc(db, "users", uid));
                            if (userDoc.exists()) {
                                userData = userDoc.data() as any;
                            }
                        }
                    } catch (e) {
                        console.error("Error fetching user for resolution", e);
                    }

                    resList.push({
                        id: resDoc.id,
                        uid: uid,
                        title: data.title,
                        weeklyLog: data.weeklyLog || {},
                        user: userData as any
                    });
                }));

                // Shuffle for randomness
                const shuffled = resList.sort(() => 0.5 - Math.random());
                setResolutions(shuffled);
            } catch (error) {
                console.error("Error fetching public resolutions:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchResolutions();
    }, []);

    const currentYear = new Date().getFullYear();
    const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F0FDF4]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F0FDF4] flex flex-col">
            <Header />
            <main className="flex-1 pb-20">
                <div className="container mx-auto px-6 py-12">
                    <h1 className="text-4xl font-bold text-center text-emerald-900 mb-2">Public Resolutions 2026</h1>
                    <p className="text-center text-slate-600 mb-12">See what the world is committing to this year.</p>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        {/* Mobile View (Cards) */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {resolutions.map((res) => (
                                <div key={res.id} className="p-4 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <Link href={`/${res.user?.username || res.uid}`}>
                                                <Avatar className="h-10 w-10 border border-slate-200">
                                                    <AvatarImage src={res.user?.photoURL} />
                                                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-bold">
                                                        {res.user?.username?.slice(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </Link>
                                            <div>
                                                <Link href={`/${res.user?.username || res.uid}`} className="font-semibold text-slate-800 hover:text-emerald-700 transition-colors block">
                                                    {res.user?.username || "Anonymous"}
                                                </Link>
                                                <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                                    <Globe className="h-3 w-3" />
                                                    {res.user?.country || "Unknown"}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2 font-medium text-slate-900 mb-2">
                                            <Target className="h-4 w-4 text-emerald-500 shrink-0" />
                                            {res.title}
                                        </div>
                                    </div>

                                    {/* Wrapped Dots Container */}
                                    <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                                        <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider font-semibold">Yearly Progress</p>
                                        <div className="flex flex-wrap gap-3">
                                            <TooltipProvider delayDuration={0}>
                                                {weeks.map((week) => {
                                                    const weekKey = `${currentYear}-W${week.toString().padStart(2, '0')}`;
                                                    const status = res.weeklyLog?.[weekKey]; // true, false, or undefined

                                                    let colorClass = "bg-slate-200 border-slate-300"; // Default/Null for mobile visibility
                                                    if (status === true) colorClass = "bg-emerald-500 border-emerald-500";
                                                    if (status === false) colorClass = "bg-red-400 border-red-400";

                                                    return (
                                                        <Tooltip key={week}>
                                                            <TooltipTrigger asChild>
                                                                <div
                                                                    className={`w-3 h-3 rounded-full border ${colorClass} shrink-0 cursor-default`}
                                                                />
                                                            </TooltipTrigger>
                                                            <TooltipContent className="bg-slate-800 text-white border-0 text-xs">
                                                                <p className="font-bold mb-0.5">Week {week}</p>
                                                                <p className="text-slate-300 font-normal">{getWeekRange(week)}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    );
                                                })}
                                            </TooltipProvider>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop View (Table) */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-emerald-50/50 text-emerald-900">
                                    <tr>
                                        <th className="p-4 font-semibold border-b border-emerald-100 w-[250px]">User</th>
                                        <th className="p-4 font-semibold border-b border-emerald-100">Resolution</th>
                                        <th className="p-4 font-semibold border-b border-emerald-100 min-w-[300px]">Progress (52 Weeks)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {resolutions.map((res) => (
                                        <tr key={res.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="p-4">
                                                <Link href={`/${res.user?.username || res.uid}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                                    <Avatar className="h-10 w-10 border border-slate-200">
                                                        <AvatarImage src={res.user?.photoURL} />
                                                        <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                                                            {res.user?.username?.slice(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <span className="font-medium text-slate-700 group-hover:text-emerald-700 transition-colors block">
                                                            {res.user?.username || "Anonymous"}
                                                        </span>
                                                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                                            <Globe className="h-3 w-3" />
                                                            {res.user?.country || "Unknown"}
                                                        </div>
                                                    </div>
                                                </Link>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 font-medium text-slate-800">
                                                    <Target className="h-4 w-4 text-emerald-500 shrink-0" />
                                                    {res.title}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-3 max-w-[600px]">
                                                    <TooltipProvider delayDuration={0}>
                                                        {weeks.map((week) => {
                                                            const weekKey = `${currentYear}-W${week.toString().padStart(2, '0')}`;
                                                            const status = res.weeklyLog?.[weekKey]; // true, false, or undefined

                                                            let colorClass = "bg-slate-100 border-slate-200"; // Default/Null
                                                            if (status === true) colorClass = "bg-emerald-500 border-emerald-500";
                                                            if (status === false) colorClass = "bg-red-400 border-red-400";

                                                            return (
                                                                <Tooltip key={week}>
                                                                    <TooltipTrigger asChild>
                                                                        <div
                                                                            className={`w-3 h-3 rounded-full border ${colorClass} cursor-default`}
                                                                        />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent className="bg-slate-800 text-white border-0 text-xs">
                                                                        <p className="font-bold mb-0.5">Week {week}</p>
                                                                        <p className="text-slate-300 font-normal">{getWeekRange(week)}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
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
                </div>
            </main>
            <Footer />
        </div>
    );
}
