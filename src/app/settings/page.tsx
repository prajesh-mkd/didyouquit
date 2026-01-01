"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import { deleteUser } from "firebase/auth";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
    const { user, userData } = useAuth();
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);

    import { getFriendlyErrorMessage } from "@/lib/error-utils";

    const handleDeleteAccount = async () => {
        if (!user) return;
        const confirmText = prompt("Type 'DELETE' to confirm account deletion. This cannot be undone.");
        if (confirmText !== "DELETE") return;

        setIsDeleting(true);
        try {
            // 1. Delete user doc
            await deleteDoc(doc(db, "users", user.uid));
            // 2. Delete auth user
            await deleteUser(user);
            // 3. Redirect
            toast.success("Account deleted.");
            router.push("/");
        } catch (error: any) {
            const msg = getFriendlyErrorMessage(error);
            if (msg) toast.error(msg);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Header />
            <main className="container max-w-2xl py-8 px-4">
                <h1 className="text-3xl font-bold mb-8">Settings</h1>

                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Profile Information</CardTitle>
                        <CardDescription>Your public profile details.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Username</Label>
                            <Input value={userData?.username || ""} disabled />
                            <p className="text-xs text-muted-foreground">Username cannot be changed currently.</p>
                        </div>
                        <div className="grid gap-2">
                            <Label>Country</Label>
                            <Input value={userData?.country || ""} disabled />
                        </div>
                        {/* Editing username/country left as future improvement for MVP speed */}
                    </CardContent>
                </Card>

                <Card className="border-destructive/50">
                    <CardHeader>
                        <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm mb-4">
                            Deleting your account will remove all your resolutions and data permanently.
                        </p>
                        <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Delete Account"}
                        </Button>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
