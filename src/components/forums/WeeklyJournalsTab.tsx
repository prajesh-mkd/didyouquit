"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { Loader2, Calendar } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { formatDistanceToNow, setWeek, setYear, startOfWeek, endOfWeek, format } from "date-fns";
import { Button } from "@/components/ui/button";

interface JournalEntry {
    id: string;
    uid: string;
    username: string;
    photoURL?: string;
    content: string;
    resolutionId: string;
    resolutionTitle: string;
    weekKey: string;
    createdAt: any;
    likes: number; // Keeping interface for type safety, but ignore in UI
}

function getWeekInfo(weekKey: string) {
    try {
        if (!weekKey || !weekKey.includes('-W')) return null;
        const [yearStr, weekStr] = weekKey.split('-W');
        const year = parseInt(yearStr);
        const week = parseInt(weekStr);

        // ISO Week 1 always contains Jan 4th
        const baseDate = new Date(year, 0, 4);
        const targetDate = setWeek(baseDate, week, { weekStartsOn: 1 });
        const start = startOfWeek(targetDate, { weekStartsOn: 1 });
        const end = endOfWeek(targetDate, { weekStartsOn: 1 });

        return {
            weekNum: week,
            range: `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`
        };
    } catch (e) {
        return null;
    }
}

export function WeeklyJournalsTab({ uid }: { uid?: string }) {
    const { user } = useAuth();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let q;
        if (uid) {
            q = query(collection(db, "journal_entries"), where("uid", "==", uid), orderBy("createdAt", "desc"));
        } else {
            q = query(collection(db, "journal_entries"), orderBy("createdAt", "desc"));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: JournalEntry[] = [];
            snapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as JournalEntry);
            });
            setEntries(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [uid]);

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600/50" />
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="text-center py-20 bg-white/50 rounded-xl border border-dashed border-emerald-200/50">
                <Calendar className="h-12 w-12 text-emerald-200 mx-auto mb-4" />
                <h3 className="text-xl font-medium mb-2 text-emerald-900">No journals yet</h3>
                <p className="text-emerald-800/60">Complete a Weekly Check-in to share your progress!</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {entries.map((entry) => {
                const weekInfo = getWeekInfo(entry.weekKey);
                return (
                    <div key={entry.id} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4">
                            <Link href={`/${entry.username}`} className="shrink-0">
                                <Avatar className="h-10 w-10 border border-slate-100">
                                    <AvatarImage src={entry.photoURL} />
                                    <AvatarFallback className="bg-emerald-50 text-emerald-600">
                                        {entry.username[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            </Link>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Link href={`/${entry.username}`} className="font-semibold text-slate-900 hover:text-emerald-700 transition-colors">
                                                {entry.username}
                                            </Link>
                                            {weekInfo && (
                                                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                                                    Week {weekInfo.weekNum}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                                            <div className="flex items-center gap-1">
                                                <span>checked in for</span>
                                                <span className="font-medium text-emerald-600">
                                                    {entry.resolutionTitle}
                                                </span>
                                            </div>
                                            {weekInfo && (
                                                <>
                                                    <span className="text-slate-300">•</span>
                                                    <span>{weekInfo.range}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        {entry.createdAt?.seconds ? formatDistanceToNow(new Date(entry.createdAt.seconds * 1000), { addSuffix: true }) : 'Just now'}
                                    </span>
                                </div>

                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                                    {entry.content}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
