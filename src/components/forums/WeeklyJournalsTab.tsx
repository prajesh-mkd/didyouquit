"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { Loader2, Calendar, MessageSquare, ChevronRight, MessageCircle, CheckCircle2, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { formatDistanceToNow, setWeek, setYear, startOfWeek, endOfWeek, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

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
    commentCount?: number;
    status?: boolean;
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
    const router = useRouter();
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
                // If uid prop is present, we are on a specific profile page, so don't link to it.
                const isProfileView = !!uid;

                return (
                    <div
                        key={entry.id}
                        onClick={() => router.push(`/forums/journal/${entry.id}`)}
                        className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative"
                    >
                        <div className="flex items-stretch justify-between gap-4">
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        {isProfileView ? (
                                            <span className="font-semibold text-slate-900">
                                                {entry.username}
                                            </span>
                                        ) : (
                                            <Link
                                                href={`/${entry.username}`}
                                                className="font-semibold text-slate-900 hover:text-emerald-700 transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {entry.username}
                                            </Link>
                                        )}

                                        <div className="text-xs text-slate-500 mt-1">
                                            <div className="flex items-center gap-1 mb-1">
                                                <span>checked in for</span>
                                                <span className="font-medium text-emerald-600">
                                                    {entry.resolutionTitle}
                                                </span>
                                                {entry.status !== undefined && (
                                                    <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-full border ml-2 ${entry.status ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"}`}>
                                                        {entry.status ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                                        {entry.status ? "Kept It" : "Missed It"}
                                                    </div>
                                                )}
                                            </div>
                                            {weekInfo && (
                                                <div className="flex items-center gap-2 text-slate-400 bg-slate-50 w-fit px-2 py-1 rounded-md mt-1">
                                                    <span className="font-medium text-slate-600">Week {weekInfo.weekNum}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span>{weekInfo.range}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap mb-4">
                                    {entry.content}
                                </p>

                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                    <span>{entry.createdAt?.seconds ? formatDistanceToNow(new Date(entry.createdAt.seconds * 1000), { addSuffix: true }) : 'Just now'}</span>
                                </div>
                            </div>

                            <div className="flex flex-col justify-between shrink-0 text-slate-400 items-end pl-4 min-h-[100px]">
                                <div className="flex items-center gap-1.5 justify-end">
                                    <MessageCircle className="h-4 w-4" />
                                    <span className="text-xs font-medium">{entry.commentCount || 0}</span>
                                </div>

                                <div className="flex flex-col items-end gap-2 text-xs">
                                    <span className="flex items-center text-slate-500 font-medium hover:text-emerald-600 transition-colors">
                                        View Post<ChevronRight className="h-4 w-4" />
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
