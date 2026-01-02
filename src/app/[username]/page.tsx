"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Globe, Calendar, Target, Award, MapPin, Pencil } from "lucide-react";
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
import { EditProfileDialog } from "@/components/profile/EditProfileDialog";

interface UserProfile {
    uid: string;
    username: string;
    country: string;
    photoURL: string;
    createdAt?: any;
}

interface Resolution {
    id: string;
    title: string;
    weeklyLog: Record<string, boolean>;
    createdAt?: any;
}

export default function PublicProfile() {
    const params = useParams();
    const router = useRouter();
    const username = params.username as string;
    const { user: currentUser } = useAuth();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [resolutions, setResolutions] = useState<Resolution[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [isEditOpen, setIsEditOpen] = useState(false);

    const isOwner = currentUser?.uid === profile?.uid;

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
            } catch (err) {
                console.error(err);
                setError("Failed to load profile");
            } finally {
                setLoading(false);
            }
        };

        if (username) fetchData();
    }, [username]);

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
                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-br from-emerald-50 to-teal-50/50" />

                <div className="container mx-auto px-4 pt-20 pb-12 relative">
                    <div className="flex flex-col items-center gap-6">
                        <div className="relative group">
                            <Avatar className="h-32 w-32 border-4 border-white shadow-xl bg-white">
                                <AvatarImage src={profile.photoURL} />
                                <AvatarFallback className="text-3xl bg-emerald-100 text-emerald-700 font-bold">
                                    {profile.username[0].toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            {isOwner && (
                                <button
                                    onClick={() => setIsEditOpen(true)}
                                    className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Pencil className="h-8 w-8 text-white" />
                                </button>
                            )}
                        </div>

                        <div className="flex-1 text-center mb-2">
                            <div className="flex items-center justify-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-slate-900">{profile.username}</h1>
                                {isOwner && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900"
                                        onClick={() => setIsEditOpen(true)}
                                    >
                                        <Pencil className="h-4 w-4" />
                                        <span className="sr-only">Edit Profile</span>
                                    </Button>
                                )}
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


                    </div>
                </div>
            </section>

            <main className="container mx-auto px-4 py-12 max-w-5xl">
                {resolutions.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                        <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Target className="h-8 w-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-1">No Public Resolutions</h3>
                        <p className="text-slate-500">{profile.username} hasn't shared any goals yet.</p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">My Resolutions 2026</h2>
                        {resolutions.map((res) => (
                            <div key={res.id} className="bg-white rounded-xl p-6 md:p-8 border border-slate-100 shadow-sm transition-shadow hover:shadow-md">
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

                                <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-semibold text-slate-700">Progress (52 Weeks)</h4>
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        <TooltipProvider delayDuration={0}>
                                            {weeks.map((week) => {
                                                const weekKey = `${currentYear}-W${week.toString().padStart(2, '0')}`;
                                                const status = res.weeklyLog?.[weekKey];

                                                let colorClass = "bg-slate-200 border-slate-300";
                                                let statusText = "Upcoming";

                                                if (status === true) {
                                                    colorClass = "bg-emerald-500 border-emerald-500 shadow-sm shadow-emerald-200";
                                                    statusText = "Kept it 🔥";
                                                } else if (status === false) {
                                                    colorClass = "bg-red-400 border-red-400";
                                                    statusText = "Missed";
                                                }

                                                return (
                                                    <Tooltip key={week}>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                type="button"
                                                                className={clsx(
                                                                    "w-4 h-4 rounded-full border shrink-0 transition-transform hover:scale-125 focus:scale-125 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400",
                                                                    colorClass
                                                                )}
                                                            />
                                                        </TooltipTrigger>
                                                        <TooltipContent className="bg-slate-900 text-white border-none shadow-xl">
                                                            <div className="text-xs">
                                                                <p className="font-bold mb-0.5">Week {week}</p>
                                                                <p className="text-slate-300 mb-1.5">{getWeekRange(week)}</p>
                                                                <p className={clsx(
                                                                    "font-medium",
                                                                    status === true ? "text-emerald-400" :
                                                                        status === false ? "text-red-400" : "text-slate-400"
                                                                )}>{statusText}</p>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                );
                                            })}
                                        </TooltipProvider>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>


            <Footer />

            {profile && (
                <EditProfileDialog
                    open={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    currentUsername={profile.username}
                    currentPhotoURL={profile.photoURL}
                    onSuccess={(newUsername) => {
                        // Optimistic update or redirect if username changed
                        if (newUsername !== profile.username) {
                            router.push(`/${newUsername}`);
                        } else {
                            // If just photo changed, we could refresh, but reloading page or updating state is clearer
                            window.location.reload();
                        }
                    }}
                />
            )}
        </div>
    );
}
