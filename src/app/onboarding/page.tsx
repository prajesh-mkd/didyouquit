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
import { generateAvatar } from "@/lib/generateAvatar";

import { IMAGINATIVE_USERNAMES } from "@/lib/constants/usernames";
import { COUNTRIES } from "@/lib/constants/countries";



const checkUsernameAvailability = async (name: string): Promise<boolean> => {
    try {
        const q = query(collection(db, "users"), where("username", "==", name));
        const querySnapshot = await getDocs(q);
        return querySnapshot.empty;
    } catch (error) {
        console.error("Error checking username:", error);
        return false;
    }
};

export default function Onboarding() {
    const { user, userData, loading, refreshUserData } = useAuth();
    const router = useRouter();

    const [username, setUsername] = useState("");
    const [country, setCountry] = useState("");
    const [countryError, setCountryError] = useState(false);
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
                // Generate username with iterative length strategy
                const generateUsername = async () => {
                    const randomName = IMAGINATIVE_USERNAMES[Math.floor(Math.random() * IMAGINATIVE_USERNAMES.length)];

                    // Try 2 digits
                    let suffix = Math.floor(Math.random() * 90) + 10;
                    let candidate = `${randomName}${suffix}`;
                    if (await checkUsernameAvailability(candidate)) {
                        setUsername(candidate);
                        return;
                    }

                    // Try 3 digits
                    suffix = Math.floor(Math.random() * 900) + 100;
                    candidate = `${randomName}${suffix}`;
                    if (await checkUsernameAvailability(candidate)) {
                        setUsername(candidate);
                        return;
                    }

                    // Try 4 digits (Final fallback)
                    suffix = Math.floor(Math.random() * 9000) + 1000;
                    candidate = `${randomName}${suffix}`;
                    setUsername(candidate);
                };

                generateUsername();
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
                const available = await checkUsernameAvailability(username);
                setIsAvailable(available);
            } catch (error) {
                console.error(error);
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
            setCountryError(true);
            toast.error("Please select a country");
            return;
        }

        setIsSubmitting(true);
        try {
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: user.email,
                username,
                country,
                photoURL: generateAvatar(username),
                createdAt: serverTimestamp(),
            });
            await refreshUserData();
            router.push("/my-resolutions");
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
                            <p className={`text-xs ${isAvailable === false ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                                {isAvailable === false
                                    ? "This username is already taken. Please try another."
                                    : "This will be your unique handle."}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="country">Country</Label>
                            <Select
                                onValueChange={(val) => {
                                    setCountry(val);
                                    setCountryError(false);
                                }}
                                value={country}
                            >
                                <SelectTrigger className={countryError ? "border-red-500 ring-offset-0 focus:ring-0" : ""}>
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

                        <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-lg font-medium shadow-lg shadow-emerald-200" disabled={isSubmitting || !isAvailable}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Let's Go!"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
