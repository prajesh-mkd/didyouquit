"use client";

import { useState, useEffect } from "react";
import { User, sendEmailVerification, deleteUser } from "firebase/auth";
import { AlertCircle, Mail, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { getFriendlyErrorMessage } from "@/lib/error-utils";

interface Props {
    user: User;
}

export function EmailVerificationBanner({ user }: Props) {
    const router = useRouter();
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Calculate days since creation
    const creationTime = user.metadata.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now();
    const daysSinceCreation = (Date.now() - creationTime) / (1000 * 60 * 60 * 24);

    const isUrgent = daysSinceCreation > 7;
    const shouldDelete = daysSinceCreation > 14;

    // Auto-delete logic for > 14 days
    useEffect(() => {
        const performAutoDelete = async () => {
            if (shouldDelete && !user.emailVerified && !isDeleting) {
                setIsDeleting(true);
                try {
                    // 1. Delete user doc
                    await deleteDoc(doc(db, "users", user.uid));
                    // 2. Delete auth user
                    await deleteUser(user);

                    toast.error("Account deleted due to unverified email > 14 days.");
                    router.push("/");
                } catch (error) {
                    console.error("Auto-delete failed:", error);
                    // Minimal error handling here to avoid loops, just log it
                }
            }
        };

        if (shouldDelete) {
            performAutoDelete();
        }
    }, [shouldDelete, user, router, isDeleting]);


    if (user.emailVerified) return null;
    if (shouldDelete) return null; // Handling deletion in effect

    const handleResend = async () => {
        setSending(true);
        try {
            await sendEmailVerification(user);
            setSent(true);
            toast.success("Verification email sent!");
        } catch (error: any) {
            const msg = getFriendlyErrorMessage(error);
            if (msg) toast.error(msg);
        } finally {
            setSending(false);
        }
    };

    if (isUrgent) {
        return (
            <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50 text-red-900">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-bold flex items-center gap-2">
                    Action Required: Verify Email
                </AlertTitle>
                <AlertDescription className="mt-2 text-sm leading-relaxed">
                    <p className="mb-3">
                        Your account will be <strong>permanently deleted</strong> in {Math.max(0, Math.ceil(14 - daysSinceCreation))} days if you do not verify your email address.
                    </p>
                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResend}
                            disabled={sending || sent}
                            className="bg-white border-red-200 text-red-700 hover:bg-red-100 h-8"
                        >
                            {sent ? "Email Sent" : (sending ? "Sending..." : "Resend Verification Email")}
                        </Button>
                        <span className="text-xs text-red-700/70">
                            Sent to {user.email}
                        </span>
                    </div>
                </AlertDescription>
            </Alert>
        );
    }

    // Standard Banner
    return (
        <Alert className="mb-6 border-emerald-200 bg-emerald-50 text-emerald-900">
            <Mail className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="font-bold text-emerald-800">Please verify your email</AlertTitle>
            <AlertDescription className="mt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-emerald-700">
                    We sent a verification link to <strong>{user.email}</strong>. Check your inbox. If it’s not there, check spam.
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResend}
                    disabled={sending || sent}
                    className="bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-100 h-8 whitespace-nowrap w-fit"
                >
                    {sent ? "Email Sent" : (sending ? "Sending..." : "Resend Link")}
                </Button>
            </AlertDescription>
        </Alert>
    );
}
