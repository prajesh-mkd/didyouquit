"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/error-utils";

interface ForgotPasswordDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultEmail?: string;
}

export function ForgotPasswordDialog({ open, onOpenChange, defaultEmail = "" }: ForgotPasswordDialogProps) {
    const [email, setEmail] = useState(defaultEmail);
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email);
            setSent(true);
            toast.success("Password reset email sent!");
        } catch (error: any) {
            const msg = getFriendlyErrorMessage(error);
            if (msg) toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        // Reset state after a delay purely for UX so they don't see it flicker
        setTimeout(() => {
            setSent(false);
            if (!defaultEmail) setEmail("");
        }, 300);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md p-8 bg-white shadow-2xl border-slate-100">
                <DialogHeader className="space-y-4 mb-4 text-center">
                    <DialogTitle className="text-3xl font-bold tracking-tight text-slate-900">Reset Password</DialogTitle>
                    <DialogDescription className="text-base text-slate-600">
                        {sent
                            ? "Check your email for a link to reset your password."
                            : "Enter your email address and we'll send you a link to reset your password."}
                    </DialogDescription>
                </DialogHeader>

                {sent ? (
                    <div className="flex flex-col gap-4">
                        <Button
                            onClick={handleClose}
                            className="w-full h-12 text-base bg-emerald-500 hover:bg-emerald-600 text-white"
                        >
                            Close
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="reset-email" className="text-slate-600">Email</Label>
                            <Input
                                id="reset-email"
                                type="email"
                                placeholder="name@example.com"
                                className="h-12 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full h-12 text-base bg-emerald-500 hover:bg-emerald-600 text-white"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : "Send Reset Link"}
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
