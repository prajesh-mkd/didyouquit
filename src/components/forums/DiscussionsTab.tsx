"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, MessageSquare, MessageCircle, Trash2, ChevronRight } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, where, getDocs, setDoc, limit } from "firebase/firestore";
import { toast } from "sonner";
import { formatDistanceToNow, formatDistance } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSimulatedDate } from "@/lib/hooks/use-simulated-date";
// import { PaywallModal } from "@/components/subscription/PaywallModal"; // handled by parent

interface ForumTopic {
    id: string;
    title: string;
    content: string;
    author: {
        uid: string;
        username: string;
        photoURL?: string;
    };
    createdAt: any;
    commentCount: number;
    resolutionTitle?: string;
    resolutionId?: string;
}

interface DiscussionsTabProps {
    onShowPaywall: () => void;
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

export function DiscussionsTab({ onShowPaywall }: DiscussionsTabProps) {
    const router = useRouter();
    const { user, userData } = useAuth();
    const [topics, setTopics] = useState<ForumTopic[]>([]);
    const [loading, setLoading] = useState(true);
    const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(new Set());

    // Create Post State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resolutions, setResolutions] = useState<{ id: string, title: string }[]>([]);
    const [selectedResId, setSelectedResId] = useState<string>("");

    // Follow State
    const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
    const [followLoading, setFollowLoading] = useState<string | null>(null);

    // Use centralized isPro logic (handles past_due correctly)
    const isPro = userData?.isPro || userData?.subscriptionStatus === 'active' || userData?.subscriptionStatus === 'trialing' || userData?.subscriptionStatus === 'past_due';

    // Simulation Hook
    const { date: simDate, isSimulated } = useSimulatedDate();

    // Fetch user resolutions
    useEffect(() => {
        const fetchUserResolutions = async () => {
            if (!user) return;
            try {
                const q = query(collection(db, "resolutions"), where("uid", "==", user.uid));
                const snapshot = await getDocs(q);
                const resList = snapshot.docs.map(d => ({ id: d.id, title: d.data().title as string }));
                setResolutions(resList);

                if (resList.length === 1) {
                    setSelectedResId(resList[0].id);
                } else {
                    setSelectedResId("");
                }
            } catch (e) {
                console.error("Error fetching resolutions", e);
            }
        };
        if (user) fetchUserResolutions();
    }, [user]);

    const [limitCount, setLimitCount] = useState(25);

    // Fetch topics and hidden users
    useEffect(() => {
        const hiddenUsersQuery = query(collection(db, "users"), where("isHidden", "==", true));
        const unsubscribeHidden = onSnapshot(hiddenUsersQuery, (snap) => {
            const hiddenIds = new Set(snap.docs.map(d => d.id));
            setHiddenUserIds(hiddenIds);
        });

        const q = query(
            collection(db, "forum_topics"),
            orderBy("lastActivityAt", "desc"),
            limit(limitCount)
        );
        const unsubscribeTopics = onSnapshot(q, (snapshot) => {
            const data: ForumTopic[] = [];
            snapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() } as ForumTopic);
            });
            setTopics(data);
            setLoading(false);
        });
        return () => {
            unsubscribeHidden();
            unsubscribeTopics();
        };
    }, [limitCount]);

    // Fetch following list
    useEffect(() => {
        if (!user) {
            setFollowingIds(new Set());
            return;
        }

        const q = collection(db, "users", user.uid, "following");
        const unsubscribe = onSnapshot(q, (snap) => {
            setFollowingIds(new Set(snap.docs.map(d => d.id)));
        });
        return () => unsubscribe();
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


    // Fetch live resolution details (description/Why)
    const [resData, setResData] = useState<Record<string, { title: string, description?: string }>>({});

    useEffect(() => {
        if (topics.length === 0) return;

        const fetchDetails = async () => {
            const missingIds = Array.from(new Set(topics
                .map(t => t.resolutionId)
                .filter(id => id && !resData[id])
            ));

            if (missingIds.length === 0) return;

            try {
                const newData: Record<string, { title: string, description?: string }> = {};
                // Simple Promise.all for now - could be batched if needed
                await Promise.all(missingIds.map(async (id) => {
                    if (!id) return;
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

        fetchDetails();
    }, [topics, resData]); // Added resData to dep array to prevent loop if strictly implementing, but check logic. 
    // Actually, checking !resData[id] inside handles simple loops, but sticking to standard pattern.

    const visibleTopics = topics.filter(t => !hiddenUserIds.has(t.author.uid));

    // ... (rest of component)


    const handleCreateTopic = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newTitle.trim() || !newContent.trim()) return;

        if (!selectedResId) {
            toast.error("Please select a related resolution.");
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "forum_topics"), {
                title: newTitle,
                content: newContent,
                author: {
                    uid: user.uid,
                    username: userData?.username || "Anonymous",
                    photoURL: userData?.photoURL || null
                },
                resolutionId: selectedResId,
                resolutionTitle: resolutions.find(r => r.id === selectedResId)?.title || null,
                createdAt: isSimulated ? simDate : serverTimestamp(),
                lastActivityAt: serverTimestamp(), // Sync bump logic
                likes: 0,
                commentCount: 0
            });
            setNewTitle("");
            setNewContent("");
            setSelectedResId(resolutions.length === 1 ? resolutions[0].id : "");
            setIsDialogOpen(false);
            const successMsg = isSimulated ? `Post backdated to ${simDate.toLocaleDateString()}` : "Post created!";
            toast.success(successMsg);
        } catch (error: any) {
            console.error("Error creating topic:", error);
            toast.error(error.message || "Failed to create topic");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteTopic = async (e: React.MouseEvent, topicId: string) => {
        e.stopPropagation();
        e.preventDefault();
        if (!confirm("Are you sure? This will permanently delete your post.")) return;
        try {
            await deleteDoc(doc(db, "forum_topics", topicId));
            toast.success("Post deleted");
        } catch (error) {
            toast.error("Failed to delete post");
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600/50" />
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-end mb-6">
                {user && (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 shadow-md"
                                onClick={(e) => {
                                    if (!isPro) {
                                        e.preventDefault();
                                        onShowPaywall();
                                    }
                                }}
                            >
                                <Plus className="mr-1 h-4 w-4" /> New Post
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Add a New Post</DialogTitle>
                                <DialogDescription>
                                    Ask a question or share any update with the community.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleCreateTopic} className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Input
                                        placeholder="Title"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Textarea
                                        placeholder="Body"
                                        className="min-h-[150px]"
                                        value={newContent}
                                        onChange={(e) => setNewContent(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Related to:</label>
                                    <Select value={selectedResId} onValueChange={setSelectedResId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {resolutions.map(res => (
                                                <SelectItem key={res.id} value={res.id}>
                                                    {res.title.length > 50 ? res.title.slice(0, 50) + "..." : res.title}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isSubmitting} className="bg-emerald-600">
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {visibleTopics.length === 0 ? (
                <div className="text-center py-20 bg-white/50 rounded-xl border border-dashed border-emerald-200/50">
                    <MessageSquare className="h-12 w-12 text-emerald-200 mx-auto mb-4" />
                    <h3 className="text-xl font-medium mb-2 text-emerald-900">No topics yet</h3>
                    <p className="text-emerald-800/60">Be the first to start a conversation!</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {visibleTopics.map((topic) => {
                        const isMe = user?.uid === topic.author.uid;
                        const isFollowing = followingIds.has(topic.author.uid);
                        const isLoading = followLoading === topic.author.uid;

                        return (
                            <div
                                key={topic.id}
                                onClick={() => router.push(`/forums/${topic.id}`)}
                                className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                            >
                                <div className="flex gap-4">
                                    {/* Avatar Section */}
                                    <div className="shrink-0">
                                        <Link href={`/${topic.author.username}`} onClick={e => e.stopPropagation()}>
                                            <Avatar className="h-10 w-10 border border-slate-100">
                                                <AvatarImage src={topic.author.photoURL} />
                                                <AvatarFallback className="bg-emerald-50 text-emerald-600 font-medium">
                                                    {topic.author.username?.[0]?.toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                        </Link>
                                    </div>

                                    {/* Content Section */}
                                    <div className="flex-1 min-w-0">
                                        {/* Header: Name & Time */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/${topic.author.username}`}
                                                    className="font-semibold text-slate-900 hover:text-emerald-700 transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {topic.author.username}
                                                </Link>

                                                {/* Follow Button */}
                                                {!isMe && (
                                                    <button
                                                        onClick={(e) => isFollowing ? handleUnfollow(e, topic.author.uid) : handleFollow(e, topic.author.uid, topic.author.username, topic.author.photoURL)}
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
                                                {getRelativeTime(topic.createdAt, isSimulated ? simDate : null)}
                                            </span>
                                        </div>

                                        {/* Metadata (Resolution) */}
                                        {topic.resolutionTitle && (
                                            <div className="text-xs text-slate-500 mb-4 space-y-1">
                                                <div>
                                                    <span className="text-slate-500 font-bold italic">Resolution: </span>
                                                    <span className="text-slate-700 italic leading-relaxed">
                                                        {resData[topic.resolutionId!]?.title || topic.resolutionTitle}
                                                    </span>
                                                </div>
                                                {resData[topic.resolutionId!]?.description && (
                                                    <div>
                                                        <span className="text-slate-500 font-bold italic">Why: </span>
                                                        <span className="text-slate-700 italic leading-relaxed">
                                                            {resData[topic.resolutionId!]?.description}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Discussion Title & Content */}
                                        <div className="mb-4">
                                            <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-emerald-800 transition-colors">
                                                {topic.title}
                                            </h3>
                                            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                                                {topic.content}
                                            </p>
                                        </div>

                                        {/* Footer Action Bar */}
                                        <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-emerald-600 transition-colors">
                                                    <MessageCircle className="h-4 w-4" />
                                                    <span className="text-xs font-medium">{topic.commentCount || 0} {(topic.commentCount || 0) === 1 ? "Comment" : "Comments"}</span>
                                                </div>

                                                {isMe && (
                                                    <button
                                                        className="flex items-center gap-1.5 text-slate-400 hover:text-red-600 transition-colors text-xs font-medium"
                                                        onClick={(e) => {
                                                            if (!isPro) {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                onShowPaywall();
                                                            } else {
                                                                handleDeleteTopic(e, topic.id);
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Delete
                                                    </button>
                                                )}
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-emerald-600 transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {topics.length >= limitCount && (
                        <div className="flex justify-center pt-4">
                            <Button
                                variant="outline"
                                className="w-full max-w-xs"
                                onClick={() => setLimitCount(prev => prev + 25)}
                            >
                                Load More
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
