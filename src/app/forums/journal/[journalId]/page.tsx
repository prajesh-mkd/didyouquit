"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ArrowLeft, Send, MessageSquare, Reply, Trash2, Pencil, CheckCircle2, XCircle, UserPlus, UserCheck } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, increment, deleteDoc, setDoc } from "firebase/firestore";
import { toast } from "sonner";
import { formatDistanceToNow, setWeek, startOfWeek, endOfWeek, format } from "date-fns";
import Link from "next/link";
import { createNotification } from "@/lib/notifications";
import { deleteCommentCascade } from "@/lib/forum-actions";

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
    commentCount?: number;
    status?: boolean;
}

function getWeekInfo(weekKey: string) {
    try {
        if (!weekKey || !weekKey.includes('-W')) return null;
        const [yearStr, weekStr] = weekKey.split('-W');
        const year = parseInt(yearStr);
        const week = parseInt(weekStr);

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
    onEdit
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
                            {comment.createdAt?.seconds ? formatDistanceToNow(new Date(comment.createdAt.seconds * 1000), { addSuffix: true }) : 'Just now'}
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
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function JournalPage() {
    const { journalId } = useParams();
    const { user, userData } = useAuth();
    const router = useRouter();

    const [entry, setEntry] = useState<JournalEntry | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Reply State
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyContent, setReplyContent] = useState("");
    const [newComment, setNewComment] = useState("");

    // Follow State
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);

    const [liveResTitle, setLiveResTitle] = useState<string>("");
    const [liveResDescription, setLiveResDescription] = useState<string>("");

    // Fetch Journal Entry
    useEffect(() => {
        if (!journalId) return;
        const fetchEntry = async () => {
            try {
                const docRef = doc(db, "journal_entries", journalId as string);
                const unsubscribe = onSnapshot(docRef, async (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setEntry({ id: docSnap.id, ...data } as JournalEntry);

                        // Fetch live resolution title
                        if (data.resolutionId) {
                            try {
                                const resSnap = await getDoc(doc(db, "resolutions", data.resolutionId));
                                if (resSnap.exists()) {
                                    const data = resSnap.data();
                                    setLiveResTitle(data.title);
                                    if (data.description) {
                                        setLiveResDescription(data.description);
                                    }
                                }
                            } catch (e) {
                                console.error("Error fetching live resolution title", e);
                            }
                        }
                    } else {
                        // Entry not found
                    }
                    setLoading(false);
                });
                return () => unsubscribe();
            } catch (error) {
                console.error(error);
                setLoading(false);
            }
        };
        fetchEntry();
    }, [journalId]);

    // Check Follow Status
    useEffect(() => {
        const checkFollowStatus = async () => {
            if (!user || !entry || user.uid === entry.uid) return;
            try {
                const docRef = doc(db, "users", user.uid, "following", entry.uid);
                const docSnap = await getDoc(docRef);
                setIsFollowing(docSnap.exists());
            } catch (error) {
                console.error("Error checking follow status:", error);
            }
        };

        if (entry && user) {
            checkFollowStatus();
        }
    }, [user, entry]);

    const handleFollow = async () => {
        if (!user || !entry) {
            toast.error("Please log in to follow");
            return;
        }
        setFollowLoading(true);
        try {
            // Add to my following
            await setDoc(doc(db, "users", user.uid, "following", entry.uid), {
                username: entry.username,
                photoURL: entry.photoURL,
                timestamp: serverTimestamp()
            });
            // Add to their followers
            await setDoc(doc(db, "users", entry.uid, "followers", user.uid), {
                username: userData?.username || "Anonymous",
                photoURL: userData?.photoURL || null,
                timestamp: serverTimestamp()
            });

            // Send Notification
            await createNotification(entry.uid, 'follow', {
                senderUid: user.uid,
                senderUsername: userData?.username || "Anonymous",
                senderPhotoURL: userData?.photoURL,
                refId: user.uid
            });

            setIsFollowing(true);
            toast.success(`Following ${entry.username}`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to follow");
        } finally {
            setFollowLoading(false);
        }
    };

    const handleUnfollow = async () => {
        if (!user || !entry) return;
        setFollowLoading(true);
        try {
            await deleteDoc(doc(db, "users", user.uid, "following", entry.uid));
            await deleteDoc(doc(db, "users", entry.uid, "followers", user.uid));
            setIsFollowing(false);
            toast.success(`Unfollowed ${entry.username}`);
        } catch (error) {
            toast.error("Failed to unfollow");
        } finally {
            setFollowLoading(false);
        }
    };

    // Fetch Comments Real-time
    useEffect(() => {
        if (!journalId) return;
        const q = query(
            collection(db, "journal_entries", journalId as string, "comments"),
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
    }, [journalId]);

    const handlePostComment = async (e: React.FormEvent, parentId: string | null = null) => {
        e.preventDefault();
        const content = parentId ? replyContent : newComment;

        if (!user || !content.trim() || !journalId) return;

        setSubmitting(true);
        try {
            await addDoc(collection(db, "journal_entries", journalId as string, "comments"), {
                content: content,
                parentId: parentId,
                author: {
                    uid: user.uid,
                    username: userData?.username || "Anonymous",
                    photoURL: userData?.photoURL || null
                },
                createdAt: serverTimestamp()
            });

            // Increment comment count
            await updateDoc(doc(db, "journal_entries", journalId as string), {
                commentCount: increment(1)
            });

            if (parentId) {
                setReplyContent("");
                setReplyingTo(null);

                // Notify Parent Comment Author
                try {
                    const parentSnap = await getDoc(doc(db, "journal_entries", journalId as string, "comments", parentId));
                    if (parentSnap.exists()) {
                        const parentData = parentSnap.data();
                        if (parentData.author.uid !== user.uid && parentData.author.uid !== entry?.uid) {
                            await createNotification(parentData.author.uid, 'reply_journal', {
                                senderUid: user.uid,
                                senderUsername: userData?.username || "Anonymous",
                                senderPhotoURL: userData?.photoURL,
                                refId: journalId as string,
                                refText: content,
                                contextText: entry ? `${getWeekInfo(entry.weekKey)?.weekNum ? `Week ${getWeekInfo(entry.weekKey)?.weekNum} - ` : ''}${entry.resolutionTitle}` : undefined
                            });
                        }
                    }
                } catch (e) {
                    console.error("Error notifying parent author", e);
                }

            } else {
                setNewComment("");
            }

            // Notify Journal Author
            if (entry && entry.uid !== user.uid) {
                await createNotification(entry.uid, 'reply_journal', {
                    senderUid: user.uid,
                    senderUsername: userData?.username || "Anonymous",
                    senderPhotoURL: userData?.photoURL,
                    refId: `${journalId}`, // Note: Notification routing needs to handle this
                    refText: content,
                    contextText: entry ? `${getWeekInfo(entry.weekKey)?.weekNum ? `Week ${getWeekInfo(entry.weekKey)?.weekNum} - ` : ''}${entry.resolutionTitle}` : undefined
                });
            }

            toast.success("Comment added");
        } catch (error) {
            console.error(error);
            toast.error("Failed to post comment");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm("Are you sure?")) return;
        try {
            const deletedCount = await deleteCommentCascade(`journal_entries/${journalId}`, commentId);
            await updateDoc(doc(db, "journal_entries", journalId as string), {
                commentCount: increment(-deletedCount!)
            });
            toast.success("Comment deleted");
        } catch (error) {
            toast.error("Failed to delete comment");
        }
    };

    const handleEditComment = async (commentId: string, newContent: string) => {
        try {
            await updateDoc(doc(db, "journal_entries", journalId as string, "comments", commentId), {
                content: newContent
            });
            toast.success("Comment updated");
        } catch (error) {
            toast.error("Failed to update comment");
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F0FDF4]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (!entry) return null;

    const weekInfo = getWeekInfo(entry.weekKey);

    return (
        <div className="min-h-screen flex flex-col bg-[#F0FDF4]">
            <Header />
            <main className="container py-8 px-4 flex-1 max-w-4xl mx-auto">
                <Link href="/forums?tab=journals" className="inline-flex items-center text-sm text-slate-500 hover:text-emerald-600 mb-6 transition-colors">
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back to Weekly Journals
                </Link>

                {/* Main Journal Card */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 mb-8 relative">
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
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Link href={`/${entry.username}`} className="font-semibold text-slate-900 hover:text-emerald-700 transition-colors text-base" onClick={(e) => e.stopPropagation()}>
                                                {entry.username}
                                            </Link>

                                            {user && entry.uid !== user.uid && (
                                                <Button
                                                    size="sm"
                                                    className={`h-5 px-3 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all flex items-center justify-center leading-none ${isFollowing
                                                        ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                                                        }`}
                                                    onClick={isFollowing ? handleUnfollow : handleFollow}
                                                    disabled={followLoading}
                                                >
                                                    {followLoading ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : isFollowing ? (
                                                        "Following"
                                                    ) : (
                                                        "Follow"
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-400 whitespace-nowrap">
                                            {entry.createdAt?.seconds ? formatDistanceToNow(new Date(entry.createdAt.seconds * 1000), { addSuffix: true }) : 'Just now'}
                                        </span>
                                    </div>

                                    {/* Metadata Row: Week, Resolution, Why */}
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
                                                    {liveResTitle || entry.resolutionTitle}
                                                </span>
                                            </div>
                                            {liveResDescription && (
                                                <div>
                                                    <span className="text-slate-500 font-bold italic">Why: </span>
                                                    <span className="text-slate-700 italic leading-relaxed">
                                                        {liveResDescription}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                                {entry.content}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pt-4 mt-6 border-t border-slate-50">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <MessageSquare className="h-4 w-4" />
                            {comments.length} {comments.length === 1 ? "Comment" : "Comments"}
                        </div>
                    </div>
                </div>

                {/* Comments Section */}
                <div className="space-y-6">
                    <h3 className="font-semibold text-slate-900 text-lg">Comments</h3>

                    {/* ... rest of comments section ... */}

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
                                />
                            ))
                        )}
                    </div>
                </div>
            </main >
        </div >
    );
}
