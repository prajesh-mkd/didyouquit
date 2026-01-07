"use client";

import { useState, useEffect } from "react";
import { User, sendEmailVerification } from "firebase/auth";
import { AlertCircle, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/error-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Props {
    user: User;
}

export function EmailVerificationBanner({ user }: Props) {
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [verifying, setVerifying] = useState(false);

    // Calculate days since creation
    const creationTime = user.metadata.creationTime ? new Date(user.metadata.creationTime).getTime() : Date.now();
    const daysSinceCreation = (Date.now() - creationTime) / (1000 * 60 * 60 * 24);

    const isUrgent = daysSinceCreation > 7;
    const isBlocking = daysSinceCreation > 14;

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

    const handleCheckVerification = async () => {
        setVerifying(true);
        try {
            await user.reload();
            if (user.emailVerified) {
                toast.success("Email verified! Unlocking...");
                // React will re-render and hide the banner/modal automatically
            } else {
                toast.error("Still not verified. Check your inbox.");
            }
        } catch (error) {
            toast.error("Failed to check status.");
        } finally {
            setVerifying(false);
        }
    };

    if (user.emailVerified) return null;

    // BLOCKING MODAL (> 14 Days)
    if (isBlocking) {
        return (
            <Dialog open={true}>
                <DialogContent className="sm:max-w-md" showCloseButton={false}>
                    <DialogHeader>
                        <div className="mx-auto bg-red-100 p-3 rounded-full mb-4 w-fit">
                            <AlertCircle className="h-8 w-8 text-red-600" />
                        </div>
                        <DialogTitle className="text-2xl font-bold text-center text-red-950">
                            Verification Required
                        </DialogTitle>
                        <DialogDescription className="text-center text-base pt-2">
                            You have been using the app for over 14 days without verifying your email. <br />
                            <strong>Please verify to continue.</strong>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-4 py-4">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center text-sm text-slate-600">
                            sent to: <strong>{user.email}</strong>
                        </div>

                        <Button
                            onClick={handleCheckVerification}
                            disabled={verifying}
                            className="bg-red-600 hover:bg-red-700 text-white w-full h-12 text-lg font-semibold"
                        >
                            {verifying ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                            I Have Verified It
                        </Button>

                        <Button
                            variant="ghost"
                            onClick={handleResend}
                            disabled={sending || sent}
                            className="text-slate-500 hover:text-slate-700"
                        >
                            {sent ? "Email Sent ✅" : (sending ? "Sending..." : "Resend Verification Email")}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // URGENT BANNER (> 7 Days)
    if (isUrgent) {
        return (
            <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50 text-red-900">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-bold flex items-center gap-2">
                    Action Required: Verify Email
                </AlertTitle>
                <AlertDescription className="mt-2 text-sm leading-relaxed">
                    <p className="mb-3">
                        Please verify your email to avoid account restrictions in {Math.max(0, Math.ceil(14 - daysSinceCreation))} days.
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

    // STANDARD BANNER (0-7 Days)
    return (
        <Alert className="mb-6 border-emerald-200 bg-emerald-50 text-emerald-900">
            <Mail className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="font-bold text-emerald-800">Please verify your email</AlertTitle>
            <AlertDescription className="mt-2 flex flex-col sm:flex-row sm:items-center gap-3">
                <span className="text-emerald-700">
                    We sent a verification link to <strong>{user.email}</strong>. Check your inbox.
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
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCheckVerification}
                    disabled={verifying}
                    className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/50 h-8 text-xs"
                >
                    {verifying ? "Checking..." : "I Verified It"}
                </Button>
            </AlertDescription>
        </Alert>
    );
}
