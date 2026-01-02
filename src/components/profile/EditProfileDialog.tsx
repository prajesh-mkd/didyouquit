"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, X, RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface EditProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentUsername: string;
    currentPhotoURL: string;
    onSuccess: (newUsername: string) => void;
}

export function EditProfileDialog({
    open,
    onOpenChange,
    currentUsername,
    currentPhotoURL,
    onSuccess
}: EditProfileDialogProps) {
    const { user, refreshUserData } = useAuth();
    const [username, setUsername] = useState(currentUsername);
    const [photoURL, setPhotoURL] = useState(currentPhotoURL);
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset state when opening
    useEffect(() => {
        if (open) {
            setUsername(currentUsername);
            setPhotoURL(currentPhotoURL);
            setIsAvailable(null);
        }
    }, [open, currentUsername, currentPhotoURL]);

    // Check availability
    useEffect(() => {
        const checkAvailability = async () => {
            if (username === currentUsername) {
                setIsAvailable(true); // Available if it's their own
                return;
            }
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
    }, [username, currentUsername]);

    const handleShuffleAvatar = () => {
        const randomSeed = Math.random().toString(36).substring(7);
        setPhotoURL(`https://api.dicebear.com/9.x/shapes/svg?seed=${randomSeed}`);
    };

    const handleSave = async () => {
        if (!user) return;
        if (!isAvailable) {
            toast.error("Username is not available or valid");
            return;
        }

        setIsSubmitting(true);
        try {
            await updateDoc(doc(db, "users", user.uid), {
                username: username,
                photoURL: photoURL
            });

            await refreshUserData();
            toast.success("Profile updated successfully!");
            onSuccess(username);
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to update profile");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                    <DialogDescription>
                        Update your public profile details.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center gap-4">
                        <Avatar className="h-24 w-24 border-4 border-slate-100">
                            <AvatarImage src={photoURL} />
                            <AvatarFallback>{username[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleShuffleAvatar}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Shuffle Avatar
                        </Button>
                    </div>

                    {/* Username Section */}
                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <div className="relative">
                            <Input
                                id="username"
                                value={username}
                                onChange={(e) => {
                                    setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""));
                                }}
                                className={isAvailable === true ? "border-green-500 pr-10" : isAvailable === false ? "border-red-500 pr-10" : "pr-10"}
                                minLength={3}
                                maxLength={20}
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
                        {isAvailable === false && username !== currentUsername && (
                            <p className="text-xs text-red-500">Username is already taken.</p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isSubmitting || !isAvailable}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
