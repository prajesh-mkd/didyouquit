"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, deleteDoc, writeBatch, increment } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, UserMinus, ExternalLink, Globe, LayoutGrid } from "lucide-react";
import { Header } from "@/components/layout/Header";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface FollowingUser {
    uid: string;
    username: string;
    photoURL?: string;
    country?: string;
    followedAt?: any;
}

export default function FollowingPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [following, setFollowing] = useState<FollowingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/");
            return;
        }

        const fetchFollowing = async () => {
            if (!user) return;
            try {
                const querySnapshot = await getDocs(collection(db, "users", user.uid, "following"));
                const users: FollowingUser[] = [];
                querySnapshot.forEach((doc) => {
                    users.push({ uid: doc.id, ...doc.data() } as FollowingUser);
                });
                setFollowing(users);
            } catch (error) {
                console.error("Error fetching following:", error);
                toast.error("Failed to load following list");
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchFollowing();
        }
    }, [user, authLoading, router]);

    const handleUnfollow = async (targetUid: string, targetUsername: string) => {
        if (!user) return;
        setActionLoading(targetUid);
        try {
            const batch = writeBatch(db);

            // 1. Remove from my 'following' collection
            const myFollowingRef = doc(db, "users", user.uid, "following", targetUid);
            batch.delete(myFollowingRef);

            // 2. Remove from their 'followers' collection
            const theirFollowerRef = doc(db, "users", targetUid, "followers", user.uid);
            batch.delete(theirFollowerRef);

            await batch.commit();

            setFollowing(prev => prev.filter(u => u.uid !== targetUid));
            toast.success(`Unfollowed ${targetUsername}`);
        } catch (error) {
            console.error("Error unfollowing:", error);
            toast.error("Failed to unfollow");
        } finally {
            setActionLoading(null);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
            <Header />

            <main className="container mx-auto px-4 py-8 max-w-5xl">
                <div className="flex items-center gap-3 mb-8">
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                        <LayoutGrid className="h-5 w-5 text-emerald-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Following ({following.length})</h1>
                </div>

                {following.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-200">
                        <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <UserMinus className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-1">Not following anyone yet</h3>
                        <p className="text-slate-500 mb-6">Find people with similar goals to follow!</p>
                        <Button onClick={() => router.push("/public-resolutions")} variant="outline">
                            Browse Public Resolutions
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {following.map((u) => (
                            <Card key={u.uid} className="overflow-hidden hover:shadow-md transition-all border-slate-200 group">
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between">
                                        <Link href={`/${u.username}`} className="flex items-center gap-3">
                                            <Avatar className="h-12 w-12 border-2 border-white shadow-sm cursor-pointer hover:opacity-90 transition-opacity">
                                                <AvatarImage src={u.photoURL} />
                                                <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold">
                                                    {u.username?.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <h3 className="font-bold text-slate-900 hover:text-emerald-700 transition-colors">
                                                    {u.username}
                                                </h3>
                                                {u.country && (
                                                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                                                        <Globe className="h-3 w-3" />
                                                        {u.country}
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    </div>

                                    <div className="mt-4 flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full text-xs h-8 border-slate-200 hover:bg-slate-50 text-slate-600"
                                            onClick={() => router.push(`/${u.username}`)}
                                        >
                                            <ExternalLink className="h-3 w-3 mr-1.5" /> View Profile
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full text-xs h-8 border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700"
                                            disabled={actionLoading === u.uid}
                                            onClick={() => handleUnfollow(u.uid, u.username)}
                                        >
                                            {actionLoading === u.uid ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <>
                                                    <UserMinus className="h-3 w-3 mr-1.5" /> Unfollow
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
