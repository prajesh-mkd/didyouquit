"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";
import { collection, getDocs, query, orderBy, limit, doc, getDoc, startAt, startAfter, where, DocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Globe, Target, Users, Calendar } from "lucide-react";
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

import { useAuth } from "@/lib/auth-context";

export default function PublicResolutionsPage() {
    const { user } = useAuth();
    const [resolutions, setResolutions] = useState<PublicResolution[]>([]);
    const [loading, setLoading] = useState(true);

    const getWeekRange = (weekNum: number) => {
        const now = new Date();
        const targetDate = setWeek(now, weekNum, { weekStartsOn: 1 });
        const start = startOfWeek(targetDate, { weekStartsOn: 1 });
        const end = endOfWeek(targetDate, { weekStartsOn: 1 });
        return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
    };

    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const initialLoadDone = useRef(false);

    // Fallback for existing data that doesn't have randomSortKey
    const isLegacyMode = useRef(false);

    // Legacy user cache to avoid refetching same users
    const userCache = useRef<Map<string, any>>(new Map());

    const loadResolutions = async (isInitial = false) => {
        if (loadingMore || (!isInitial && !hasMore)) return;

        if (isInitial) {
            setLoading(true);
            setResolutions([]);
            setHasMore(true);
            setLastDoc(null);
            userCache.current.clear();
            isLegacyMode.current = false; // Reset mode
        } else {
            setLoadingMore(true);
        }

        try {
            const newResolutions: PublicResolution[] = [];
            const userIdsToFetch = new Set<string>();

            // 1. Fetch User's Own Resolutions FIRST (Only on initial load)
            if (isInitial && user) {
                const userQ = query(collection(db, "resolutions"), where("uid", "==", user.uid));
                const userSnapshot = await getDocs(userQ);

                userSnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    newResolutions.push({
                        id: docSnap.id,
                        uid: data.uid,
                        title: data.title,
                        weeklyLog: data.weeklyLog || {},
                        user: data.user
                    });
                    // Add to cache so we don't re-fetch ourselves if we appear in random feed
                    if (!data.user) userIdsToFetch.add(data.uid);
                });
            }

            // 2. Fetch Public Feed (Random or Legacy)
            const resolutionsRef = collection(db, "resolutions");
            let q;

            const buildQuery = (legacy: boolean, last: DocumentSnapshot | null) => {
                if (legacy) {
                    if (last) {
                        return query(resolutionsRef, orderBy("createdAt", "desc"), startAfter(last), limit(20));
                    }
                    return query(resolutionsRef, orderBy("createdAt", "desc"), limit(20));
                }
                if (last) {
                    return query(resolutionsRef, orderBy("randomSortKey"), startAfter(last), limit(20));
                }
                const randomStart = Math.random();
                return query(resolutionsRef, orderBy("randomSortKey"), startAt(randomStart), limit(20));
            };

            q = buildQuery(isLegacyMode.current, isInitial ? null : lastDoc);
            let snapshot = await getDocs(q);

            // FALLBACK LOGIC: If initial random fetch is empty, try legacy fetch
            if (isInitial && snapshot.empty && !isLegacyMode.current) {
                console.log("No random-key resolutions found, falling back to legacy...");
                isLegacyMode.current = true;
                q = buildQuery(true, null);
                snapshot = await getDocs(q);
            }

            // If we got fewer than requested, we might have hit the end of the random sequence (1.0)
            // Ideally we'd wrap around, but for V1 just stopping is fine or we can re-query from 0 if needed.
            if (snapshot.docs.length < 20) {
                setHasMore(false);
            }

            setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);

            // Process Public Results
            for (const docSnapshot of snapshot.docs) {
                // Skip if we already added this (i.e. it's the user's own resolution we fetched in step 1)
                if (newResolutions.some(r => r.id === docSnapshot.id)) continue;

                const data = docSnapshot.data();
                const res: PublicResolution = {
                    id: docSnapshot.id,
                    uid: data.uid,
                    title: data.title,
                    weeklyLog: data.weeklyLog || {},
                    user: data.user // Use denormalized data if available
                };

                if (!res.user && res.uid) {
                    // Check cache
                    if (userCache.current.has(res.uid)) {
                        res.user = userCache.current.get(res.uid);
                    } else {
                        userIdsToFetch.add(res.uid);
                    }
                }
                newResolutions.push(res);
            }

            // Fetch missing users (legacy data support)
            if (userIdsToFetch.size > 0) {
                await Promise.all(Array.from(userIdsToFetch).map(async (uid) => {
                    try {
                        const userSnap = await getDoc(doc(db, "users", uid));
                        if (userSnap.exists()) {
                            const userData = userSnap.data();
                            userCache.current.set(uid, userData);
                            // Update refs in newResolutions
                            newResolutions.forEach(r => {
                                if (r.uid === uid) r.user = userData as any;
                            });
                        }
                    } catch (e) {
                        console.error("Error fetching legacy user", e);
                    }
                }));
            }

            if (isInitial) {
                setResolutions(newResolutions);
            } else {
                // Determine uniqueness before appending
                setResolutions(prev => {
                    const existingIds = new Set(prev.map(r => r.id));
                    const uniqueNew = newResolutions.filter(r => !existingIds.has(r.id));
                    return [...prev, ...uniqueNew];
                });
            }

        } catch (error) {
            console.error("Error loading resolutions:", error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        if (!initialLoadDone.current) {
            // Wait for auth to be determined before initial load to ensure we get user ID
            // note: we depend on 'user' or 'loading' from auth context actually.
            // But since useAuth loading is initially true, we might need to wait.
            // simplified: we just load. If auth loads later, they don't hot-reload this list to avoid jitter.
            // Better: add user dependency to effect? No, that causes reset loop.
            // Best: We'll just load once. If they log in later, they refresh.
            loadResolutions(true);
            initialLoadDone.current = true;
        }
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
                    <p className="text-center text-slate-600 mb-4">See what the world is committing to this year.</p>
                    {user && (
                        <div className="flex justify-center mb-12">
                            <p className="text-sm text-emerald-600 font-medium bg-emerald-50 px-4 py-1.5 rounded-full">
                                ✨ Your resolutions are always kept at the top for you.
                            </p>
                        </div>
                    )}
                    {!user && <div className="mb-12" />}

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
                                            {res.title}
                                        </div>
                                    </div>

                                    {/* Wrapped Dots Container */}
                                    <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                                        <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider font-semibold">Progress (52 Weeks)</p>
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
                                                                <button
                                                                    type="button"
                                                                    className={`w-4 h-4 rounded-full border ${colorClass} shrink-0 cursor-default focus:outline-none focus:ring-1 focus:ring-emerald-500`}
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
                                        <th className="p-4 pl-10 font-semibold border-b border-emerald-100 w-[250px]">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-emerald-600" />
                                                User
                                            </div>
                                        </th>
                                        <th className="p-4 font-semibold border-b border-emerald-100">
                                            <div className="flex items-center gap-2">
                                                <Target className="h-4 w-4 text-emerald-600" />
                                                Resolution
                                            </div>
                                        </th>
                                        <th className="p-4 font-semibold border-b border-emerald-100 min-w-[300px]">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-emerald-600" />
                                                Progress (52 Weeks)
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {resolutions.map((res) => (
                                        <tr key={res.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="p-4 pl-6">
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
                                                                        <button
                                                                            type="button"
                                                                            className={`w-4 h-4 rounded-full border ${colorClass} cursor-default focus:outline-none focus:ring-1 focus:ring-emerald-500`}
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

                    {/* Load More Button */}
                    {hasMore && (
                        <div className="mt-8 text-center pb-8">
                            <button
                                onClick={() => loadResolutions(false)}
                                disabled={loadingMore}
                                className="px-6 py-2.5 bg-white border border-emerald-200 text-emerald-700 font-medium rounded-full hover:bg-emerald-50 disabled:opacity-50 transition-colors shadow-sm"
                            >
                                {loadingMore ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                    </span>
                                ) : (
                                    "Load More Resolutions"
                                )}
                            </button>
                        </div>
                    )}
                </div >
            </main >
            <Footer />
        </div >
    );
}
