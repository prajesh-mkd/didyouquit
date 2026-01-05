"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { Loader2, Heart, Calendar } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
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
    likes: number;
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
            {entries.map((entry) => (
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
                                    <Link href={`/${entry.username}`} className="font-semibold text-slate-900 hover:text-emerald-700 transition-colors">
                                        {entry.username}
                                    </Link>
                                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                                        <span>checked in for</span>
                                        <span className="font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                            {entry.resolutionTitle}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-xs text-slate-400">
                                    {entry.createdAt?.seconds ? formatDistanceToNow(new Date(entry.createdAt.seconds * 1000), { addSuffix: true }) : 'Just now'}
                                </span>
                            </div>

                            <p className="text-slate-700 leading-relaxed mb-4 whitespace-pre-wrap">
                                {entry.content}
                            </p>

                            <div className="flex items-center gap-4 pt-2 border-t border-slate-50">
                                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-500 gap-1.5 px-0 hover:bg-transparent">
                                    <Heart className="h-4 w-4" />
                                    <span className="text-xs">{entry.likes || 0}</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
