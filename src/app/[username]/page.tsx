"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, doc, getDoc, setDoc, deleteDoc, serverTimestamp, getCountFromServer } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Globe, Calendar, Target, Award, MapPin, Pencil, Users, UserPlus, UserCheck, Flame } from "lucide-react";
import { toast } from "sonner";
import { clsx } from "clsx";
import Link from "next/link";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { format, setWeek, startOfWeek, endOfWeek } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { TimelinePills } from "@/components/resolutions/TimelinePills";
import { calculateStreak } from "@/lib/streak-utils";
import { createNotification } from "@/lib/notifications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeeklyJournalsTab } from "@/components/forums/WeeklyJournalsTab";

import { UserProfile } from "@/lib/types";

interface Resolution {
    id: string;
    title: string;
    weeklyLog: Record<string, boolean>;
    createdAt?: any;
    description?: string;
}

export default function PublicProfile() {
    const params = useParams();
    const router = useRouter();
    const username = params.username as string;
    const { user, userData } = useAuth();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [resolutions, setResolutions] = useState<Resolution[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Follow System State
    const [isFollowing, setIsFollowing] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [followLoading, setFollowLoading] = useState(false);

    const isOwner = user?.uid === profile?.uid;

    // Date Helpers
    const currentYear = new Date().getFullYear();
    const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

    const getWeekRange = (weekNum: number) => {
        const now = new Date();
        const targetDate = setWeek(now, weekNum, { weekStartsOn: 1 });
        const start = startOfWeek(targetDate, { weekStartsOn: 1 });
        const end = endOfWeek(targetDate, { weekStartsOn: 1 });
        return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Find user by username
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("username", "==", username));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    setError("User not found");
                    setLoading(false);
                    return;
                }

                const userDoc = querySnapshot.docs[0];
                const userData = userDoc.data() as UserProfile;
                setProfile(userData);

                // Fetch resolutions
                const resQuery = query(
                    collection(db, "resolutions"),
                    where("uid", "==", userData.uid)
                );
                const resSnapshot = await getDocs(resQuery);
                const resData: Resolution[] = [];
                resSnapshot.forEach((doc) => {
                    resData.push({ id: doc.id, ...doc.data() } as Resolution);
                });

                // Client-side sort by newest
                resData.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

                setResolutions(resData);

                // Fetch follow data
                fetchFollowData(userData.uid);

            } catch (err) {
                console.error(err);
                setError("Failed to load profile");
            } finally {
                setLoading(false);
            }
        };

        const fetchFollowData = async (uid: string) => {
            try {
                // Check if I am following this user
                if (user) {
                    const docRef = doc(db, "users", user.uid, "following", uid);
                    const docSnap = await getDoc(docRef);
                    setIsFollowing(docSnap.exists());
                }
            } catch (error) {
                console.error("Error fetching follow data:", error);
            }
            // Counts are hidden from UI per user request, so we don't fetch them.
        };

        if (username) fetchData();
    }, [username, user]); // Added user to dependency array for follow status check



    const handleFollow = async () => {
        if (!user || !profile) {
            toast.error("Please log in to follow");
            return;
        }

        // Prevent following self
        if (user.uid === profile.uid) {
            toast.info("This is your own account");
            return;
        }

        setFollowLoading(true);
        try {
            // Add to my following
            await setDoc(doc(db, "users", user.uid, "following", profile.uid), {
                username: profile.username,
                photoURL: profile.photoURL,
                timestamp: serverTimestamp()
            });
            // Add to their followers
            await setDoc(doc(db, "users", profile.uid, "followers", user.uid), {
                username: userData?.username || "Anonymous",
                photoURL: userData?.photoURL || null,
                timestamp: serverTimestamp()
            });

            // Send Notification
            await createNotification(profile.uid, 'follow', {
                senderUid: user.uid,
                senderUsername: userData?.username || "Anonymous",
                senderPhotoURL: userData?.photoURL,
                refId: user.uid
            });

            setIsFollowing(true);
            setFollowersCount(prev => prev + 1);
            toast.success(`Following ${profile.username}`);
        } catch (error) {
            toast.error("Failed to follow");
        } finally {
            setFollowLoading(false);
        }
    };

    const handleUnfollow = async () => {
        if (!user || !profile) return;
        setFollowLoading(true);
        try {
            await deleteDoc(doc(db, "users", user.uid, "following", profile.uid));
            await deleteDoc(doc(db, "users", profile.uid, "followers", user.uid));

            setIsFollowing(false);
            setFollowersCount(prev => Math.max(0, prev - 1));
            toast.success(`Unfollowed ${profile.username}`);
        } catch (error) {
            toast.error("Failed to unfollow");
        } finally {
            setFollowLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#F0FDF4]">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="min-h-screen flex flex-col bg-[#F0FDF4]">
                <Header />
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <div className="bg-white p-8 rounded-2xl shadow-lg border border-emerald-100 max-w-md w-full">
                        <div className="h-16 w-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Loader2 className="h-8 w-8 text-red-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">{error || "User not found"}</h1>
                        <p className="text-slate-500 mb-6">We couldn't find a profile for @{username}.</p>
                        <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Link href="/">Back to Home</Link>
                        </Button>
                    </div>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <Header />

            {/* Profile Header */}
            <section className="bg-white border-b border-emerald-100 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-br from-emerald-50 to-teal-50/50" />

                <div className="container mx-auto px-4 pt-10 pb-12 relative">
                    <div className="flex flex-col items-center gap-6">
                        <div className="relative group">
                            <Avatar className="h-32 w-32 border-4 border-white shadow-xl bg-white">
                                <AvatarImage src={profile.photoURL || undefined} />
                                <AvatarFallback className="text-3xl bg-emerald-100 text-emerald-700 font-bold">
                                    {profile.username[0].toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                        </div>

                        <div className="flex-1 text-center mb-2">
                            <div className="flex items-center justify-center gap-1.5 mb-2">
                                <h1 className="text-3xl font-bold text-slate-900">{profile.username}</h1>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
                                <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full">
                                    <Globe className="h-3.5 w-3.5" />
                                    <span>{profile.country}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Member since {profile.createdAt ? format(profile.createdAt.toDate(), "MMM yyyy") : "Jan 2026"}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                                    <Award className="h-3.5 w-3.5" />
                                    <span>{resolutions.length} Active {resolutions.length === 1 ? "Resolution" : "Resolutions"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Follow Action */}
                        <div className="flex flex-col items-center gap-4 mt-4">
                            {user && (
                                <Button
                                    onClick={isFollowing ? handleUnfollow : handleFollow}
                                    disabled={followLoading}
                                    size="sm"
                                    variant={isFollowing ? "outline" : "default"}
                                    className={isFollowing ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800" : "bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"}
                                >
                                    {followLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : isFollowing ? (
                                        <>
                                            <UserCheck className="h-4 w-4 mr-1.5" /> Following
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus className="h-4 w-4 mr-1.5" /> Follow
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>




                    </div>
                </div>
            </section>

            <main className="container mx-auto px-4 py-12 max-w-5xl">
                <Tabs defaultValue="resolutions" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-8 bg-slate-100/50 p-1 rounded-xl max-w-md mx-auto">
                        <TabsTrigger value="resolutions">Resolutions</TabsTrigger>
                        <TabsTrigger value="journals">Weekly Journal</TabsTrigger>
                    </TabsList>

                    <TabsContent value="resolutions">
                        {resolutions.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                                <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Target className="h-8 w-8 text-slate-300" />
                                </div>
                                <h3 className="text-lg font-medium text-slate-900 mb-1">No Public Resolutions</h3>
                                <p className="text-slate-500">{profile.username} hasn't shared any goals yet.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                                {/* Mobile View (Cards) */}
                                <div className="md:hidden divide-y divide-slate-100">
                                    {resolutions.map((res) => (
                                        <div key={res.id} className="p-6">
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                                                        <Target className="h-5 w-5 text-emerald-600" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-xl text-slate-900">{res.title}</h3>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-6">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="text-sm font-semibold text-slate-700">Progress (52 Weeks)</h4>
                                                </div>

                                                <div className="w-full">
                                                    <TimelinePills
                                                        resId={res.id}
                                                        weeklyLog={res.weeklyLog}
                                                        currentYear={currentYear}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop View (Table) */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left border-collapse table-fixed">
                                        <thead className="bg-emerald-50/50 text-emerald-900">
                                            <tr>
                                                <th className="p-4 pl-12 font-semibold border-b border-emerald-100 w-[60%]">
                                                    <div className="flex items-center gap-2">
                                                        <Target className="h-4 w-4 text-emerald-600" />
                                                        Resolution
                                                    </div>
                                                </th>
                                                <th className="p-4 pr-10 font-semibold border-b border-emerald-100">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-4 w-4 text-emerald-600" />
                                                        Progress (52 Weeks)
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {resolutions.map((res) => (
                                                <tr key={res.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="p-4 pl-12">
                                                        <div className="flex items-center gap-2 font-medium text-slate-800 text-lg">
                                                            {res.title}
                                                            {calculateStreak(res.weeklyLog) > 0 && (
                                                                <TooltipProvider delayDuration={0}>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 rounded-full border border-orange-100 cursor-help">
                                                                                <Flame className="h-3.5 w-3.5 text-orange-500 fill-orange-500" />
                                                                                <span className="text-xs font-bold text-orange-600">{calculateStreak(res.weeklyLog)}</span>
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>{calculateStreak(res.weeklyLog)} Week Streak!</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            )}
                                                        </div>
                                                        {res.description && (
                                                            <div className="text-sm text-slate-500 italic mt-0.5 max-w-[90%] line-clamp-2">
                                                                "{res.description}"
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4 pr-10">
                                                        <TimelinePills resId={res.id} weeklyLog={res.weeklyLog} currentYear={currentYear} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="journals">
                        <WeeklyJournalsTab uid={profile.uid} />
                    </TabsContent>
                </Tabs>
            </main>


            <Footer />


        </div>
    );
}
