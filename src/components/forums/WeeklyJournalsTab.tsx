"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, where, doc, setDoc, deleteDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { toast } from "sonner";
import { Loader2, Calendar, MessageSquare, ChevronRight, MessageCircle, CheckCircle2, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { formatDistanceToNow, formatDistance, setWeek, setYear, startOfWeek, endOfWeek, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useSimulatedDate } from "@/lib/hooks/use-simulated-date";

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

// Helper for Relative Time
function getRelativeTime(timestamp: any, simulatedDate: Date | null) {
    if (!timestamp?.seconds) return 'Just now';
    const date = new Date(timestamp.seconds * 1000);

    // If we are simulating, compare relative to the simulated date
    if (simulatedDate) {
        return formatDistance(date, simulatedDate, { addSuffix: true });
    }

    return formatDistanceToNow(date, { addSuffix: true });
}

export function WeeklyJournalsTab({ uid }: { uid?: string }) {
    const { user } = useAuth();
    const router = useRouter();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);

    // Simulation Hook
    const { date: simDate, isSimulated } = useSimulatedDate();

    const [resData, setResData] = useState<Record<string, { title: string, description?: string }>>({});

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

    // Fetch live resolution titles
    useEffect(() => {
        if (entries.length === 0) return;

        const fetchTitles = async () => {
            const missingIds = Array.from(new Set(entries
                .map(e => e.resolutionId)
                .filter(id => id && !resData[id])
            ));

            if (missingIds.length === 0) return;

            // Fetch in batches or individually (simple Promise.all for now)
            try {
                const newData: Record<string, { title: string, description?: string }> = {};
                await Promise.all(missingIds.map(async (id) => {
                    try {
                        const snap = await import("firebase/firestore").then(mod => mod.getDoc(mod.doc(db, "resolutions", id)));
                        if (snap.exists()) {
                            const data = snap.data();
                            newData[id] = { title: data.title, description: data.description };
                        }
                    } catch (e) {
                        console.error(`Error fetching resolution ${id}`, e);
                    }
                }));

                setResData(prev => ({ ...prev, ...newData }));
            } catch (error) {
                console.error("Error fetching resolution data", error);
            }
        };

        fetchTitles();
    }, [entries]);

    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const [followLoading, setFollowLoading] = useState<string | null>(null);

    // Fetch following list
    useEffect(() => {
        if (!user) {
            setFollowingIds(new Set());
            return;
        }

        const fetchFollowing = async () => {
            // simplified: real-time listener for "my following"
            // or just one-time fetch. Real-time is better for UI consistency.
            // But for now, let's do onSnapshot to keep it synced.
            const q = collection(db, "users", user.uid, "following");
            const unsubscribe = onSnapshot(q, (snap) => {
                setFollowingIds(new Set(snap.docs.map(d => d.id)));
            });
            return () => unsubscribe();
        };

        fetchFollowing();
    }, [user]);

    const handleFollow = async (e: React.MouseEvent, targetUid: string, targetUsername: string, targetPhotoURL?: string) => {
        e.stopPropagation();
        if (!user) {
            toast.error("Please log in to follow");
            return;
        }
        setFollowLoading(targetUid);
        try {
            // Add to my following
            await setDoc(doc(db, "users", user.uid, "following", targetUid), {
                username: targetUsername,
                photoURL: targetPhotoURL || null,
                timestamp: serverTimestamp()
            });
            // Add to their followers
            await setDoc(doc(db, "users", targetUid, "followers", user.uid), {
                username: user.displayName || "Anonymous",
                photoURL: user.photoURL || null,
                timestamp: serverTimestamp()
            });

            toast.success(`Following ${targetUsername}`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to follow");
        } finally {
            setFollowLoading(null);
        }
    };

    const handleUnfollow = async (e: React.MouseEvent, targetUid: string) => {
        e.stopPropagation();
        if (!user) {
            toast.error("Please log in to un-follow");
            return;
        }
        setFollowLoading(targetUid);
        try {
            await deleteDoc(doc(db, "users", user.uid, "following", targetUid));
            await deleteDoc(doc(db, "users", targetUid, "followers", user.uid));

            // Cleanup Notification
            const q = query(
                collection(db, "notifications"),
                where("senderUid", "==", user.uid),
                where("recipientUid", "==", targetUid),
                where("type", "==", "follow")
            );
            const snap = await getDocs(q);
            snap.forEach(d => deleteDoc(d.ref));

            toast.success("Unfollowed");
        } catch (error) {
            console.error(error);
            toast.error("Failed to unfollow");
        } finally {
            setFollowLoading(null);
        }
    };

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
                const isMe = user?.uid === entry.uid;
                const isFollowing = followingIds.has(entry.uid);
                const isLoading = followLoading === entry.uid;

                return (

                    <div
                        key={entry.id}
                        onClick={() => router.push(`/forums/journal/${entry.id}`)}
                        className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                    >
                        <div className="flex gap-4">
                            {/* Avatar Section */}
                            <div className="shrink-0">
                                <Link href={isProfileView ? "#" : `/${entry.username}`} onClick={e => isProfileView && e.preventDefault()}>
                                    <Avatar className="h-10 w-10 border border-slate-100">
                                        <AvatarImage src={entry.photoURL} />
                                        <AvatarFallback className="bg-emerald-50 text-emerald-600 font-medium">
                                            {entry.username[0]?.toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </Link>
                            </div>

                            {/* Content Section */}
                            <div className="flex-1 min-w-0">
                                {/* Header: Name & Time */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
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

                                        {/* Follow Button */}
                                        {!isMe && !isProfileView && (
                                            <button
                                                onClick={(e) => isFollowing ? handleUnfollow(e, entry.uid) : handleFollow(e, entry.uid, entry.username, entry.photoURL)}
                                                disabled={isLoading}
                                                className={`h-5 px-3 text-[10px] rounded-full uppercase tracking-wider font-bold transition-all flex items-center justify-center leading-none ${isFollowing
                                                    ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                                                    }`}
                                            >
                                                {isLoading ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : isFollowing ? (
                                                    "Following"
                                                ) : (
                                                    "Follow"
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    <span className="text-xs text-slate-400">
                                        {getRelativeTime(entry.createdAt, isSimulated ? simDate : null)}
                                    </span>
                                </div>

                                {/* Metadata Block */}
                                <div className="text-xs text-slate-500 space-y-2 mb-4">
                                    {weekInfo && (
                                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                                            <span>Week {weekInfo.weekNum}</span>
                                            <span className="text-slate-300">•</span>
                                            <span>{weekInfo.range}</span>
                                        </div>
                                    )}
                                    {entry.status !== undefined && (
                                        <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold w-fit ${entry.status ? "text-emerald-600" : "text-red-600"}`}>
                                            {entry.status ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                            {entry.status ? "Kept It" : "Missed It"}
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-1.5">
                                        <div>
                                            <span className="text-slate-500 font-bold italic">Resolution: </span>
                                            <span className="text-slate-700 italic leading-relaxed">
                                                {resData[entry.resolutionId]?.title || entry.resolutionTitle}
                                            </span>
                                        </div>
                                        {resData[entry.resolutionId]?.description && (
                                            <div>
                                                <span className="text-slate-500 font-bold italic">Why: </span>
                                                <span className="text-slate-700 italic leading-relaxed">
                                                    {resData[entry.resolutionId]?.description}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Journal Content */}
                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap mb-4">
                                    {entry.content}
                                </p>

                                {/* Footer Action Bar */}
                                <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                                    <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-emerald-600 transition-colors">
                                        <MessageCircle className="h-4 w-4" />
                                        <span className="text-xs font-medium">{entry.commentCount || 0} {(entry.commentCount || 0) === 1 ? "Comment" : "Comments"}</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-600 transition-colors" />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
