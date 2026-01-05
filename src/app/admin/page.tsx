"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Loader2, Trash2, Shield, EyeOff, Eye, ChevronLeft, ChevronRight, Target, ChevronDown, ChevronUp, RefreshCw, Info } from "lucide-react";
import { collection, query, orderBy, getDocs, getDoc, doc, deleteDoc, updateDoc, limit, startAfter, QueryDocumentSnapshot, endBefore, limitToLast, increment, where, collectionGroup } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSimulatedDate } from "@/lib/hooks/use-simulated-date";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// Types
import { UserProfile, AppConfig } from "@/lib/types";
import { CreditCard, ToggleLeft, ToggleRight, AlertTriangle } from "lucide-react";
import { setDoc } from "firebase/firestore";
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

interface PostWithComments {
    id: string;
    title: string;
    content: string;
    author: {
        uid: string;
        username: string;
        photoURL?: string;
    };
    createdAt: any;
    comments: Comment[];
    commentCount?: number;
}

export default function AdminPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<UserProfile[]>([]);

    // Config State
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [savingConfig, setSavingConfig] = useState(false);
    const [pendingMode, setPendingMode] = useState<'test' | 'live' | null>(null);
    const [pendingStrategy, setPendingStrategy] = useState<'sale' | 'regular' | null>(null);
    const [alertOpen, setAlertOpen] = useState(false);
    const [marketingTab, setMarketingTab] = useState<'sale' | 'regular'>('sale');

    // Posts State
    const [posts, setPosts] = useState<PostWithComments[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(false);

    // Subscription Simulation State
    const [subSimEnabled, setSubSimEnabled] = useState(false);
    const [simulatedStatus, setSimulatedStatus] = useState<string | null>(null);

    // Persist Subscription Simulation State
    useEffect(() => {
        const stored = localStorage.getItem('subSimEnabled');
        if (stored === 'true') setSubSimEnabled(true);

        const storedStatus = localStorage.getItem('simulatedStatus');
        if (storedStatus) setSimulatedStatus(storedStatus);
    }, []);

    // Pagination State
    const [pageCursors, setPageCursors] = useState<QueryDocumentSnapshot<any>[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Current page snapshots for posts
    const [currentSnapshots, setCurrentSnapshots] = useState<QueryDocumentSnapshot<any>[]>([]);

    // Price Loading State
    const [loadingPrice, setLoadingPrice] = useState(false);

    // Simulation Hook
    const simulation = useSimulatedDate();
    const [simDateInput, setSimDateInput] = useState("");

    useEffect(() => {
        if (simulation.date) {
            setSimDateInput(simulation.date.toISOString().split('T')[0]);
        }
    }, [simulation.date]);

    const handleSimulationToggle = (enabled: boolean) => {
        if (enabled) {
            // Enable with current input date or today
            const dateToSet = simDateInput ? new Date(simDateInput) : new Date();
            // Adjust for timezone offset to prevent "previous day" glitch
            const userTimezoneOffset = dateToSet.getTimezoneOffset() * 60000;
            const adjustedDate = new Date(dateToSet.getTime() + userTimezoneOffset);
            simulation.enableSimulation(adjustedDate);
            toast.success("Time Simulation Enabled 🕰️");
        } else {
            simulation.disableSimulation();
            toast.info("returned to Real Time");
        }
    };

    const handleSubSimToggle = async (checked: boolean) => {
        setSubSimEnabled(checked);
        if (!checked) {
            setSimulatedStatus(null);
            localStorage.removeItem('simulatedStatus');
        }
        localStorage.setItem('subSimEnabled', String(checked));
        if (!checked && user?.uid) {
            // Logic: OFF means "Strict Mode", sync with real Stripe status
            toast.promise(handleSetStatus(user.uid, 'sync'), {
                loading: 'Syncing with Stripe...',
                success: 'Status synced with Stripe',
                error: 'Failed to sync status'
            });
        }
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSimDateInput(e.target.value);
        if (simulation.isSimulated) {
            const dateToSet = new Date(e.target.value);
            const userTimezoneOffset = dateToSet.getTimezoneOffset() * 60000;
            const adjustedDate = new Date(dateToSet.getTime() + userTimezoneOffset);
            simulation.enableSimulation(adjustedDate);
        }
    };

    const fetchPriceDetails = async (priceId: string | undefined, env: 'test' | 'live') => {
        if (!priceId) return;
        setLoadingPrice(true);
        try {
            const res = await fetch('/api/price-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priceId, env }),
            });
            const data = await res.json();

            if (res.ok) {
                toast.success(`Valid Price: ${data.displayString}`, {
                    description: `${data.currency.toUpperCase()} ${(data.amount / 100).toFixed(2)}`
                });
            } else {
                toast.error(`Invalid Price ID (${env})`, {
                    description: data.error
                });
            }
        } catch (error) {
            toast.error("Failed to check price");
        } finally {
            setLoadingPrice(false);
        }
    };

    useEffect(() => {
        if (!loading) {
            if (!user || user.email?.toLowerCase().trim() !== 'contact@didyouquit.com') {
                router.push("/");
            } else {
                fetchUsers();
                fetchConfig();
                loadPage(null); // Initial fetch for posts
            }
        }
    }, [user, loading, router]);

    // Auto-switch marketing tab to match active strategy
    useEffect(() => {
        if (config?.strategy) {
            setMarketingTab(config.strategy);
        }
    }, [config?.strategy]);

    const fetchUsers = async () => {
        try {
            const usersSnap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
            setUsers(usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch users");
        }
    };

    const [appEnv, setAppEnv] = useState<'development' | 'production'>('production');

    useEffect(() => {
        const env = process.env.NEXT_PUBLIC_APP_ENV === 'development' ? 'development' : 'production';
        setAppEnv(env);
    }, []);

    const fetchConfig = async () => {
        try {
            const docSnap = await getDoc(doc(db, "app_config", "subscription_settings"));
            if (docSnap.exists()) {
                const data = docSnap.data() as AppConfig;

                // === Migration Logic: Ensure 'modes' exists ===
                if (!data.modes) {
                    const migratedConfig: AppConfig = {
                        ...data,
                        modes: {
                            production: (data.mode as 'test' | 'live') || 'test',
                            development: 'test'
                        }
                    };
                    await updateDoc(doc(db, "app_config", "subscription_settings"), migratedConfig as any);
                    setConfig(migratedConfig);
                } else {
                    setConfig(data);
                }

                if (data.strategy) setMarketingTab(data.strategy);
            } else {
                // Initialize default if missing
                const defaultTier = {
                    monthlyPriceId: '',
                    yearlyPriceId: '',
                    displayMonthly: '$4.99',
                    displayYearly: '$47.99',
                    marketingHeader: 'Pro Membership',
                    marketingSubtext: 'Invest in your better self.',
                    features: [
                        'Unlimited Resolutions',
                        'Advanced Analytics',
                        'Community Badges'
                    ]
                };

                const defaultConfig: AppConfig = {
                    mode: 'test',
                    modes: {
                        production: 'test',
                        development: 'test'
                    },
                    strategy: 'sale',
                    test: {
                        sale: { ...defaultTier, displayMonthly: '$1.99', displayYearly: '$19.99', marketingHeader: 'Sale Pricing' },
                        regular: { ...defaultTier, marketingHeader: 'Regular Pricing' }
                    },
                    live: {
                        sale: { ...defaultTier, displayMonthly: '$1.99', displayYearly: '$19.99', marketingHeader: 'Sale Pricing' },
                        regular: { ...defaultTier, marketingHeader: 'Live Pricing' }
                    }
                };
                await setDoc(doc(db, "app_config", "subscription_settings"), defaultConfig);
                setConfig(defaultConfig);
            }
        } catch (error) {
            console.error("Config load error", error);
        }
    };

    const updateConfig = async (newConfig: Partial<AppConfig>) => {
        if (!config) return;
        setSavingConfig(true);
        try {
            const updated = { ...config, ...newConfig };
            await setDoc(doc(db, "app_config", "subscription_settings"), updated);
            setConfig(updated);
            toast.success("Settings saved");
        } catch (error) {
            toast.error("Failed to save settings");
        } finally {
            setSavingConfig(false);
        }
    };

    const syncStripePrice = async (env: 'test' | 'live', strategy: 'sale' | 'regular', interval: 'monthly' | 'yearly', priceId: string) => {
        if (!priceId) return;
        if (!config) return;

        const toastId = toast.loading("Fetching price from Stripe...");
        try {
            const res = await fetch('/api/price-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ env, priceId }),
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            // Construct update
            const displayField = interval === 'monthly' ? 'displayMonthly' : 'displayYearly';

            const currentEnvObj = config[env] || {};
            // @ts-ignore
            const currentStrategyObj = currentEnvObj[strategy] || {};

            const updatedConfig = {
                [env]: {
                    ...currentEnvObj,
                    [strategy]: {
                        ...currentStrategyObj,
                        [displayField]: data.displayString
                    }
                }
            };

            await updateConfig(updatedConfig as any);
            toast.success(`Synced: ${data.displayString}`, { id: toastId });
        } catch (error: any) {
            toast.error(`Sync failed: ${error.message}`, { id: toastId });
        }
    };


    const fetchPostsWithComments = async (cursor: QueryDocumentSnapshot<any> | null = null) => {
        setLoadingPosts(true);
        try {
            // 1. Fetch Posts
            let q = query(
                collection(db, "forum_topics"),
                orderBy("createdAt", "desc"),
                limit(50)
            );

            if (cursor) {
                q = query(
                    collection(db, "forum_topics"),
                    orderBy("createdAt", "desc"),
                    startAfter(cursor),
                    limit(50)
                );
            }

            const postsSnap = await getDocs(q);
            const postsData = postsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            setHasMore(postsSnap.docs.length === 50);

            // 2. Fetch Comments for EACH post (Parallel)
            const enrichedPosts = await Promise.all(postsData.map(async (post) => {
                const commentsRef = collection(db, "forum_topics", post.id, "comments");
                const commentsQ = query(commentsRef, orderBy("createdAt", "asc"));
                const commentsSnap = await getDocs(commentsQ);

                const allComments = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Comment));

                // Build Logic Tree
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

                return {
                    ...post,
                    comments: rootComments
                } as PostWithComments;
            }));

            // Store snapshots for current view
            setCurrentSnapshots(postsSnap.docs);
            setPosts(enrichedPosts);

        } catch (error) {
            console.error(error);
            toast.error("Failed to fetch posts");
        } finally {
            setLoadingPosts(false);
        }
    };

    // Redoing the fetch/pagination logic to be robust
    // We need to keep a reference to the actual snapshots


    const loadPage = async (cursor: QueryDocumentSnapshot | null) => {
        setLoadingPosts(true);
        try {
            let q = query(
                collection(db, "forum_topics"),
                orderBy("createdAt", "desc"),
                limit(50)
            );

            if (cursor) {
                q = query(
                    collection(db, "forum_topics"),
                    orderBy("createdAt", "desc"),
                    startAfter(cursor),
                    limit(50)
                );
            }

            const snap = await getDocs(q);
            setCurrentSnapshots(snap.docs);
            setHasMore(snap.docs.length === 50);

            // Fetch comments
            const enrichedPosts = await Promise.all(snap.docs.map(async (docSnap) => {
                const post = { id: docSnap.id, ...docSnap.data() } as any;

                const commentsRef = collection(db, "forum_topics", post.id, "comments");
                const commentsQ = query(commentsRef, orderBy("createdAt", "asc"));
                const commentsSnap = await getDocs(commentsQ);

                const allComments = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Comment));

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

                return {
                    ...post,
                    comments: rootComments
                } as PostWithComments;
            }));

            setPosts(enrichedPosts);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load page");
        } finally {
            setLoadingPosts(false);
        }
    }

    const goToNextPage = () => {
        if (currentSnapshots.length === 0) return;
        const lastVisible = currentSnapshots[currentSnapshots.length - 1];
        setPageCursors(prev => [...prev, lastVisible]);
        setCurrentPage(prev => prev + 1);
        loadPage(lastVisible);
    };

    const goToPrevPage = () => {
        if (pageCursors.length === 0) return;
        const newCursors = [...pageCursors];
        newCursors.pop(); // Remove current page's start cursor (which was prev page's end)
        const prevCursor = newCursors.length > 0 ? newCursors[newCursors.length - 1] : null; // If empty, we are at start

        setPageCursors(newCursors);
        setCurrentPage(prev => prev - 1);
        loadPage(prevCursor);
    };


    const handleToggleHideUser = async (userId: string, currentStatus: boolean) => {
        try {
            await updateDoc(doc(db, "users", userId), { isHidden: !currentStatus });
            setUsers(users.map(u => u.uid === userId ? { ...u, isHidden: !currentStatus } : u));
            toast.success(currentStatus ? "User unhidden" : "User hidden");
        } catch (error) {
            toast.error("Failed to toggle visibility");
        }
    };

    // Maintenance State
    const [scanningOrphans, setScanningOrphans] = useState(false);
    const [cleaningOrphans, setCleaningOrphans] = useState(false);
    const [orphanReport, setOrphanReport] = useState<{
        resolutions: QueryDocumentSnapshot[];
        topics: QueryDocumentSnapshot[];
        comments: QueryDocumentSnapshot[];
    } | null>(null);

    const deleteTopicFull = async (topicId: string) => {
        // 1. Delete all comments
        const commentsRef = collection(db, "forum_topics", topicId, "comments");
        const commentsSnap = await getDocs(commentsRef);
        const commentDeletes = commentsSnap.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(commentDeletes);

        // 2. Delete topic
        await deleteDoc(doc(db, "forum_topics", topicId));
    };

    const handleScanOrphans = async () => {
        setScanningOrphans(true);
        setOrphanReport(null);

        try {
            // 1. Fetch ALL Users first for lookup
            const usersSnap = await getDocs(query(collection(db, "users")));
            const validUserIds = new Set(usersSnap.docs.map(d => d.id));

            // 2. Scan Resolutions (orphan users)
            const resSnap = await getDocs(collection(db, "resolutions"));
            const orphanedResolutions = resSnap.docs.filter(doc => !validUserIds.has(doc.data().uid));

            // 3. Scan Topics (orphan users)
            const topicsSnap = await getDocs(collection(db, "forum_topics"));
            const validTopicIds = new Set(topicsSnap.docs.map(d => d.id));
            const orphanedTopics = topicsSnap.docs.filter(doc => {
                const data = doc.data();
                if (!data.author) return true;
                if (data.author.uid && !validUserIds.has(data.author.uid)) return true;
                return false;
            });

            // Update validTopicIds: remove the ones we just marked as orphans
            orphanedTopics.forEach(t => validTopicIds.delete(t.id));

            // 4. Scan "Ghost" Comments
            const commentsGroupSnap = await getDocs(collectionGroup(db, "comments"));
            const orphanedComments = commentsGroupSnap.docs.filter(doc => {
                const parentTopicId = doc.ref.parent.parent?.id;
                return parentTopicId && !validTopicIds.has(parentTopicId);
            });

            setOrphanReport({
                resolutions: orphanedResolutions,
                topics: orphanedTopics,
                comments: orphanedComments
            });

            if (orphanedResolutions.length === 0 && orphanedTopics.length === 0 && orphanedComments.length === 0) {
                toast.success("Great news! No orphans found.");
            } else {
                toast.info(`Found orphans: ${orphanedResolutions.length} Res, ${orphanedTopics.length} Topics, ${orphanedComments.length} Comments.`);
            }

        } catch (error) {
            console.error(error);
            toast.error("Scan failed.");
        } finally {
            setScanningOrphans(false);
        }
    };

    const handleExecuteClean = async () => {
        if (!orphanReport) return;
        if (!confirm(`Are you sure? This will PERMANENTLY DELETE:
- ${orphanReport.resolutions.length} Resolutions
- ${orphanReport.topics.length} Topics
- ${orphanReport.comments.length} Comments/Replies`)) return;

        setCleaningOrphans(true);
        try {
            // 1. Clean Resolutions
            await Promise.all(orphanReport.resolutions.map(d => deleteDoc(d.ref)));

            // 2. Clean Topics
            await Promise.all(orphanReport.topics.map(d => deleteTopicFull(d.id)));

            // 3. Clean Ghost Comments
            await Promise.all(orphanReport.comments.map(d => deleteDoc(d.ref)));

            toast.success("Cleanup execution complete!");
            setOrphanReport(null);

            // Refresh main data
            fetchUsers();
            loadPage(null);

        } catch (error) {
            console.error(error);
            toast.error("Cleanup failed.");
        } finally {
            setCleaningOrphans(false);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        const userToDelete = users.find(u => u.uid === userId);
        if (userToDelete?.subscriptionStatus === 'active') {
            alert("CANNOT DELETE: This user has an ACTIVE subscription. They must cancel it first to avoid being billed for a deleted account.");
            return;
        }

        if (!confirm("Are you sure you want to PERMANENTLY delete this user? This will also delete ALL their resolutions and forum posts.")) return;
        try {
            // 1. Delete Resolutions
            const resQ = query(collection(db, "resolutions"), where("uid", "==", userId));
            const resSnap = await getDocs(resQ);
            await Promise.all(resSnap.docs.map(d => deleteDoc(d.ref)));

            // 2. Delete Forum Topics (and their comments)
            // Note: We need to query by author.uid. ensure your security rules allow this query if needed, or index it.
            const topicsQ = query(collection(db, "forum_topics"), where("author.uid", "==", userId));
            const topicsSnap = await getDocs(topicsQ);
            await Promise.all(topicsSnap.docs.map(d => deleteTopicFull(d.id)));

            // 3. Delete User Profile
            await deleteDoc(doc(db, "users", userId));

            setUsers(users.filter(u => u.uid !== userId));
            toast.success("User and all associated data deleted.");
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete user and data");
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!confirm("Delete this post? This will delete the thread and all replies.")) return;
        try {
            await deleteTopicFull(postId);
            setPosts(posts.filter(p => p.id !== postId));
            toast.success("Post and replies deleted");
        } catch (error) {
            toast.error("Failed to delete post");
        }
    };

    const handleDeleteComment = async (postId: string, commentId: string) => {
        if (!confirm("Delete this reply?")) return;
        try {
            await deleteDoc(doc(db, "forum_topics", postId, "comments", commentId));

            // Decrement comment count (keep existing logic)
            await updateDoc(doc(db, "forum_topics", postId), {
                commentCount: increment(-1)
            });

            // Optimistic Update (keep existing logic)
            setPosts(prevPosts => prevPosts.map(post => {
                if (post.id !== postId) return post;
                const filterComments = (comments: Comment[]): Comment[] => {
                    return comments
                        .filter(c => c.id !== commentId)
                        .map(c => ({
                            ...c,
                            replies: c.replies ? filterComments(c.replies) : []
                        }));
                };
                return {
                    ...post,
                    comments: filterComments(post.comments),
                    commentCount: Math.max(0, (post.commentCount || 0) - 1)
                };
            }));

            toast.success("Reply deleted");
        } catch (error) {
            toast.error("Failed to delete reply");
        }
    };

    const handleSetStatus = async (uid: string, status: string) => {
        const loadingId = toast.loading(`Setting status to ${status}...`);
        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/admin/set_status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ uid, status })
            });
            const data = await res.json();

            if (res.ok) {
                // Optimistic Update
                setUsers(users.map(u =>
                    u.uid === uid ? { ...u, subscriptionStatus: status as any, isPro: data.isPro } : u
                ));
                toast.success(`Updated to ${status}`, { id: loadingId });
            } else {
                toast.error(data.error || "Update failed", { id: loadingId });
            }
        } catch (error) {
            toast.error("Failed to call API", { id: loadingId });
        }
    };

    if (loading || (user?.email !== 'contact@didyouquit.com')) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <Header />
            <main className="container py-8 px-4 mx-auto max-w-6xl">
                <div className="flex items-center gap-3 mb-8">
                    <Shield className="h-8 w-8 text-red-600" />
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Super Admin Dashboard</h1>
                        <p className="text-slate-500 text-sm">Manage users, content, and system health.</p>
                    </div>
                </div>

                <Tabs defaultValue="users">
                    <TabsList className="mb-6">
                        <TabsTrigger value="users">Manage Users ({users.length})</TabsTrigger>
                        <TabsTrigger value="content">Manage Content</TabsTrigger>
                        <TabsTrigger value="maintenance" className="text-amber-700 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800">
                            Maintenance
                        </TabsTrigger>
                        <TabsTrigger value="monetization" className="text-emerald-700 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800">
                            Monetization
                        </TabsTrigger>
                        <TabsTrigger value="simulation" className="text-purple-700 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-800">
                            Simulation 🕰️
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="users">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="p-4 font-medium text-slate-500 w-10"></th>
                                        <th className="p-4 font-medium text-slate-500">User</th>
                                        <th className="p-4 font-medium text-slate-500">Email</th>
                                        <th className="p-4 font-medium text-slate-500">Status</th>
                                        <th className="p-4 font-medium text-slate-500 text-right">Actions</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {users.map(u => (
                                        <UserRow
                                            key={u.uid}
                                            user={u}
                                            onToggleHide={handleToggleHideUser}
                                            onDelete={handleDeleteUser}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </TabsContent>

                    <TabsContent value="content">
                        {/* Inline Posts List */}
                        <div className="space-y-8">
                            {posts.map(post => (
                                <div key={post.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
                                    {/* Post Header */}
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border border-slate-200">
                                                <AvatarImage src={post.author?.photoURL} />
                                                <AvatarFallback>{post.author?.username?.[0]?.toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="font-bold text-slate-900 text-lg leading-tight">{post.title}</div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    by {post.author?.username} • {post.createdAt?.seconds ? formatDistanceToNow(new Date(post.createdAt.seconds * 1000), { addSuffix: true }) : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            className="h-8 text-xs bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                                            onClick={() => handleDeletePost(post.id)}
                                        >
                                            <Trash2 className="h-3 w-3 mr-1" /> Delete Thread
                                        </Button>
                                    </div>

                                    {/* Post Content */}
                                    <p className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap pl-[52px] mb-6 border-l-2 border-slate-100 ml-5 py-1">
                                        {post.content}
                                    </p>

                                    {/* Inline Comments */}
                                    {post.comments.length > 0 && (
                                        <div className="pl-[52px]">
                                            <div className="text-sm font-semibold text-slate-900 mb-3 block">Replies</div>
                                            <div className="space-y-4">
                                                {post.comments.map(comment => (
                                                    <AdminCommentItem
                                                        key={comment.id}
                                                        comment={comment}
                                                        postId={post.id}
                                                        onDelete={handleDeleteComment}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {posts.length === 0 && !loadingPosts && (
                                <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">No posts found.</div>
                            )}
                        </div>

                        {/* Pagination Controls */}
                        <div className="flex items-center justify-between mt-8 mb-12 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <Button
                                variant="outline"
                                onClick={goToPrevPage}
                                disabled={currentPage === 1 || loadingPosts}
                                className="w-32"
                            >
                                <ChevronLeft className="h-4 w-4 mr-2" /> Previous
                            </Button>

                            <span className="text-sm font-medium text-slate-600">
                                Page {currentPage}
                            </span>

                            <Button
                                variant="outline"
                                onClick={goToNextPage}
                                disabled={!hasMore || loadingPosts}
                                className="w-32"
                            >
                                {loadingPosts ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Next <ChevronRight className="h-4 w-4 ml-2" />
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="simulation">
                        <div className="max-w-xl mx-auto mt-12">
                            <div className={`p-8 rounded-2xl border transition-all duration-500 ${simulation.isSimulated ? 'bg-purple-50 border-purple-200 shadow-lg shadow-purple-100' : 'bg-white border-slate-200 shadow-sm'}`}>
                                <div className="text-center mb-8">
                                    <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${simulation.isSimulated ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                                        <RefreshCw className={`h-8 w-8 ${simulation.isSimulated ? 'animate-spin-slow' : ''}`} />
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-2">Time Travel Simulation</h2>
                                    <p className="text-slate-500">
                                        Simulate a specific date to test timeline behaviors. <br />
                                        <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded mt-2 inline-block">Only affects your local session</span>
                                    </p>
                                </div>

                                <div className="space-y-8">
                                    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200">
                                        <div className="space-y-1">
                                            <Label className="text-base font-semibold">Simulation Active</Label>
                                            <p className="text-xs text-slate-500">Override system date</p>
                                        </div>
                                        <Switch
                                            checked={simulation.isSimulated}
                                            onCheckedChange={handleSimulationToggle}
                                        />
                                    </div>

                                    <div className={`space-y-4 transition-opacity duration-300 ${simulation.isSimulated ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                                        <div className="space-y-2">
                                            <Label>Simulated Date</Label>
                                            <Input
                                                type="date"
                                                value={simDateInput}
                                                onChange={handleDateChange}
                                                className="h-12 text-lg"
                                            />
                                        </div>

                                        {simulation.isSimulated && (
                                            <div className="flex justify-center pt-4">
                                                <div className="bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 animate-in fade-in zoom-in">
                                                    <span className="relative flex h-3 w-3">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                                                    </span>
                                                    Simulating: {simulation.date.toDateString()}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Subscription Simulation Section */}
                            <div className={`mt-8 bg-white rounded-xl border transition-all duration-300 ${subSimEnabled ? 'border-purple-200 shadow-md ring-1 ring-purple-100' : 'border-slate-200 shadow-sm'}`}>
                                <div className={`p-6 border-b transition-colors ${subSimEnabled ? 'border-purple-100 bg-purple-50/50' : 'border-slate-100 bg-slate-50/30'}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg transition-colors ${subSimEnabled ? 'bg-purple-100' : 'bg-slate-100'}`}>
                                                <CreditCard className={`h-6 w-6 ${subSimEnabled ? 'text-purple-600' : 'text-slate-400'}`} />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800">Subscription Simulation</h3>
                                                <p className="text-sm text-slate-500">Test recovery flows safely.</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={subSimEnabled}
                                            onCheckedChange={handleSubSimToggle}
                                        />
                                    </div>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-3">
                                        <Info className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                                        <div>
                                            <span className="font-bold block mb-1">Super Admin Sandbox</span>
                                            Controls ONLY affect YOUR account (<b>{user?.email}</b>). <br />
                                            Turning this <b>OFF</b> will <b>Sync</b> with your real Stripe status.
                                        </div>
                                    </div>

                                    <div className={`space-y-3 transition-opacity duration-300 ${subSimEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none select-none'}`}>
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Set Subscription Status</label>
                                        <div className="grid grid-cols-1 gap-3">
                                            <Button
                                                variant="outline"
                                                className={`justify-start h-auto py-3 px-4 transition-all duration-200 ${simulatedStatus === 'active' ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-200 text-emerald-900 shadow-sm' : 'border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 bg-emerald-50/50'}`}
                                                onClick={() => {
                                                    if (user?.uid) {
                                                        handleSetStatus(user.uid, 'active');
                                                        setSimulatedStatus('active');
                                                        localStorage.setItem('simulatedStatus', 'active');
                                                    }
                                                }}
                                            >
                                                <div className="text-left">
                                                    <div className="font-semibold flex items-center gap-2">
                                                        Force Active
                                                        <span className="bg-emerald-200 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded-full">Pro</span>
                                                    </div>
                                                    <div className="text-xs text-emerald-600/80 font-normal mt-0.5">Use to verify standard Pro access.</div>
                                                </div>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className={`justify-start h-auto py-3 px-4 transition-all duration-200 ${simulatedStatus === 'past_due' ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-200 text-amber-900 shadow-sm' : 'border-amber-200 text-amber-800 hover:bg-amber-50 hover:text-amber-900 bg-amber-50/50'}`}
                                                onClick={() => {
                                                    if (user?.uid) {
                                                        handleSetStatus(user.uid, 'past_due');
                                                        setSimulatedStatus('past_due');
                                                        localStorage.setItem('simulatedStatus', 'past_due');
                                                    }
                                                }}
                                            >
                                                <div className="text-left">
                                                    <div className="font-semibold flex items-center gap-2">
                                                        Force Past Due
                                                        <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full border border-amber-200">Grace Period</span>
                                                    </div>
                                                    <div className="text-xs text-amber-800/80 font-normal mt-0.5">Verifies "Grace Period" access + Warning Banner.</div>
                                                </div>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className={`justify-start h-auto py-3 px-4 transition-all duration-200 ${simulatedStatus === 'unpaid' ? 'bg-red-100 border-red-400 ring-2 ring-red-200 text-red-900 shadow-sm' : 'border-red-200 text-red-800 hover:bg-red-50 hover:text-red-900 bg-red-50/50'}`}
                                                onClick={() => {
                                                    if (user?.uid) {
                                                        handleSetStatus(user.uid, 'unpaid');
                                                        setSimulatedStatus('unpaid');
                                                        localStorage.setItem('simulatedStatus', 'unpaid');
                                                    }
                                                }}
                                            >
                                                <div className="text-left">
                                                    <div className="font-semibold flex items-center gap-2">
                                                        Force Unpaid
                                                        <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full border border-slate-200">Not Pro</span>
                                                    </div>
                                                    <div className="text-xs text-red-800/80 font-normal mt-0.5">Verifies Paywall "Payment Failed" state & no access.</div>
                                                </div>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className={`justify-start h-auto py-3 px-4 transition-all duration-200 ${simulatedStatus === 'canceled' ? 'bg-slate-200 border-slate-400 ring-2 ring-slate-200 text-slate-900 shadow-sm' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                                                onClick={() => {
                                                    if (user?.uid) {
                                                        handleSetStatus(user.uid, 'canceled');
                                                        setSimulatedStatus('canceled');
                                                        localStorage.setItem('simulatedStatus', 'canceled');
                                                    }
                                                }}
                                            >
                                                <div className="text-left">
                                                    <div className="font-semibold">Force Canceled</div>
                                                    <div className="text-xs text-slate-500 font-normal mt-0.5">Standard churned user state.</div>
                                                </div>
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100">
                                        <p className="text-[11px] text-slate-400 text-center">
                                            Current Target UID: <code className="bg-slate-100 px-1 py-0.5 rounded">{user?.uid}</code>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="maintenance">
                        <div className="max-w-2xl mx-auto mt-12 space-y-8">
                            {/* Step 1: Scan */}
                            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
                                <div className="mx-auto w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                                    <Shield className="h-6 w-6 text-emerald-600" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 mb-2">Step 1: Scan for Orphans</h2>
                                <p className="text-slate-500 mb-8 max-w-sm mx-auto">
                                    Safely scan the database to identify resolutions, topics, and replies that belong to non-existent users.
                                </p>
                                <Button
                                    size="lg"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white w-full max-w-xs"
                                    onClick={handleScanOrphans}
                                    disabled={scanningOrphans || cleaningOrphans}
                                >
                                    {scanningOrphans ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                                    {scanningOrphans ? "Scanning Database..." : "Scan Database"}
                                </Button>
                            </div>

                            {/* Step 2: Review & Clean */}
                            {orphanReport && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 animate-in fade-in slide-in-from-bottom-4">
                                    <div className="text-center mb-8">
                                        <h2 className="text-xl font-bold text-amber-900 mb-2">Step 2: Review Findings</h2>
                                        <p className="text-amber-800/70">
                                            The following items were found to be orphaned (missing parent user or topic).
                                        </p>
                                    </div>

                                    <div className="space-y-6 mb-8">
                                        {/* Resolutions List */}
                                        <div className="bg-white rounded-lg border border-amber-100 overflow-hidden flex flex-col max-h-96">
                                            <div className="p-3 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Resolutions</div>
                                                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{orphanReport.resolutions.length}</span>
                                                </div>
                                            </div>
                                            {orphanReport.resolutions.length > 0 ? (
                                                <div className="overflow-y-auto p-0">
                                                    <table className="w-full text-left text-xs">
                                                        <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                                                            <tr>
                                                                <th className="p-2 font-medium text-slate-500 w-24">ID</th>
                                                                <th className="p-2 font-medium text-slate-500">Title</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {orphanReport.resolutions.map(doc => (
                                                                <tr key={doc.id} className="hover:bg-slate-50">
                                                                    <td className="p-2 font-mono text-slate-400 align-top select-all">{doc.id}</td>
                                                                    <td className="p-2 text-slate-700 font-medium">{doc.data().title || "Untitled"}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="text-center text-slate-400 text-xs py-8 bg-slate-50/50">No orphaned resolutions found.</div>
                                            )}
                                        </div>

                                        {/* Topics List */}
                                        <div className="bg-white rounded-lg border border-amber-100 overflow-hidden flex flex-col max-h-96">
                                            <div className="p-3 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Topics</div>
                                                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{orphanReport.topics.length}</span>
                                                </div>
                                            </div>
                                            {orphanReport.topics.length > 0 ? (
                                                <div className="overflow-y-auto p-0">
                                                    <table className="w-full text-left text-xs">
                                                        <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                                                            <tr>
                                                                <th className="p-2 font-medium text-slate-500 w-24">ID</th>
                                                                <th className="p-2 font-medium text-slate-500">Title</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {orphanReport.topics.map(doc => (
                                                                <tr key={doc.id} className="hover:bg-slate-50">
                                                                    <td className="p-2 font-mono text-slate-400 align-top select-all">{doc.id}</td>
                                                                    <td className="p-2 text-slate-700 font-medium">{doc.data().title || "Untitled"}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="text-center text-slate-400 text-xs py-8 bg-slate-50/50">No orphaned topics found.</div>
                                            )}
                                        </div>

                                        {/* Ghost Replies List */}
                                        <div className="bg-white rounded-lg border border-amber-100 overflow-hidden flex flex-col max-h-96">
                                            <div className="p-3 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Ghost Replies</div>
                                                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{orphanReport.comments.length}</span>
                                                </div>
                                            </div>
                                            {orphanReport.comments.length > 0 ? (
                                                <div className="overflow-y-auto p-0">
                                                    <table className="w-full text-left text-xs">
                                                        <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                                                            <tr>
                                                                <th className="p-2 font-medium text-slate-500 w-24">ID</th>
                                                                <th className="p-2 font-medium text-slate-500">Parent Topic ID</th>
                                                                <th className="p-2 font-medium text-slate-500">Content</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {orphanReport.comments.map(doc => {
                                                                const d = doc.data();
                                                                const parentId = doc.ref.parent.parent?.id || "Unknown";
                                                                return (
                                                                    <tr key={doc.id} className="hover:bg-slate-50">
                                                                        <td className="p-2 font-mono text-slate-400 align-top select-all">{doc.id}</td>
                                                                        <td className="p-2 font-mono text-amber-600/80 align-top select-all font-medium">{parentId}</td>
                                                                        <td className="p-2 text-slate-700">{d.content || "No Content"}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="text-center text-slate-400 text-xs py-8 bg-slate-50/50">No ghost replies found.</div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-center">
                                        {orphanReport.resolutions.length === 0 && orphanReport.topics.length === 0 && orphanReport.comments.length === 0 ? (
                                            <div className="text-green-600 font-medium flex items-center gap-2">
                                                <Target className="h-5 w-5" /> Database is clean! No action needed.
                                            </div>
                                        ) : (
                                            <Button
                                                size="lg"
                                                variant="destructive"
                                                className="w-full max-w-xs shadow-lg shadow-red-500/20"
                                                onClick={handleExecuteClean}
                                                disabled={cleaningOrphans}
                                            >
                                                {cleaningOrphans ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                                {cleaningOrphans ? "Cleaning..." : "PERMANENTLY DELETE ORPHANS"}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="monetization">
                        <div className="max-w-4xl mx-auto mt-8 space-y-8">
                            {/* Environment Switcher */}
                            <div className="bg-slate-900 text-white rounded-xl p-8 shadow-xl border border-slate-800 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10">
                                    <CreditCard className="h-48 w-48 rotate-12" />
                                </div>

                                <div className="relative z-10 flex items-start justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold mb-2">Payment Environment</h2>
                                        <p className="text-slate-400 mb-6 max-w-md">
                                            Switch between Live Mode (Real Money) and Test Mode (Sandbox).
                                            Currently active: <span className={cn("font-bold px-2 py-0.5 rounded text-sm uppercase", config?.modes?.[appEnv] === 'live' ? "bg-red-500 text-white" : "bg-blue-500 text-white")}>{config?.modes?.[appEnv] || 'loading...'}</span>
                                        </p>

                                        <div className="bg-slate-800/50 p-1 rounded-lg inline-flex">
                                            <button
                                                onClick={() => {
                                                    setPendingMode('test');
                                                    setAlertOpen(true);
                                                }}
                                                className={cn("px-4 py-2 rounded-md text-sm font-bold transition-all", config?.modes?.[appEnv] === 'test' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-white")}
                                            >
                                                Test Mode
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setPendingMode('live');
                                                    setAlertOpen(true);
                                                }}
                                                className={cn("px-4 py-2 rounded-md text-sm font-bold transition-all", config?.modes?.[appEnv] === 'live' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-slate-400 hover:text-white")}
                                            >
                                                Live Mode
                                            </button>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {config?.modes?.[appEnv] === 'test' ? (
                                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 max-w-xs">
                                                <div className="flex items-center gap-2 text-blue-400 mb-2 font-bold">
                                                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                                    Sandbox Environment
                                                </div>
                                                <div className="text-xs text-blue-200">
                                                    <strong>Safe to Test:</strong><br />
                                                    Payments processed here will use Stripe test cards. No real money will be charged.
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 max-w-xs">
                                                <div className="flex items-center gap-2 text-red-400 mb-2 font-bold">
                                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                                    Production Environment
                                                </div>
                                                <div className="text-xs text-red-200">
                                                    <strong>Warning: Live Mode Active</strong><br />
                                                    Real transactions will be processed. Ensure your Stripe Live keys are configured in .env.local.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {/* Strategy Selector */}
                                <div className="mt-6 pt-6 border-t border-slate-800/50">
                                    <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Active Pricing Strategy</h3>
                                    <div className="flex gap-4">
                                        <div className="flex bg-slate-800/50 p-1 rounded-lg inline-flex">
                                            <button
                                                onClick={() => {
                                                    setPendingStrategy('sale');
                                                    setAlertOpen(true);
                                                }}
                                                className={cn("px-4 py-2 rounded-md text-sm font-bold transition-all", config?.strategy === 'sale' ? "bg-emerald-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}
                                            >
                                                Sale Pricing
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setPendingStrategy('regular');
                                                    setAlertOpen(true);
                                                }}
                                                className={cn("px-4 py-2 rounded-md text-sm font-bold transition-all", config?.strategy === 'regular' ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white")}
                                            >
                                                Regular Pricing
                                            </button>
                                        </div>
                                        <div className="flex items-center text-xs text-slate-400">
                                            Current: <span className="font-mono text-emerald-400 ml-2">{config?.strategy?.toUpperCase()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-6 flex items-center justify-between bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className={cn("h-3 w-3 rounded-full animate-pulse", appEnv === 'production' ? "bg-purple-600" : "bg-amber-500")}></div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Connected Environment</div>
                                        <div className={cn("text-lg font-black tracking-tight", appEnv === 'production' ? "text-purple-700" : "text-amber-600")}>
                                            {appEnv === 'production' ? "PRODUCTION" : "DEVELOPMENT LOCALHOST"}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-400 text-right">
                                    Changes here apply ONLY to<br />the <strong>{appEnv === 'production' ? "DIDYOUQUIT.COM" : "LOCAL"}</strong> environment.
                                </div>
                            </div>

                            <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>
                                            {pendingMode
                                                ? `Switch ${appEnv.toUpperCase()} to ${pendingMode === 'live' ? 'Live Mode' : 'Test Mode'}?`
                                                : `Switch to ${pendingStrategy === 'sale' ? 'Sale' : 'Regular'} Pricing?`
                                            }
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {pendingMode && (pendingMode === 'live'
                                                ? `You are about to switch ${appEnv.toUpperCase()} to Live Mode. This means real money will be processed for any new transactions.`
                                                : `You are about to switch ${appEnv.toUpperCase()} to Test Mode. This is a sandbox environment.`)}
                                            {pendingStrategy && `This will update the active pricing strategy to ${pendingStrategy === 'sale' ? '"Sale Pricing"' : '"Regular Pricing"'} for all users immediately.`}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => {
                                            setPendingMode(null);
                                            setPendingStrategy(null);
                                        }}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => {
                                            if (pendingMode) {
                                                const currentModes = config?.modes || {
                                                    production: config?.mode || 'test',
                                                    development: 'test'
                                                };
                                                updateConfig({
                                                    modes: {
                                                        ...currentModes,
                                                        [appEnv]: pendingMode
                                                    }
                                                });
                                                setPendingMode(null);
                                            } else if (pendingStrategy) {
                                                updateConfig({ strategy: pendingStrategy });
                                                setPendingStrategy(null);
                                            }
                                        }} className={pendingMode === 'live' ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}>
                                            Confirm Switch
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Test Mode Card */}
                                <div className={cn("border-2 rounded-xl p-6 relative transition-all", config?.modes?.[appEnv] === 'test' ? "border-emerald-500 bg-emerald-50/10 ring-4 ring-emerald-500/10" : "border-slate-200 bg-white")}>
                                    <div className="absolute -top-3 left-6 px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full shadow-lg">
                                        TEST MODE
                                    </div>
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-bold text-slate-900 mb-1">Test Mode Configuration</h3>
                                        {config?.modes?.[appEnv] !== 'test' && (
                                            <button
                                                onClick={() => {
                                                    setPendingMode('test');
                                                    setAlertOpen(true);
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors"
                                            >
                                                Activate Test Mode
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <div className={cn("bg-emerald-50/50 rounded-lg p-3 space-y-2 border", config?.strategy === 'sale' ? "border-emerald-500 shadow-sm ring-1 ring-emerald-500/20" : "border-emerald-100")}>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-emerald-600 uppercase flex items-center gap-2">
                                                    Sale Pricing
                                                    {config?.strategy === 'sale' && <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">ACTIVE</span>}
                                                </h4>
                                                {config?.strategy !== 'sale' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPendingStrategy('sale');
                                                            setAlertOpen(true);
                                                        }}
                                                        className="text-[10px] bg-white border border-emerald-200 text-emerald-600 px-2 py-0.5 rounded hover:bg-emerald-50"
                                                    >
                                                        ACTIVATE
                                                    </button>
                                                )}
                                            </div>

                                            <label className="text-[10px] font-medium text-slate-500 block">Monthly Price ID</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 text-xs p-1.5 border rounded bg-white font-mono text-slate-600"
                                                    value={config?.test?.sale?.monthlyPriceId || ''}
                                                    onChange={(e) => updateConfig({ test: { ...config?.test, sale: { ...config?.test?.sale, monthlyPriceId: e.target.value } } as any })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => fetchPriceDetails(config?.test?.sale?.monthlyPriceId, 'test')}>
                                                    <RefreshCw className={cn("h-3 w-3", loadingPrice ? "animate-spin" : "")} />
                                                </Button>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Crossed Out ($)"
                                                className="w-full text-xs p-1.5 border rounded bg-slate-50 text-slate-400 mt-1"
                                                value={config?.test?.sale?.crossoutMonthly || ''}
                                                onChange={(e) => updateConfig({ test: { ...config?.test, sale: { ...config?.test?.sale, crossoutMonthly: e.target.value } } as any })}
                                                onClick={(e) => e.stopPropagation()}
                                            />

                                            <label className="text-[10px] font-medium text-slate-500 block mt-2">Yearly Price ID</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 text-xs p-1.5 border rounded bg-white font-mono text-slate-600"
                                                    value={config?.test?.sale?.yearlyPriceId || ''}
                                                    onChange={(e) => updateConfig({ test: { ...config?.test, sale: { ...config?.test?.sale, yearlyPriceId: e.target.value } } as any })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => fetchPriceDetails(config?.test?.sale?.yearlyPriceId, 'test')}>
                                                    <RefreshCw className={cn("h-3 w-3", loadingPrice ? "animate-spin" : "")} />
                                                </Button>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Crossed Out ($)"
                                                className="w-full text-xs p-1.5 border rounded bg-slate-50 text-slate-400 mt-1"
                                                value={config?.test?.sale?.crossoutYearly || ''}
                                                onChange={(e) => updateConfig({ test: { ...config?.test, sale: { ...config?.test?.sale, crossoutYearly: e.target.value } } as any })}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>

                                        <div className={cn("bg-white rounded-lg p-3 space-y-2 border", config?.strategy === 'regular' ? "border-blue-500 shadow-sm ring-1 ring-blue-500/20" : "border-slate-200")}>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                                                    Regular Pricing
                                                    {config?.strategy === 'regular' && <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">ACTIVE</span>}
                                                </h4>
                                                {config?.strategy !== 'regular' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPendingStrategy('regular');
                                                            setAlertOpen(true);
                                                        }}
                                                        className="text-[10px] bg-white border border-blue-200 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-50"
                                                    >
                                                        ACTIVATE
                                                    </button>
                                                )}
                                            </div>
                                            <label className="text-[10px] font-medium text-slate-500 block">Monthly Price ID</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 text-xs p-1.5 border rounded bg-white font-mono text-slate-600"
                                                    value={config?.test?.regular?.monthlyPriceId || ''}
                                                    onChange={(e) => updateConfig({ test: { ...config?.test, regular: { ...config?.test?.regular, monthlyPriceId: e.target.value } } as any })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => fetchPriceDetails(config?.test?.regular?.monthlyPriceId, 'test')}>
                                                    <RefreshCw className={cn("h-3 w-3", loadingPrice ? "animate-spin" : "")} />
                                                </Button>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Promo Text (e.g. 20% Off)"
                                                className="w-full text-xs p-1.5 border rounded bg-emerald-50 text-emerald-700 mt-1 placeholder:text-emerald-300/50"
                                                value={config?.test?.regular?.promoMonthly || ''}
                                                onChange={(e) => updateConfig({ test: { ...config?.test, regular: { ...config?.test?.regular, promoMonthly: e.target.value } } as any })}
                                                onClick={(e) => e.stopPropagation()}
                                            />

                                            <label className="text-[10px] font-medium text-slate-500 block mt-2">Yearly Price ID</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 text-xs p-1.5 border rounded bg-white font-mono text-slate-600"
                                                    value={config?.test?.regular?.yearlyPriceId || ''}
                                                    onChange={(e) => updateConfig({ test: { ...config?.test, regular: { ...config?.test?.regular, yearlyPriceId: e.target.value } } as any })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => fetchPriceDetails(config?.test?.regular?.yearlyPriceId, 'test')}>
                                                    <RefreshCw className={cn("h-3 w-3", loadingPrice ? "animate-spin" : "")} />
                                                </Button>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Promo Text (e.g. 20% Off)"
                                                className="w-full text-xs p-1.5 border rounded bg-emerald-50 text-emerald-700 mt-1 placeholder:text-emerald-300/50"
                                                value={config?.test?.regular?.promoYearly || ''}
                                                onChange={(e) => updateConfig({ test: { ...config?.test, regular: { ...config?.test?.regular, promoYearly: e.target.value } } as any })}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase">MARKETING COPY</h4>
                                            <div className="bg-slate-100 p-0.5 rounded flex gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setMarketingTab('sale'); }}
                                                    className={cn("px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1", marketingTab === 'sale' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400")}
                                                >
                                                    Sale
                                                    {config?.strategy === 'sale' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setMarketingTab('regular'); }}
                                                    className={cn("px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1", marketingTab === 'regular' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}
                                                >
                                                    Regular
                                                    {config?.strategy === 'regular' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Title</label>
                                                <input
                                                    type="text"
                                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                                    value={config?.test?.[marketingTab]?.marketingHeader || ''}
                                                    onChange={(e) => updateConfig({
                                                        test: {
                                                            ...config?.test,
                                                            [marketingTab]: {
                                                                ...config?.test?.[marketingTab],
                                                                marketingHeader: e.target.value
                                                            }
                                                        } as any
                                                    })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Subtext</label>
                                                <input
                                                    type="text"
                                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                                    value={config?.test?.[marketingTab]?.marketingSubtext || ''}
                                                    onChange={(e) => updateConfig({
                                                        test: {
                                                            ...config?.test,
                                                            [marketingTab]: {
                                                                ...config?.test?.[marketingTab],
                                                                marketingSubtext: e.target.value
                                                            }
                                                        } as any
                                                    })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Features (one per line)</label>
                                                <Textarea
                                                    className="w-full text-xs p-1.5 border rounded bg-white min-h-[100px]"
                                                    value={config?.test?.[marketingTab]?.features?.join('\n') || ''}
                                                    onChange={(e) => updateConfig({
                                                        test: {
                                                            ...config?.test,
                                                            [marketingTab]: {
                                                                ...config?.test?.[marketingTab],
                                                                features: e.target.value.split('\n')
                                                            }
                                                        } as any
                                                    })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Live Mode Card */}
                                <div className={cn("border-2 rounded-xl p-6 relative transition-all", config?.modes?.[appEnv] === 'live' ? "border-emerald-500 bg-emerald-50/10 ring-4 ring-emerald-500/10" : "border-slate-200 bg-white")}>
                                    <div className="absolute -top-3 left-6 px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full shadow-lg">
                                        LIVE MODE
                                    </div>
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-bold text-slate-900 mb-1">Live Mode Configuration</h3>
                                        {config?.modes?.[appEnv] !== 'live' && (
                                            <button
                                                onClick={() => {
                                                    setPendingMode('live');
                                                    setAlertOpen(true);
                                                }}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors"
                                            >
                                                Activate Live Mode
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        {/* Sale Pricing Section */}
                                        <div className={cn("bg-emerald-50/50 rounded-lg p-3 space-y-2 border", config?.strategy === 'sale' ? "border-emerald-500 shadow-sm ring-1 ring-emerald-500/20" : "border-emerald-100")}>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-emerald-600 uppercase flex items-center gap-2">
                                                    Sale Pricing
                                                    {config?.strategy === 'sale' && <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">ACTIVE</span>}
                                                </h4>
                                                {config?.strategy !== 'sale' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPendingStrategy('sale');
                                                            setAlertOpen(true);
                                                        }}
                                                        className="text-[10px] bg-white border border-emerald-200 text-emerald-600 px-2 py-0.5 rounded hover:bg-emerald-50"
                                                    >
                                                        ACTIVATE
                                                    </button>
                                                )}
                                            </div>

                                            <label className="text-[10px] font-medium text-slate-500 block">Monthly Price ID</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 text-xs p-1.5 border rounded bg-white font-mono text-slate-600"
                                                    value={config?.live?.sale?.monthlyPriceId || ''}
                                                    onChange={(e) => updateConfig({ live: { ...config?.live, sale: { ...config?.live?.sale, monthlyPriceId: e.target.value } } as any })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => fetchPriceDetails(config?.live?.sale?.monthlyPriceId, 'live')}>
                                                    <RefreshCw className={cn("h-3 w-3", loadingPrice ? "animate-spin" : "")} />
                                                </Button>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Crossed Out ($)"
                                                className="w-full text-xs p-1.5 border rounded bg-slate-50 text-slate-400 mt-1"
                                                value={config?.live?.sale?.crossoutMonthly || ''}
                                                onChange={(e) => updateConfig({ live: { ...config?.live, sale: { ...config?.live?.sale, crossoutMonthly: e.target.value } } as any })}
                                                onClick={(e) => e.stopPropagation()}
                                            />

                                            <label className="text-[10px] font-medium text-slate-500 block mt-2">Yearly Price ID</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 text-xs p-1.5 border rounded bg-white font-mono text-slate-600"
                                                    value={config?.live?.sale?.yearlyPriceId || ''}
                                                    onChange={(e) => updateConfig({ live: { ...config?.live, sale: { ...config?.live?.sale, yearlyPriceId: e.target.value } } as any })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => fetchPriceDetails(config?.live?.sale?.yearlyPriceId, 'live')}>
                                                    <RefreshCw className={cn("h-3 w-3", loadingPrice ? "animate-spin" : "")} />
                                                </Button>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Crossed Out ($)"
                                                className="w-full text-xs p-1.5 border rounded bg-slate-50 text-slate-400 mt-1"
                                                value={config?.live?.sale?.crossoutYearly || ''}
                                                onChange={(e) => updateConfig({ live: { ...config?.live, sale: { ...config?.live?.sale, crossoutYearly: e.target.value } } as any })}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>

                                        {/* Regular Pricing Section */}
                                        <div className={cn("bg-white rounded-lg p-3 space-y-2 border", config?.strategy === 'regular' ? "border-blue-500 shadow-sm ring-1 ring-blue-500/20" : "border-slate-200")}>
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-slate-600 uppercase flex items-center gap-2">
                                                    Regular Pricing
                                                    {config?.strategy === 'regular' && <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">ACTIVE</span>}
                                                </h4>
                                                {config?.strategy !== 'regular' && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPendingStrategy('regular');
                                                            setAlertOpen(true);
                                                        }}
                                                        className="text-[10px] bg-white border border-blue-200 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-50"
                                                    >
                                                        ACTIVATE
                                                    </button>
                                                )}
                                            </div>
                                            <label className="text-[10px] font-medium text-slate-500 block">Monthly Price ID</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 text-xs p-1.5 border rounded bg-white font-mono text-slate-600"
                                                    value={config?.live?.regular?.monthlyPriceId || ''}
                                                    onChange={(e) => updateConfig({ live: { ...config?.live, regular: { ...config?.live?.regular, monthlyPriceId: e.target.value } } as any })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => fetchPriceDetails(config?.live?.regular?.monthlyPriceId, 'live')}>
                                                    <RefreshCw className={cn("h-3 w-3", loadingPrice ? "animate-spin" : "")} />
                                                </Button>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Promo Text (e.g. 20% Off)"
                                                className="w-full text-xs p-1.5 border rounded bg-emerald-50 text-emerald-700 mt-1 placeholder:text-emerald-300/50"
                                                value={config?.live?.regular?.promoMonthly || ''}
                                                onChange={(e) => updateConfig({ live: { ...config?.live, regular: { ...config?.live?.regular, promoMonthly: e.target.value } } as any })}
                                                onClick={(e) => e.stopPropagation()}
                                            />

                                            <label className="text-[10px] font-medium text-slate-500 block mt-2">Yearly Price ID</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 text-xs p-1.5 border rounded bg-white font-mono text-slate-600"
                                                    value={config?.live?.regular?.yearlyPriceId || ''}
                                                    onChange={(e) => updateConfig({ live: { ...config?.live, regular: { ...config?.live?.regular, yearlyPriceId: e.target.value } } as any })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => fetchPriceDetails(config?.live?.regular?.yearlyPriceId, 'live')}>
                                                    <RefreshCw className={cn("h-3 w-3", loadingPrice ? "animate-spin" : "")} />
                                                </Button>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Promo Text (e.g. 20% Off)"
                                                className="w-full text-xs p-1.5 border rounded bg-emerald-50 text-emerald-700 mt-1 placeholder:text-emerald-300/50"
                                                value={config?.live?.regular?.promoYearly || ''}
                                                onChange={(e) => updateConfig({ live: { ...config?.live, regular: { ...config?.live?.regular, promoYearly: e.target.value } } as any })}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase">MARKETING COPY</h4>
                                            <div className="bg-slate-100 p-0.5 rounded flex gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setMarketingTab('sale'); }}
                                                    className={cn("px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1", marketingTab === 'sale' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400")}
                                                >
                                                    Sale
                                                    {config?.strategy === 'sale' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setMarketingTab('regular'); }}
                                                    className={cn("px-2 py-0.5 text-[10px] font-bold rounded flex items-center gap-1", marketingTab === 'regular' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400")}
                                                >
                                                    Regular
                                                    {config?.strategy === 'regular' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Title</label>
                                                <input
                                                    type="text"
                                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                                    value={config?.live?.[marketingTab]?.marketingHeader || ''}
                                                    onChange={(e) => updateConfig({
                                                        live: {
                                                            ...config?.live,
                                                            [marketingTab]: {
                                                                ...config?.live?.[marketingTab],
                                                                marketingHeader: e.target.value
                                                            }
                                                        } as any
                                                    })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Subtext</label>
                                                <input
                                                    type="text"
                                                    className="w-full text-xs p-1.5 border rounded bg-white"
                                                    value={config?.live?.[marketingTab]?.marketingSubtext || ''}
                                                    onChange={(e) => updateConfig({
                                                        live: {
                                                            ...config?.live,
                                                            [marketingTab]: {
                                                                ...config?.live?.[marketingTab],
                                                                marketingSubtext: e.target.value
                                                            }
                                                        } as any
                                                    })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Features (one per line)</label>
                                                <Textarea
                                                    className="w-full text-xs p-1.5 border rounded bg-white min-h-[100px]"
                                                    value={config?.live?.[marketingTab]?.features?.join('\n') || ''}
                                                    onChange={(e) => updateConfig({
                                                        live: {
                                                            ...config?.live,
                                                            [marketingTab]: {
                                                                ...config?.live?.[marketingTab],
                                                                features: e.target.value.split('\n')
                                                            }
                                                        } as any
                                                    })}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>





                </Tabs>
            </main>
        </div>
    );
}

function UserRow({ user, onToggleHide, onDelete }: { user: any, onToggleHide: any, onDelete: any }) {
    const [expanded, setExpanded] = useState(true); // Default to expanded
    const [resolutions, setResolutions] = useState<any[]>([]);
    const [loadingRes, setLoadingRes] = useState(true); // Default to loading
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        // Auto-fetch on mount
        const fetchRes = async () => {
            try {
                const q = query(collection(db, "resolutions"), where("uid", "==", user.uid));
                const snap = await getDocs(q);
                setResolutions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (error) {
                console.error("Error loading resolutions", error);
            } finally {
                setLoadingRes(false);
                setLoaded(true);
            }
        };
        fetchRes();
    }, [user.uid]);

    const toggleExpand = () => {
        setExpanded(!expanded);
    };

    return (
        <>
            <tr className={`hover:bg-slate-50/50 transition-colors ${expanded ? "bg-slate-50/80" : ""}`}>
                <td className="p-4">
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400" onClick={toggleExpand}>
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </td>
                <td className="p-4">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={user.photoURL} />
                            <AvatarFallback>{user.username?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-slate-900">{user.username}</span>
                    </div>
                </td>
                <td className="p-4 text-slate-600">
                    {user.email || <span className="text-slate-300 italic">No Email</span>}
                </td>
                <td className="p-4">
                    {user.isHidden ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                            <EyeOff className="h-3 w-3" /> Hidden
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                            Active
                        </span>
                    )}
                </td>
                <td className="p-4 text-right space-x-2">
                    <Button
                        size="sm"
                        variant="outline"
                        className={user.isHidden ? "text-emerald-600 hover:text-emerald-700" : "text-amber-600 hover:text-amber-700"}
                        onClick={() => onToggleHide(user.uid, user.isHidden)}
                    >
                        {user.isHidden ? <><Eye className="h-4 w-4 mr-1" /> Unhide</> : <><EyeOff className="h-4 w-4 mr-1" /> Hide</>}
                    </Button>
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(user.uid)}
                        disabled={user.email === 'contact@didyouquit.com'}
                        title={user.email === 'contact@didyouquit.com' ? "Cannot delete Super Admin" : "Delete User"}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </td>
            </tr>
            {expanded && (
                <tr className="bg-slate-50/50">
                    <td colSpan={5} className="p-4 pl-12 pt-0 pb-6 border-b border-slate-100">
                        <div className="bg-white rounded-lg border border-slate-200 p-4">
                            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
                                <Target className="h-4 w-4 text-emerald-600" />
                                User Resolutions ({loadingRes ? "..." : resolutions.length})
                            </h4>
                            {loadingRes ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                </div>
                            ) : resolutions.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {resolutions.map(res => (
                                        <div key={res.id} className="p-3 bg-slate-50 rounded border border-slate-100 text-sm">
                                            <div className="font-medium text-slate-900 mb-1">{res.title}</div>
                                            {res.description && <div className="text-slate-500 text-xs line-clamp-1">{res.description}</div>}
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-medium">
                                                    Current Streak: {res.currentStreak || 0}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-400 italic text-sm">No resolutions found.</p>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

function AdminCommentItem({ comment, postId, onDelete }: { comment: Comment, postId: string, onDelete: (pid: string, cid: string) => void }) {
    return (
        <div className="flex gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200/60">
            <Avatar className="h-8 w-8 mt-1 border border-slate-200 bg-white">
                <AvatarImage src={comment.author?.photoURL} />
                <AvatarFallback>{comment.author?.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm text-slate-900">{comment.author?.username || "Unknown"}</span>
                            <span className="text-xs text-slate-400">
                                {comment.createdAt?.seconds ? formatDistanceToNow(new Date(comment.createdAt.seconds * 1000), { addSuffix: true }) : ''}
                            </span>
                        </div>
                        <p className="text-slate-700 text-sm whitespace-pre-wrap">{comment.content}</p>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                        title="Delete Reply"
                        onClick={() => onDelete(postId, comment.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>

                {/* Nested Replies */}
                {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-4 pl-4 border-l-2 border-slate-200 space-y-4">
                        {comment.replies.map((reply: any) => (
                            <AdminCommentItem
                                key={reply.id}
                                comment={reply}
                                postId={postId}
                                onDelete={onDelete}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
