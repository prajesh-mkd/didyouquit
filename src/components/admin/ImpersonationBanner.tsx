"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context"; // Assuming we can check auth state
import { signInWithCustomToken, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase"; // Client auth
import { Button } from "@/components/ui/button";
import { LogOut, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { useSimulatedDate } from "@/lib/hooks/use-simulated-date";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { toast } from "sonner";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function ImpersonationBanner() {
    const { user, userData } = useAuth(); // We need userData to show "Acting as..."
    const [adminToken, setAdminToken] = useState<string | null>(null);
    const [isExiting, setIsExiting] = useState(false);

    // Time Travel Hooks
    const { date, isSimulated, enableSimulation, disableSimulation } = useSimulatedDate();
    const [calendarOpen, setCalendarOpen] = useState(false);

    useEffect(() => {
        // Check session storage for admin token
        const token = sessionStorage.getItem('didyouquit_admin_token');
        setAdminToken(token);
    }, []);

    if (!adminToken || !user) return null; // Only show if we have a stashed admin token (meaning we are impersonating)

    const handleExit = async () => {
        setIsExiting(true);
        try {
            const token = sessionStorage.getItem('didyouquit_admin_token');
            if (!token) throw new Error("No admin token found");

            await signOut(auth);
            await signInWithCustomToken(auth, token);

            // Clear Stash
            sessionStorage.removeItem('didyouquit_admin_token');

            // Clear Date Simulation
            disableSimulation();

            toast.success("Welcome back, Admin 👋");
            window.location.href = '/admin'; // Hard reload to clear any state
        } catch (error) {
            console.error("Failed to restore admin", error);
            toast.error("Failed to exit. Please manually log in.");
            sessionStorage.removeItem('didyouquit_admin_token');
            window.location.href = '/login';
        } finally {
            setIsExiting(false);
        }
    };

    const updateTime = (type: 'hour' | 'minute', value: string) => {
        const newDate = new Date(date);
        if (type === 'hour') {
            newDate.setHours(parseInt(value));
        } else {
            newDate.setMinutes(parseInt(value));
        }
        enableSimulation(newDate);
    };

    return (
        <div className="fixed bottom-6 left-6 z-[100] bg-slate-900 text-white p-2 pl-4 pr-2 shadow-2xl border border-slate-700 rounded-full flex items-center gap-6 animate-in slide-in-from-bottom duration-300 w-auto">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="font-mono text-sm uppercase tracking-wider text-slate-400">Acting as:</span>
                    <span className="font-bold text-white text-lg">{userData?.username || user.email}</span>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {/* Time Travel Control */}
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className={`border-slate-600 hover:bg-slate-800 text-slate-200 ${isSimulated ? 'bg-indigo-900/50 border-indigo-500 text-indigo-200' : 'bg-slate-800'}`}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {isSimulated ? format(date, "MMM d, yyyy h:mm a") : "Time Travel"}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={(d) => {
                                if (d) {
                                    // Preserve current time
                                    d.setHours(date.getHours());
                                    d.setMinutes(date.getMinutes());
                                    enableSimulation(d);
                                    // Don't close automatically so they can see time
                                    toast.success(`Date set to ${format(d, "MMM d, yyyy")}`);
                                }
                            }}
                            initialFocus
                        />
                        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
                            <Label className="mb-2 block text-xs font-semibold text-slate-500">Time of Day</Label>
                            <div className="flex gap-2">
                                <Select
                                    value={date.getHours().toString()}
                                    onValueChange={(v) => updateTime('hour', v)}
                                >
                                    <SelectTrigger className="h-8 w-[70px]">
                                        <SelectValue placeholder="Hour" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: 24 }).map((_, i) => (
                                            <SelectItem key={i} value={i.toString()}>
                                                {i.toString().padStart(2, '0')}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <span className="flex items-center text-slate-400">:</span>

                                <Select
                                    value={date.getMinutes().toString()}
                                    onValueChange={(v) => updateTime('minute', v)}
                                >
                                    <SelectTrigger className="h-8 w-[70px]">
                                        <SelectValue placeholder="Min" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: 60 }).map((_, i) => (
                                            <SelectItem key={i} value={i.toString()}>
                                                {i.toString().padStart(2, '0')}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="p-2 border-t border-slate-100">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs text-slate-500"
                                onClick={() => {
                                    disableSimulation();
                                    setCalendarOpen(false);
                                    toast.info("Returned to Present Day");
                                }}
                            >
                                Reset to Today
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>

                <div className="h-6 w-px bg-slate-700 mx-2" />

                <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleExit}
                    disabled={isExiting}
                    className="font-bold shadow-red-900/20"
                >
                    {isExiting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                    Exit & Return to Admin
                </Button>
            </div>
        </div>
    );
}
