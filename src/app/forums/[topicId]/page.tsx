"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ArrowLeft, Send, MessageSquare, Reply, Trash2, Pencil, MoreHorizontal } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, increment, deleteDoc, where, getDocs, Timestamp } from "firebase/firestore";
import { deleteTopicCascade, deleteCommentCascade } from "@/lib/forum-actions";
import { toast } from "sonner";
import { formatDistanceToNow, formatDistance } from "date-fns";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createNotification } from "@/lib/notifications";
import { useSimulatedDate } from "@/lib/hooks/use-simulated-date";

interface Comment {
    id: string;
    content: string;
    author: {
        uid: string;
        username: string;
        photoURL?: string;
    };
    createdAt: any;
    parentId?: string | null;
    replies?: Comment[];
}

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
    resolutionId?: string;
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

function CommentItem({
    comment,
    onReply,
    replyingTo,
    replyContent,
    setReplyContent,
    onSubmitReply,
    submitting,
    user,
    onDelete,
    onEdit,
    simulatedDate
}: any) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(comment.content);
    const [editSubmitting, setEditSubmitting] = useState(false);

    const handleSaveEdit = async () => {
        if (!editContent.trim()) return;
        setEditSubmitting(true);
        await onEdit(comment.id, editContent);
        setEditSubmitting(false);
        setIsEditing(false);
    }

    return (
        <div className="flex gap-3 p-4 bg-white rounded-lg border border-slate-100 mb-3 group">
            <Avatar className="h-8 w-8">
                <AvatarImage src={comment.author.photoURL} />
                <AvatarFallback>{comment.author.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                    <div className="flex items-baseline gap-2">
                        <Link href={`/${comment.author.username}`} className="font-semibold text-sm text-slate-900 hover:text-emerald-600 hover:underline transition-colors" onClick={(e) => e.stopPropagation()}>
                            {comment.author.username}
                        </Link>
                        <span className="text-xs text-slate-400">
                            {getRelativeTime(comment.createdAt, simulatedDate)}
                        </span>
                    </div>

                    {user && user.uid === comment.author.uid && !isEditing && (
                        <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-emerald-600" onClick={() => setIsEditing(true)}>
                                <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400 hover:text-red-600" onClick={() => onDelete(comment.id)}>
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                </div>

                {isEditing ? (
                    <div className="mb-2">
                        <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="text-sm min-h-[60px] mb-2"
                        />
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveEdit} disabled={editSubmitting} className="h-7 text-xs bg-emerald-600">
                                {editSubmitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="h-7 text-xs">Cancel</Button>
                        </div>
                    </div>
                ) : (
                    <p className="text-slate-700 text-sm whitespace-pre-wrap mb-2">{comment.content}</p>
                )}

                {!isEditing && user && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-slate-400 hover:text-emerald-600 text-xs"
                        onClick={() => onReply(comment.id)}
                    >
                        <Reply className="h-3 w-3 mr-1" /> Reply
                    </Button>
                )}

                {replyingTo === comment.id && (
                    <div className="mt-3 pl-4 border-l-2 border-slate-100">
                        <Textarea
                            placeholder="Write a reply..."
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            className="text-sm min-h-[60px] mb-2"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                className="h-7 text-xs bg-emerald-600"
                                disabled={submitting || !replyContent.trim()}
                                onClick={(e) => onSubmitReply(e, comment.id)}
                            >
                                {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Reply
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onReply(null)}>Cancel</Button>
                        </div>
                    </div>
                )}

                {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-4 pl-4 border-l-2 border-emerald-50 space-y-3">
                        {comment.replies.map((reply: any) => (
                            <CommentItem
                                key={reply.id}
                                comment={reply}
                                onReply={onReply}
                                replyingTo={replyingTo}
                                replyContent={replyContent}
                                setReplyContent={setReplyContent}
                                onSubmitReply={onSubmitReply}
                                submitting={submitting}
                                user={user}
                                onDelete={onDelete}
                                onEdit={onEdit}
                                simulatedDate={simulatedDate}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function TopicPage() {
    const { topicId } = useParams();
    const router = useRouter();
    const { user, userData } = useAuth();

    // Simulation
    const { date: simulatedDate, isSimulated } = useSimulatedDate();

    const [topic, setTopic] = useState<ForumTopic | null>(null);
    const [resolutionData, setResolutionData] = useState<{ title: string, description?: string } | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Reply State
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");
    const [newComment, setNewComment] = useState("");

    // Edit Topic State
    const [isEditTopicOpen, setIsEditTopicOpen] = useState(false);
    const [editTopicTitle, setEditTopicTitle] = useState("");
    const [editTopicContent, setEditTopicContent] = useState("");
    const [isEditingTopic, setIsEditingTopic] = useState(false);

    // Fetch Topic
    useEffect(() => {
        if (!topicId) return;
        const fetchTopic = async () => {
            try {
                const docRef = doc(db, "forum_topics", topicId as string);
                const unsubscribe = onSnapshot(docRef, async (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setTopic({ id: docSnap.id, ...data } as ForumTopic);
                        setEditTopicTitle(data.title);
                        setEditTopicContent(data.content);

                        // Fetch Resolution Details if ID exists
                        if (data.resolutionId) {
                            try {
                                const resSnap = await getDoc(doc(db, "resolutions", data.resolutionId));
                                if (resSnap.exists()) {
                                    const resData = resSnap.data();
                                    setResolutionData({
                                        title: resData.title,
                                        description: resData.why || resData.description
                                    });
                                }
                            } catch (e) {
                                console.error("Error fetching resolution details", e);
                            }
                        }
                    } else {
                        // Handle deletion
                    }
                    setLoading(false);
                });
                return () => unsubscribe();
            } catch (error) {
                console.error(error);
                setLoading(false);
            }
        };
        fetchTopic();
    }, [topicId, router]);

    // Fetch Comments Real-time
    useEffect(() => {
        if (!topicId) return;
        const q = query(
            collection(db, "forum_topics", topicId as string, "comments"),
            orderBy("createdAt", "asc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allComments: Comment[] = [];
            snapshot.forEach((doc) => {
                allComments.push({ id: doc.id, ...doc.data() } as Comment);
            });

            // Build Tree
            const commentMap = new Map<string, Comment>();
            allComments.forEach(c => {
                c.replies = [];
                commentMap.set(c.id, c);
            });

            const rootComments: Comment[] = [];
            allComments.forEach(c => {
                if (c.parentId && commentMap.has(c.parentId)) {
                    commentMap.get(c.parentId)!.replies!.push(c);
                } else {
                    rootComments.push(c);
                }
            });

            setComments(rootComments);
        });
        return () => unsubscribe();
    }, [topicId]);

    const handlePostComment = async (e: React.FormEvent, parentId: string | null = null) => {
        e.preventDefault();
        const content = parentId ? replyContent : newComment;

        if (!user || !content.trim() || !topicId) return;

        setSubmitting(true);
        try {
            // Use simulated date if active, otherwise server timestamp
            const timestamp = isSimulated ? Timestamp.fromDate(simulatedDate) : serverTimestamp();

            await addDoc(collection(db, "forum_topics", topicId as string, "comments"), {
                content: content,
                parentId: parentId,
                author: {
                    uid: user.uid,
                    username: userData?.username || "Anonymous",
                    photoURL: userData?.photoURL || null
                },
                createdAt: timestamp
            });

            await updateDoc(doc(db, "forum_topics", topicId as string), {
                commentCount: increment(1)
            });

            if (parentId) {
                setReplyContent("");
                setReplyingTo(null);

                // Notify Parent Comment Author
                try {
                    const parentSnap = await getDoc(doc(db, "forum_topics", topicId as string, "comments", parentId));
                    if (parentSnap.exists()) {
                        const parentData = parentSnap.data();
                        if (parentData.author.uid !== user.uid && parentData.author.uid !== topic?.author.uid) {
                            await createNotification(parentData.author.uid, 'reply', {
                                senderUid: user.uid,
                                senderUsername: userData?.username || "Anonymous",
                                senderPhotoURL: userData?.photoURL,
                                refId: topicId as string,
                                refText: content,
                                contextText: topic?.title,
                                createdAt: timestamp
                            });
                        }
                    }
                } catch (e) {
                    console.error("Error notifying parent author", e);
                }

            } else {
                setNewComment("");
            }

            // Notify Topic Author
            if (topic && topic.author.uid !== user.uid) {
                await createNotification(topic.author.uid, 'reply', {
                    senderUid: user.uid,
                    senderUsername: userData?.username || "Anonymous",
                    senderPhotoURL: userData?.photoURL,
                    refId: topic.id,
                    refText: content,
                    contextText: topic.title,
                    createdAt: timestamp
                });
            }

            toast.success("Comment added");
        } catch (error) {
            toast.error("Failed to post comment");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm("Are you sure?")) return;
        const commentToDelete = comments.find(c => c.id === commentId);

        try {
            const deletedCount = await deleteCommentCascade(`forum_topics/${topicId}`, commentId);
            await updateDoc(doc(db, "forum_topics", topicId as string), {
                commentCount: increment(-deletedCount!)
            });

            // Cleanup Notification (Best Effort)
            if (commentToDelete && user) {
                try {
                    // Replicate truncation logic from createNotification
                    const rawText = commentToDelete.content;
                    const refText = rawText.slice(0, 60) + (rawText.length > 60 ? "..." : "");

                    const q = query(
                        collection(db, "notifications"),
                        where("senderUid", "==", user.uid),
                        where("type", "==", "reply"),
                        where("refId", "==", topicId),
                        where("refText", "==", refText)
                    );

                    const snap = await getDocs(q);
                    snap.forEach((d) => deleteDoc(d.ref));
                } catch (notiError) {
                    console.error("NOTIFICATION CLEANUP FAILED - CHECK CONSOLE FOR INDEX LINK:", notiError);
                    // Do not throw, allow function to return success
                }
            }

            toast.success("Comment deleted");
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete comment");
        }
    };

    const handleEditComment = async (commentId: string, newContent: string) => {
        try {
            await updateDoc(doc(db, "forum_topics", topicId as string, "comments", commentId), {
                content: newContent
            });
            toast.success("Comment updated");
        } catch (error) {
            toast.error("Failed to update comment");
        }
    };

    const handleDeleteTopic = async () => {
        if (!confirm("Are you sure? This will delete the post and all its comments.")) return;
        try {
            await deleteTopicCascade(topicId as string);
            toast.success("Post deleted");
            router.push("/forums");
        } catch (error) {
            toast.error("Failed to delete post");
        }
    };

    const handleUpdateTopic = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTopicTitle.trim() || !editTopicContent.trim()) return;

        setIsEditingTopic(true);
        try {
            await updateDoc(doc(db, "forum_topics", topicId as string), {
                title: editTopicTitle,
                content: editTopicContent
            });
            setIsEditTopicOpen(false);
            toast.success("Post updated");
        } catch (error) {
            toast.error("Failed to update post");
        } finally {
            setIsEditingTopic(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F0FDF4]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (!topic) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-8 h-full">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 max-w-md w-full">
                    <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">Post not found</h2>
                    <p className="text-slate-500 mb-6">This discussion may have been deleted or does not exist.</p>
                    <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                        <Link href="/forums">Return to Forums</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <>
            <Link href="/forums?tab=general" className="inline-flex items-center text-sm text-slate-500 hover:text-emerald-600 mb-6 transition-colors">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to General
            </Link>

            {/* Main Topic Card */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-8 group relative">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-slate-100">
                            <AvatarImage src={topic.author.photoURL} />
                            <AvatarFallback>{topic.author.username?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                            <Link href={`/${topic.author.username}`} className="font-semibold text-slate-900 hover:text-emerald-600 hover:underline transition-colors">
                                {topic.author.username}
                            </Link>
                            <div className="text-xs text-slate-500">
                                {getRelativeTime(topic.createdAt, isSimulated ? simulatedDate : null)}
                            </div>
                        </div>
                    </div>

                    {user && user.uid === topic.author.uid && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-emerald-800">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <Dialog open={isEditTopicOpen} onOpenChange={setIsEditTopicOpen}>
                                    <DialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                            <Pencil className="mr-2 h-4 w-4" /> Edit Post
                                        </DropdownMenuItem>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Edit Post</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleUpdateTopic} className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Title</label>
                                                <Input
                                                    value={editTopicTitle}
                                                    onChange={e => setEditTopicTitle(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Content</label>
                                                <Textarea
                                                    value={editTopicContent}
                                                    onChange={e => setEditTopicContent(e.target.value)}
                                                    className="min-h-[150px]"
                                                    required
                                                />
                                            </div>
                                            <DialogFooter>
                                                <Button type="submit" disabled={isEditingTopic} className="bg-emerald-600">
                                                    {isEditingTopic ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                                <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50" onClick={handleDeleteTopic}>
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Post
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                {resolutionData && (
                    <div className="mb-6 text-sm">
                        <div className="text-slate-600 mb-1">
                            <span className="font-semibold italic text-slate-900">Resolution:</span>{" "}
                            <span className="italic">{resolutionData.title}</span>
                        </div>
                        {resolutionData.description && (
                            <div className="text-slate-600">
                                <span className="font-semibold italic text-slate-900">Why:</span>{" "}
                                <span className="italic">{resolutionData.description}</span>
                            </div>
                        )}
                    </div>
                )}

                <h1 className="text-2xl font-bold text-slate-900 mb-4">{topic.title}</h1>
                <div className="prose prose-emerald max-w-none text-slate-700 mb-6 whitespace-pre-wrap">
                    {topic.content}
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <MessageSquare className="h-4 w-4" />
                        {comments.length} Comments
                    </div>
                </div>
            </div>

            {/* Comments Section */}
            <div className="space-y-6">
                <h3 className="font-semibold text-slate-900 text-lg">Comments</h3>

                {/* Comment Form */}
                {user ? (
                    <form onSubmit={(e) => handlePostComment(e, null)} className="flex gap-4 items-start">
                        <Avatar className="h-8 w-8 mt-1">
                            <AvatarImage src={userData?.photoURL || undefined} />
                            <AvatarFallback>{userData?.username?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-2">
                            <Textarea
                                placeholder="Write a comment..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                className="min-h-[80px] bg-white"
                            />
                            <Button type="submit" disabled={submitting || !newComment.trim()} size="sm" className="bg-emerald-600">
                                {submitting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Send className="h-3 w-3 mr-2" />}
                                Post Comment
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="p-4 bg-slate-50 rounded-lg text-center text-sm text-slate-500">
                        Please log in to leave a comment.
                    </div>
                )}

                {/* Comments List */}
                <div className="space-y-4">
                    {comments.length === 0 ? (
                        <p className="text-slate-400 italic text-center py-8">No comments yet.</p>
                    ) : (
                        comments.map((comment) => (
                            <CommentItem
                                key={comment.id}
                                comment={comment}
                                onReply={(id: string | null) => setReplyingTo(id === replyingTo ? null : id)}
                                replyingTo={replyingTo}
                                replyContent={replyContent}
                                setReplyContent={setReplyContent}
                                onSubmitReply={handlePostComment}
                                submitting={submitting}
                                user={user}
                                onDelete={handleDeleteComment}
                                onEdit={handleEditComment}
                                simulatedDate={isSimulated ? simulatedDate : null}
                            />
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
