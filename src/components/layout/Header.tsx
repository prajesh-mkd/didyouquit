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
import { LogOut, Target } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export function Header() {
    const { user, userData } = useAuth();
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut(auth);
        router.push("/");
    };

    return (
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
            <div className="container flex h-14 items-center justify-between px-4">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl">
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
                                Community Forum
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
                                        <AvatarImage src={userData?.photoURL} alt={userData?.username || "User"} />
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
                                {user.email !== 'contact@didyouquit.com' && (
                                    <DropdownMenuItem asChild>
                                        <Link href="/settings">Edit Profile</Link>
                                    </DropdownMenuItem>
                                )}
                                {user.email === 'contact@didyouquit.com' && (
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
                </div>
            </div>
        </header>
    );
}
