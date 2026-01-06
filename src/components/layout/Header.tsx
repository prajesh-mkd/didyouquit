"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LogOut, Target, Menu, Globe, MessageSquare, LayoutDashboard, User, Settings, CreditCard, Bell } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { collection, query, where, onSnapshot, getDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { PaywallModal } from "@/components/subscription/PaywallModal";
import { AppConfig } from "@/lib/types";

export function Header() {
    const { user, userData } = useAuth();
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isPricingOpen, setIsPricingOpen] = useState(false);
    const [config, setConfig] = useState<AppConfig | null>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const snap = await getDoc(doc(db, "app_config", "subscription_settings"));
                if (snap.exists()) {
                    setConfig(snap.data() as AppConfig);
                }
            } catch (error) {
                console.error("Failed to load subs settings", error);
            }
        };
        fetchConfig();
    }, []);

    const mode = config?.mode || 'test';
    const strategy = config?.strategy || 'sale';
    const pricing = {
        features: ['Unlimited Resolutions', 'Advanced Analytics', 'Community Badges'],
        displayMonthly: '$1.99',
        displayYearly: '$19.99',
        marketingHeader: 'Start Your Journey',
        marketingSubtext: 'Invest in yourself today.',
        ...(config?.[mode]?.[strategy] || {})
    };

    const normalizedEmail = user?.email?.toLowerCase().trim();
    const isSuperAdmin = normalizedEmail === 'contact@didyouquit.com';

    // DEBUG: Remove this after fixing
    console.log("[Header] Auth Check:", { email: user?.email, normalizedEmail, isSuperAdmin });

    // Fetch unread notifications count
    useEffect(() => {
        if (!user) {
            setUnreadCount(0);
            return;
        }

        const q = query(
            collection(db, "notifications"),
            where("recipientUid", "==", user.uid),
            where("read", "==", false)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUnreadCount(snapshot.size);
        });

        return () => unsubscribe();
    }, [user]);

    const handleSignOut = async () => {
        await signOut(auth);
        router.push("/");
    };

    return (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="container flex h-14 items-center justify-between px-4">
                <Link href="/?home=true" className="flex items-center gap-2 font-bold text-xl">
                    <Target className="h-6 w-6 text-emerald-600" />
                    <span>DidYouQuit<span className="text-emerald-600">?</span></span>
                </Link>

                <div className="flex items-center gap-4">
                    {/* Public Links - Always Visible */}
                    <div className="hidden md:flex items-center gap-2 mr-2">
                        <Button variant="ghost" asChild className="text-slate-600 hover:text-emerald-600 hover:bg-emerald-50">
                            <Link href="/public-resolutions">
                                Public Resolutions 2026
                            </Link>
                        </Button>
                        <Button variant="ghost" asChild className="text-slate-600 hover:text-emerald-600 hover:bg-emerald-50">
                            <Link href="/forums">
                                Community Forums
                            </Link>
                        </Button>
                        {user && (
                            <Button variant="ghost" asChild className="text-slate-600 hover:text-emerald-600 hover:bg-emerald-50">
                                <Link href="/my-resolutions">
                                    My Resolutions
                                </Link>
                            </Button>
                        )}
                    </div>

                    {user ? (
                        <div className="flex items-center gap-2">
                            {/* Notification Icon */}
                            <Button variant="ghost" size="icon" asChild className="relative text-slate-500 hover:text-emerald-600 hover:bg-emerald-50">
                                <Link href="/forums?tab=notifications">
                                    <Bell className="h-5 w-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 ring-2 ring-white">
                                            {/* Optional: Add number inside if needed, but just dot is often cleaner for small icons. 
                                               User requested "display that number near or overlapping". Let's try badge style. */}
                                        </span>
                                    )}
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                                            {unreadCount > 99 ? "99+" : unreadCount}
                                        </span>
                                    )}
                                </Link>
                            </Button>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={userData?.photoURL ?? undefined} alt={userData?.username || "User"} />
                                            <AvatarFallback>{userData?.username?.slice(0, 2).toUpperCase() || "U"}</AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56" align="end" forceMount>
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none">{userData?.username || "User"}</p>
                                            <p className="text-xs leading-none text-muted-foreground">
                                                {user.email}
                                            </p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem asChild>
                                        <Link href="/my-resolutions">My Resolutions</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href="/following">Following</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href={`/${userData?.username || user.uid}`}>Public Profile</Link>
                                    </DropdownMenuItem>
                                    {!isSuperAdmin && (
                                        <DropdownMenuItem asChild>
                                            <Link href="/settings">Edit Profile</Link>
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem asChild>
                                        <Link href="/subscription">Subscription</Link>
                                    </DropdownMenuItem>
                                    {isSuperAdmin && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem asChild className="bg-red-50 hover:bg-red-100 text-red-900 font-semibold cursor-pointer">
                                                <Link href="/admin">Super Admin</Link>
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleSignOut}>
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Log out</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" className="hidden md:inline-flex text-slate-600 hover:text-emerald-600" onClick={() => setIsPricingOpen(true)}>
                                Pricing
                            </Button>
                            <Button variant="ghost" asChild>
                                <Link href="/?auth=login">Log In</Link>
                            </Button>
                            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
                                <Link href="/?auth=signup">Get Started</Link>
                            </Button>
                        </div>
                    )}
                    {/* Mobile Menu Trigger */}
                    <div className="md:hidden">
                        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="-mr-2">
                                    <Menu className="h-6 w-6" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[300px] sm:w-[400px] flex flex-col p-6">
                                <SheetHeader className="text-left mb-6">
                                    <SheetTitle className="flex items-center gap-2 text-xl font-bold">
                                        <Target className="h-6 w-6 text-emerald-600" />
                                        <span>DidYouQuit<span className="text-emerald-600">?</span></span>
                                    </SheetTitle>
                                </SheetHeader>

                                <div className="flex flex-col gap-2 flex-1">
                                    <Button variant="ghost" asChild className="justify-start h-12 text-base font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 mb-1">
                                        <Link href="/public-resolutions" onClick={() => setIsMobileMenuOpen(false)}>
                                            <Globe className="mr-3 h-5 w-5" />
                                            Public Resolutions 2026
                                        </Link>
                                    </Button>
                                    <Button variant="ghost" asChild className="justify-start h-12 text-base font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 mb-1">
                                        <Link href="/forums" onClick={() => setIsMobileMenuOpen(false)}>
                                            <MessageSquare className="mr-3 h-5 w-5" />
                                            Community Forums
                                        </Link>
                                    </Button>

                                    {!user && (
                                        <Button
                                            variant="ghost"
                                            className="justify-start h-12 text-base font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 mb-1 w-full"
                                            onClick={() => {
                                                setIsMobileMenuOpen(false);
                                                setIsPricingOpen(true);
                                            }}
                                        >
                                            <CreditCard className="mr-3 h-5 w-5" />
                                            Pricing
                                        </Button>
                                    )}

                                    {user && (
                                        <Button variant="ghost" asChild className="justify-start h-12 text-base font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 mb-1">
                                            <Link href="/my-resolutions" onClick={() => setIsMobileMenuOpen(false)}>
                                                <LayoutDashboard className="mr-3 h-5 w-5" />
                                                My Resolutions
                                            </Link>
                                        </Button>
                                    )}
                                </div>

                                {!user && (
                                    <div className="mt-auto pt-6 border-t border-slate-100 flex flex-col gap-3">
                                        <Button variant="outline" asChild className="w-full justify-center h-11 border-slate-200 text-slate-700 font-medium">
                                            <Link href="/?auth=login" onClick={() => setIsMobileMenuOpen(false)}>Log In</Link>
                                        </Button>
                                        <Button className="w-full justify-center h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-emerald-200/50 shadow-lg" asChild>
                                            <Link href="/?auth=signup" onClick={() => setIsMobileMenuOpen(false)}>Get Started</Link>
                                        </Button>
                                    </div>
                                )}
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>




            <PaywallModal
                open={isPricingOpen}
                onOpenChange={setIsPricingOpen}
                pricing={pricing}
                user={null}
                isGuest={true}
            />
        </header >
    );
}
