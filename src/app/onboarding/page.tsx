"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { db } from "@/lib/firebase";
import { doc, setDoc, getDocs, collection, query, where, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/error-utils";

const COUNTRIES = [
    "United States", "United Kingdom", "Canada", "Australia", "India",
    "Germany", "France", "Japan", "Brazil", "Other"
];

export default function Onboarding() {
    const { user, userData, loading, refreshUserData } = useAuth();
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [country, setCountry] = useState("");
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/");
            } else if (userData) {
                router.push("/my-resolutions");
            } else {
                // Generate random username
                const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                setUsername(`user${randomSuffix}`);
            }
        }
    }, [user, userData, loading, router]);

    // Debounce check username
    useEffect(() => {
        const checkAvailability = async () => {
            if (username.length < 3) {
                setIsAvailable(false);
                return;
            }
            setIsChecking(true);
            try {
                const q = query(collection(db, "users"), where("username", "==", username));
                const querySnapshot = await getDocs(q);
                setIsAvailable(querySnapshot.empty);
            } catch (error) {
                console.error("Error checking username:", error);
            } finally {
                setIsChecking(false);
            }
        };

        const timeoutId = setTimeout(() => {
            if (username) checkAvailability();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [username]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!isAvailable) {
            toast.error("Username is not available");
            return;
        }
        if (!country) {
            toast.error("Please select a country");
            return;
        }

        setIsSubmitting(true);
        try {
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                username,
                country,
                photoURL: user.photoURL || `https://api.dicebear.com/9.x/shapes/svg?seed=${username}`,
                createdAt: serverTimestamp(),
            });
            await refreshUserData();
            router.push("/dashboard");
            toast.success("Welcome aboard!");
        } catch (error: any) {
            const msg = getFriendlyErrorMessage(error);
            if (msg) toast.error(msg);
            setIsSubmitting(false);
        }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Welcome! Let's get you set up.</CardTitle>
                    <CardDescription>
                        Choose how you'll appear to others on DidYouQuit.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <div className="relative">
                                <Input
                                    id="username"
                                    value={username}
                                    onChange={(e) => {
                                        setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""));
                                        setIsAvailable(null);
                                    }}
                                    className={isAvailable === true ? "border-green-500 pr-10" : isAvailable === false ? "border-red-500 pr-10" : "pr-10"}
                                    placeholder="username"
                                    minLength={3}
                                    maxLength={20}
                                    required
                                />
                                <div className="absolute right-3 top-2.5 h-4 w-4">
                                    {isChecking ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    ) : isAvailable === true ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : isAvailable === false ? (
                                        <X className="h-4 w-4 text-red-500" />
                                    ) : null}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                This will be your unique handle.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="country">Country</Label>
                            <Select onValueChange={setCountry} value={country}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select your country" />
                                </SelectTrigger>
                                <SelectContent>
                                    {COUNTRIES.map((c) => (
                                        <SelectItem key={c} value={c}>
                                            {c}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button type="submit" className="w-full" disabled={isSubmitting || !isAvailable}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Start Tracking"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
