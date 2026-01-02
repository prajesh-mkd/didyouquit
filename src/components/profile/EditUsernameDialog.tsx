"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

interface EditUsernameDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentUsername: string;
    onSuccess: (newUsername: string) => void;
}

export function EditUsernameDialog({
    open,
    onOpenChange,
    currentUsername,
    onSuccess
}: EditUsernameDialogProps) {
    const { user, refreshUserData } = useAuth();
    const [username, setUsername] = useState(currentUsername);
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setUsername(currentUsername);
            setIsAvailable(null);
        }
    }, [open, currentUsername]);

    useEffect(() => {
        const checkAvailability = async () => {
            if (username === currentUsername) {
                setIsAvailable(true);
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

    const handleSave = async () => {
        if (!user) return;
        if (!isAvailable) return;

        setIsSubmitting(true);
        try {
            await updateDoc(doc(db, "users", user.uid), {
                username: username
            });
            await refreshUserData();
            toast.success("Username updated!");
            onSuccess(username);
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to update username");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Change Username</DialogTitle>
                    <DialogDescription>
                        Choose a new unique username.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
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
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSubmitting || !isAvailable || username === currentUsername}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
