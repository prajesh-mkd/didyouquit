"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, where, doc, updateDoc, limit, deleteDoc, getDocs, writeBatch } from "firebase/firestore";
import { Loader2, Bell, UserPlus, MessageCircle, FileText, Target, Trash2, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Notification {
    id: string;
    recipientUid: string;
    senderUid: string;
    senderUsername: string;
    senderPhotoURL?: string;
    type: 'reply' | 'reply_journal' | 'new_journal' | 'new_resolution' | 'follow';
    refId: string;
    refText: string;
    contextText?: string;
    createdAt: any;
    read: boolean;
}

export function NotificationsTab() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [limitCount, setLimitCount] = useState(50);

    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, "notifications"),
            where("recipientUid", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(limitCount)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: Notification[] = [];
            snapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as Notification);
            });
            setNotifications(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user, limitCount]);

    const markAsRead = async (id: string) => {
        try {
            await updateDoc(doc(db, "notifications", id), { read: true });
        } catch (e) {
            console.error(e);
        }
    };

    const handleMarkAsReadAction = (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        markAsRead(id);
    };

    const markAllAsRead = async () => {
        if (!user) return;
        try {
            // Fetch all unread notifications for this user (not just the visible ones)
            const q = query(
                collection(db, "notifications"),
                where("recipientUid", "==", user.uid),
                where("read", "==", false)
            );
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                toast.success("All caught up!");
                return;
            }

            const batch = writeBatch(db);
            snapshot.docs.forEach((d) => {
                batch.update(d.ref, { read: true });
            });
            await batch.commit();
            toast.success("All marked as read");
        } catch (e) {
            console.error(e);
            toast.error("Failed to mark all as read");
        }
    };

    const deleteNotification = async (id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // if (!confirm("Delete this notification?")) return; // Removed as per request
        try {
            await deleteDoc(doc(db, "notifications", id));
            toast.success("Notification deleted");
        } catch (e) {
            console.error(e);
            toast.error("Failed to delete");
        }
    };

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'follow': return <UserPlus className="h-4 w-4 text-white" />;
            case 'reply': return <MessageCircle className="h-4 w-4 text-white" />;
            case 'reply_journal': return <MessageCircle className="h-4 w-4 text-white" />;
            case 'new_journal': return <FileText className="h-4 w-4 text-white" />;
            case 'new_resolution': return <Target className="h-4 w-4 text-white" />;
            default: return <Bell className="h-4 w-4 text-white" />;
        }
    };

    const getBgColor = (type: Notification['type']) => {
        switch (type) {
            case 'follow': return "bg-blue-500";
            case 'reply': return "bg-emerald-500";
            case 'reply_journal': return "bg-teal-500";
            case 'new_journal': return "bg-purple-500";
            case 'new_resolution': return "bg-orange-500";
            default: return "bg-slate-500";
        }
    };

    const getLink = (notif: Notification) => {
        if (notif.type === 'reply') return `/forums/${notif.refId}`;
        if (notif.type === 'reply_journal') return `/forums/journal/${notif.refId}`;
        if (notif.type === 'follow') return `/${notif.senderUsername}`;
        if (notif.type === 'new_journal') return `/forums/journal/${notif.refId}`;
        return `/${notif.senderUsername}`;
    };

    if (loading && notifications.length === 0) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600/50" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header Action */}
            <div className="flex justify-end">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={markAllAsRead}
                    className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
                >
                    <CheckCheck className="mr-2 h-4 w-4" />
                    Mark all as read
                </Button>
            </div>

            {notifications.length === 0 ? (
                <div className="text-center py-20 bg-white/50 rounded-xl border border-dashed border-emerald-200/50">
                    <Bell className="h-12 w-12 text-emerald-200 mx-auto mb-4" />
                    <h3 className="text-xl font-medium mb-2 text-emerald-900">No notifications</h3>
                    <p className="text-emerald-800/60">We'll notify you when there's activity.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {notifications.map((notif) => (
                        <div key={notif.id} className="group relative">
                            <Link
                                href={getLink(notif)}
                                onClick={() => {
                                    if (!notif.read) {
                                        markAsRead(notif.id);
                                    }
                                }}
                                className={cn(
                                    "flex items-center gap-4 p-4 rounded-xl border transition-all hover:shadow-md pr-32", // Increased padding for text button
                                    notif.read ? "bg-white border-slate-100" : "bg-emerald-50/50 border-emerald-100 shadow-sm"
                                )}
                            >
                                <div className="relative shrink-0">
                                    <Avatar className="h-10 w-10 border border-white shadow-sm">
                                        <AvatarImage src={notif.senderPhotoURL} />
                                        <AvatarFallback>{notif.senderUsername[0]?.toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className={cn(
                                        "absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center",
                                        getBgColor(notif.type)
                                    )}>
                                        {getIcon(notif.type)}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-800">
                                        <span className="font-semibold">{notif.senderUsername}</span>
                                        {" "}
                                        {notif.type === 'follow' && "followed you"}
                                        {notif.type === 'reply' && <>replied to your post {notif.contextText && <span className="font-semibold text-slate-700">"{notif.contextText}"</span>}</>}
                                        {notif.type === 'reply_journal' && <>replied to your weekly journal entry {notif.contextText && <span className="font-semibold text-slate-700">"{notif.contextText}"</span>}</>}
                                        {notif.type === 'new_journal' && "posted a new weekly journal entry."}
                                        {notif.type === 'new_resolution' && "started a new resolution"}
                                    </p>
                                    {notif.refText && (
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic">
                                            "{notif.refText}"
                                        </p>
                                    )}
                                    <span className="text-xs text-slate-400 mt-1.5 block">
                                        {notif.createdAt?.seconds ? formatDistanceToNow(new Date(notif.createdAt.seconds * 1000), { addSuffix: true }) : 'Just now'}
                                    </span>
                                </div>
                            </Link>

                            {/* Action Buttons Container */}
                            <div className="absolute top-4 right-4 flex items-center gap-1">
                                {!notif.read && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-[10px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full px-3 shadow-sm transition-all"
                                        onClick={(e) => handleMarkAsReadAction(notif.id, e)}
                                    >
                                        Mark as read
                                    </Button>
                                )}
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                                    onClick={(e) => deleteNotification(notif.id, e)}
                                    title="Delete notification"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {/* Load More Button */}
                    {notifications.length >= limitCount && (
                        <div className="flex justify-center pt-4 pb-2">
                            <Button
                                variant="ghost"
                                onClick={() => setLimitCount(prev => prev + 50)}
                                disabled={loading}
                                className="text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Load more notifications
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
