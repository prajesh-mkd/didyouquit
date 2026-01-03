"use client";

import { useEffect, useState } from "react";
import { useRef } from "react";
import { collection, getDocs, query, orderBy, limit, doc, getDoc, startAt, startAfter, where, DocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Globe, Target, Users, Calendar, Flame } from "lucide-react";
import Link from "next/link";
import { startOfWeek, endOfWeek, format, setWeek, getISOWeek, getYear } from "date-fns";
import { PublicResolutionCard } from "@/components/resolutions/PublicResolutionCard";
import { TimelinePills } from "@/components/resolutions/TimelinePills";
import { calculateStreak } from "@/lib/streak-utils";

interface PublicResolution {
    id: string;
    uid: string;
    title: string;
    weeklyLog?: { [key: string]: boolean };
    user?: {
        username: string;
        country?: string;
        photoURL?: string;
    };
    description?: string;
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

            // 0. Fetch Hidden Users List (to filter out)
            const hiddenUsersSnap = await getDocs(query(collection(db, "users"), where("isHidden", "==", true)));
            const hiddenUserIds = new Set(hiddenUsersSnap.docs.map(d => d.id));

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

                // Skip if user is hidden
                const dataRaw = docSnapshot.data();
                if (hiddenUserIds.has(dataRaw.uid)) continue;

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
                            <p className="text-sm text-emerald-600 font-medium bg-emerald-50 px-4 py-1.5 rounded-lg border border-emerald-200">
                                Your resolutions are pinned to the top for you.
                            </p>
                        </div>
                    )}
                    {!user && <div className="mb-12" />}



                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        {/* Mobile View (Cards) */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {resolutions.map((res) => (
                                <PublicResolutionCard key={res.id} res={res} currentYear={currentYear} />
                            ))}
                        </div>

                        {/* Desktop View (Table) */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead className="bg-emerald-50/50 text-emerald-900">
                                    <tr>
                                        <th className="p-4 pl-10 font-semibold border-b border-emerald-100 w-[250px]">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-emerald-600" />
                                                Member
                                            </div>
                                        </th>
                                        <th className="p-4 pl-12 font-semibold border-b border-emerald-100 w-[42%]">
                                            <div className="flex items-center gap-2">
                                                <Target className="h-4 w-4 text-emerald-600" />
                                                Resolution
                                            </div>
                                        </th>
                                        <th className="p-4 pr-10 font-semibold border-b border-emerald-100">
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
                                                        <span className="text-xs font-bold text-emerald-700 group-hover:text-emerald-800 transition-colors block">
                                                            {res.user?.username || "Anonymous"}
                                                        </span>
                                                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                                            <Globe className="h-3 w-3" />
                                                            {res.user?.country || "Unknown"}
                                                        </div>
                                                    </div>
                                                </Link>
                                            </td>
                                            <td className="p-4 pl-12">
                                                <div className="flex items-center gap-2 font-medium text-slate-800">
                                                    {res.title}
                                                    {calculateStreak(res.weeklyLog || {}) > 0 && (
                                                        <TooltipProvider delayDuration={0}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 rounded-full border border-orange-100 cursor-help" title="">
                                                                        <Flame className="h-3 w-3 text-orange-500 fill-orange-500" />
                                                                        <span className="text-[10px] font-bold text-orange-600">{calculateStreak(res.weeklyLog || {})}</span>
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>{calculateStreak(res.weeklyLog || {})} Week Streak!</p>
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
                                            <td className="p-4 pr-10">
                                                <TimelinePills resId={res.id} weeklyLog={res.weeklyLog} currentYear={currentYear} />
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
