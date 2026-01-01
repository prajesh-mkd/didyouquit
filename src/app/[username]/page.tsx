"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, FolderCheck } from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface UserProfile {
    uid: string;
    username: string;
    country: string;
    photoURL: string;
}

interface Resolution {
    id: string;
    title: string;
    weeklyLog: Record<string, boolean>;
}

export default function PublicProfile() {
    const params = useParams();
    const username = params.username as string;

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [resolutions, setResolutions] = useState<Resolution[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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
                    // we could order by createdAt if we had an index, for now client sort
                );
                const resSnapshot = await getDocs(resQuery);
                const resData: Resolution[] = [];
                resSnapshot.forEach((doc) => {
                    resData.push({ id: doc.id, ...doc.data() } as Resolution);
                });

                // Manual sort (optional)
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
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="flex flex-col h-screen items-center justify-center gap-4">
                <h1 className="text-2xl font-bold">{error || "User not found"}</h1>
                <Button asChild>
                    <Link href="/">Back to Home</Link>
                </Button>
            </div>
        );
    }

    // Generate last 52 weeks or so strictly for display? 
    // For now, let's just show what we have + pads? 
    // The requirement is "tick mark each week". Green/Red dot.
    // Getting list of weeks for the current year up to now would be ideal.
    // But for simple display, let's just show the logged weeks.

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <header className="border-b bg-background/95 backdrop-blur">
                <div className="container flex h-14 items-center gap-2 px-4">
                    <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                        <FolderCheck className="h-6 w-6 text-primary" />
                        <span>DidYouQuit?</span>
                    </Link>
                </div>
            </header>

            <main className="container py-12 px-4 max-w-4xl mx-auto">
                <div className="flex flex-col items-center mb-12 space-y-4">
                    <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                        <AvatarImage src={profile.photoURL} />
                        <AvatarFallback>{profile.username[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                        <h1 className="text-3xl font-bold">@{profile.username}</h1>
                        <p className="text-muted-foreground mt-1 flex items-center justify-center gap-2">
                            <span>{profile.country}</span>
                        </p>
                    </div>
                </div>

                <div className="grid gap-6">
                    {resolutions.map((res) => (
                        <div key={res.id} className="border rounded-lg p-6 bg-card shadow-sm">
                            <h3 className="font-semibold text-xl mb-4">{res.title}</h3>

                            <div className="grid grid-cols-[repeat(auto-fill,minmax(20px,1fr))] gap-2 sm:gap-3">
                                {/* Display sorted keys */}
                                {Object.entries(res.weeklyLog)
                                    .sort((a, b) => a[0].localeCompare(b[0])) // Ascending time
                                    .map(([week, success]) => (
                                        <TooltipProvider key={week} delayDuration={0}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        type="button"
                                                        className={clsx(
                                                            "h-5 w-5 rounded-full transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1",
                                                            success ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] focus:ring-green-500" : "bg-red-500 opacity-80 focus:ring-red-500"
                                                        )}
                                                    />
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{week}: {success ? "Kept it!" : "Missed"}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ))
                                }
                                {Object.keys(res.weeklyLog).length === 0 && (
                                    <span className="text-sm text-muted-foreground italic col-span-full">
                                        No updates yet.
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}

                    {resolutions.length === 0 && (
                        <div className="text-center text-muted-foreground">
                            {profile.username} hasn't shared any resolutions yet.
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
