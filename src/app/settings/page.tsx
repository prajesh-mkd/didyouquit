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
import { deleteUserCascade } from "@/lib/resolutions";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { Loader2 } from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/error-utils";
import { EditAvatarDialog } from "@/components/profile/EditAvatarDialog";
import { EditUsernameDialog } from "@/components/profile/EditUsernameDialog";
import { EditCountryDialog } from "@/components/profile/EditCountryDialog";

export default function SettingsPage() {
    const { user, userData } = useAuth();
    const router = useRouter();

    if (user?.email === 'contact@didyouquit.com') {
        router.push("/admin");
    }
    const [isDeleting, setIsDeleting] = useState(false);
    const [isAvatarOpen, setIsAvatarOpen] = useState(false);
    const [isUsernameOpen, setIsUsernameEditOpen] = useState(false);
    const [isCountryOpen, setIsCountryOpen] = useState(false);

    const handleDeleteAccount = async () => {
        if (!user) return;

        // Safeguard: Prevent deletion if active subscription exists and is NOT scheduled to cancel
        const isSubActive = userData?.subscriptionStatus === 'active' || userData?.subscriptionStatus === 'trialing';
        const isCanceled = userData?.cancelAtPeriodEnd === true;

        if (isSubActive && !isCanceled) {
            toast.error("Cannot delete account with an active subscription.", {
                description: "Please cancel your subscription first to avoid future billing."
            });
            return;
        }
        const confirmText = prompt("Type 'DELETE' to confirm account deletion. This cannot be undone.");
        if (confirmText !== "DELETE") return;

        setIsDeleting(true);
        try {
            // Call Backend API to handle privileged deletion (Resolutions, Topics, Notifications, User Data)
            const token = await user.getIdToken();
            const res = await fetch('/api/account/delete', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Deletion failed");
            }

            // Client-side cleanup
            await auth.signOut();

            toast.success("Account deleted successfully.");
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
                        <div className="grid gap-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label>Profile Picture</Label>
                                    <p className="text-sm text-muted-foreground">This is your public avatar.</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <Button variant="outline" size="sm" onClick={() => setIsAvatarOpen(true)}>Change Avatar</Button>
                                    <EditAvatarDialog
                                        open={isAvatarOpen}
                                        onOpenChange={setIsAvatarOpen}
                                        currentUsername={userData?.username || ""}
                                        currentPhotoURL={userData?.photoURL || ""}
                                        onSuccess={() => window.location.reload()}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label>Username</Label>
                                <div className="flex gap-2">
                                    <Input value={userData?.username || ""} disabled className="bg-slate-50" />
                                    <Button variant="outline" onClick={() => setIsUsernameEditOpen(true)}>Edit</Button>
                                </div>
                                <EditUsernameDialog
                                    open={isUsernameOpen}
                                    onOpenChange={setIsUsernameEditOpen}
                                    currentUsername={userData?.username || ""}
                                    onSuccess={(newUsername) => router.push(`/${newUsername}`)}
                                />
                                <p className="text-xs text-muted-foreground">This is your unique handle on the platform.</p>
                            </div>

                            <div className="grid gap-2">
                                <Label>Country</Label>
                                <div className="flex gap-2">
                                    <Input value={userData?.country || ""} disabled className="bg-slate-50" />
                                    <Button variant="outline" onClick={() => setIsCountryOpen(true)}>Edit</Button>
                                </div>
                                <EditCountryDialog
                                    open={isCountryOpen}
                                    onOpenChange={setIsCountryOpen}
                                    currentCountry={userData?.country || ""}
                                    onSuccess={() => window.location.reload()}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-gray-100 shadow-none bg-transparent">
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h3 className="font-medium text-sm text-muted-foreground">Account Management</h3>
                                <p className="text-xs text-muted-foreground/70">
                                    Permanently remove your account and all data.
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="text-slate-500 border border-slate-200 hover:text-slate-700 hover:bg-slate-50 h-auto px-4 py-2 self-start sm:self-center"
                            >
                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Delete Account"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
