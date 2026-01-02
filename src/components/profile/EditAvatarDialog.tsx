"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { generateAvatar } from "@/lib/generateAvatar";

interface EditAvatarDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentUsername: string;
    currentPhotoURL: string;
    onSuccess: () => void;
}

export function EditAvatarDialog({
    open,
    onOpenChange,
    currentUsername,
    currentPhotoURL,
    onSuccess
}: EditAvatarDialogProps) {
    const { user, refreshUserData } = useAuth();
    const [photoURL, setPhotoURL] = useState(currentPhotoURL);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setPhotoURL(currentPhotoURL);
        }
    }, [open, currentPhotoURL]);

    const handleShuffleAvatar = () => {
        const randomSeed = Math.random().toString(36).substring(7);
        setPhotoURL(generateAvatar(randomSeed));
    };

    const handleSave = async () => {
        if (!user) return;
        setIsSubmitting(true);
        try {
            await updateDoc(doc(db, "users", user.uid), {
                photoURL: photoURL
            });
            await refreshUserData();
            toast.success("Avatar updated!");
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error("Failed to update avatar");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Update Avatar</DialogTitle>
                    <DialogDescription>
                        Generate a new random avatar.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center gap-6 py-6">
                    <Avatar className="h-32 w-32 border-4 border-slate-100">
                        <AvatarImage src={photoURL} />
                        <AvatarFallback>{currentUsername[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleShuffleAvatar}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Generate New Avatar
                    </Button>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Avatar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
