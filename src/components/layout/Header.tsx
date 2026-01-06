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
import { LogOut, Target, Menu, Globe, MessageSquare, LayoutDashboard, User, Settings, CreditCard } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function Header() {
    const { user, userData } = useAuth();
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const normalizedEmail = user?.email?.toLowerCase().trim();
    const isSuperAdmin = normalizedEmail === 'contact@didyouquit.com';

    // DEBUG: Remove this after fixing
    console.log("[Header] Auth Check:", { email: user?.email, normalizedEmail, isSuperAdmin });

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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-8 w-8">
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
                    ) : (
                        <div className="flex items-center gap-2">
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
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">Explore</p>
                                        <Button variant="ghost" asChild className="w-full justify-start h-12 text-base font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50">
                                            <Link href="/public-resolutions" onClick={() => setIsMobileMenuOpen(false)}>
                                                <Globe className="mr-3 h-5 w-5" />
                                                Public Resolutions 2026
                                            </Link>
                                        </Button>
                                        <Button variant="ghost" asChild className="w-full justify-start h-12 text-base font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50">
                                            <Link href="/forums" onClick={() => setIsMobileMenuOpen(false)}>
                                                <MessageSquare className="mr-3 h-5 w-5" />
                                                Community Forums
                                            </Link>
                                        </Button>
                                    </div>

                                    {user && (
                                        <>
                                            <div className="h-px bg-slate-100 my-2" />

                                            <div className="space-y-1">
                                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">Dashboard</p>
                                                <Button variant="ghost" asChild className="w-full justify-start h-12 text-base font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50">
                                                    <Link href="/my-resolutions" onClick={() => setIsMobileMenuOpen(false)}>
                                                        <LayoutDashboard className="mr-3 h-5 w-5" />
                                                        My Resolutions
                                                    </Link>
                                                </Button>
                                                <Button variant="ghost" asChild className="w-full justify-start h-12 text-base font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50">
                                                    <Link href={`/${userData?.username || user.uid}`} onClick={() => setIsMobileMenuOpen(false)}>
                                                        <User className="mr-3 h-5 w-5" />
                                                        Public Profile
                                                    </Link>
                                                </Button>
                                            </div>

                                            <div className="h-px bg-slate-100 my-2" />

                                            <div className="space-y-1">
                                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 mb-2">Account</p>
                                                <Button variant="ghost" asChild className="w-full justify-start h-12 text-base font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50">
                                                    <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)}>
                                                        <Settings className="mr-3 h-5 w-5" />
                                                        Settings
                                                    </Link>
                                                </Button>
                                                <Button variant="ghost" asChild className="w-full justify-start h-12 text-base font-medium text-slate-600 hover:text-emerald-600 hover:bg-emerald-50">
                                                    <Link href="/subscription" onClick={() => setIsMobileMenuOpen(false)}>
                                                        <CreditCard className="mr-3 h-5 w-5" />
                                                        Subscription
                                                    </Link>
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {user ? (
                                    <div className="mt-auto pt-6 border-t border-slate-100">
                                        <div className="flex items-center gap-3 mb-4 px-2">
                                            <Avatar className="h-10 w-10 border border-slate-100">
                                                <AvatarImage src={userData?.photoURL ?? undefined} alt={userData?.username || "User"} />
                                                <AvatarFallback>{userData?.username?.slice(0, 2).toUpperCase() || "U"}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-900">{userData?.username || "User"}</span>
                                                <span className="text-xs text-slate-500 truncate max-w-[180px]">{user.email}</span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            onClick={handleSignOut}
                                            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <LogOut className="mr-3 h-5 w-5" />
                                            Log out
                                        </Button>
                                    </div>
                                ) : (
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
        </header>
    );
}
