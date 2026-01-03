"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, MessageSquare, ThumbsUp, MessageCircle, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { where } from "firebase/firestore";

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
}

export default function ForumsPage() {
    const router = useRouter();
    const { user, userData, loading: authLoading } = useAuth();
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

    // Fetch user resolutions when dialog opens or user loads
    useEffect(() => {
        const fetchUserResolutions = async () => {
            if (!user) return;
            try {
                const q = query(collection(db, "resolutions"), where("uid", "==", user.uid));
                const snapshot = await import("firebase/firestore").then(m => m.getDocs(q));
                const resList = snapshot.docs.map(d => ({ id: d.id, title: d.data().title }));
                setResolutions(resList);

                // Default select if only one
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

    useEffect(() => {
        // Listen to hidden users
        const hiddenUsersQuery = query(collection(db, "users"), where("isHidden", "==", true));
        const unsubscribeHidden = onSnapshot(hiddenUsersQuery, (snap) => {
            const hiddenIds = new Set(snap.docs.map(d => d.id));
            setHiddenUserIds(hiddenIds);
        });

        const q = query(collection(db, "forum_topics"), orderBy("createdAt", "desc"));
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
    }, []);

    const visibleTopics = topics.filter(t => !hiddenUserIds.has(t.author.uid));

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
                createdAt: serverTimestamp(),
                likes: 0,
                commentCount: 0
            });
            setNewTitle("");
            setNewContent("");
            // Reset selection logic: if only 1, keep it, else reset to empty
            setSelectedResId(resolutions.length === 1 ? resolutions[0].id : "");
            setIsDialogOpen(false);
            toast.success("Post created!");
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

    if (authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F0FDF4]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-[#F0FDF4]">
            <Header />
            <main className="container py-8 px-4 flex-1 max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-emerald-950">Community Forum</h1>
                        <p className="text-emerald-800/60 mt-1">Discuss progress, challenges, share tips, and find support.</p>
                    </div>
                    {user && (
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 shadow-md">
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
                                        <label className="text-sm font-medium">Related Resolution</label>
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

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600/50" />
                    </div>
                ) : topics.length === 0 ? (
                    <div className="text-center py-20 bg-white/50 rounded-xl border border-dashed border-emerald-200/50">
                        <MessageSquare className="h-12 w-12 text-emerald-200 mx-auto mb-4" />
                        <h3 className="text-xl font-medium mb-2 text-emerald-900">No topics yet</h3>
                        <p className="text-emerald-800/60">Be the first to start a conversation!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {visibleTopics.map((topic) => (
                            <div
                                key={topic.id}
                                onClick={() => router.push(`/forums/${topic.id}`)}
                                className="block bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors mb-2">
                                            {topic.title}
                                        </h3>
                                        <p className="text-slate-600 line-clamp-2 text-sm leading-relaxed mb-4">
                                            {topic.content}
                                        </p>

                                        <div className="flex items-center gap-4 text-xs text-slate-500">
                                            <Link href={`/${topic.author.username}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                                <Avatar className="h-5 w-5">
                                                    <AvatarImage src={topic.author.photoURL} />
                                                    <AvatarFallback>{topic.author.username?.[0]?.toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <span className="hover:underline">{topic.author.username}</span>
                                            </Link>
                                            <span>•</span>
                                            <span>{topic.createdAt?.seconds ? formatDistanceToNow(new Date(topic.createdAt.seconds * 1000), { addSuffix: true }) : 'Just now'}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 shrink-0 text-slate-400">
                                        <div className="flex items-center gap-1.5 justify-end">
                                            <MessageCircle className="h-4 w-4" />
                                            <span className="text-xs font-medium">{topic.commentCount || 0}</span>
                                        </div>
                                        {user && user.uid === topic.author.uid && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 ml-auto -mr-2 mt-2"
                                                onClick={(e) => handleDeleteTopic(e, topic.id)}
                                                title="Delete Post"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
