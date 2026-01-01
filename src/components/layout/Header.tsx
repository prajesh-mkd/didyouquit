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
import { LogOut, Target, User } from "lucide-react";
// ... (imports remain the same)

// Inside component
<Link href="/" className="flex items-center gap-2 font-bold text-xl">
    <Target className="h-6 w-6 text-emerald-600" />
    <span>DidYouQuit<span className="text-emerald-600">?</span></span>
</Link>

{
    user ? (
        <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4 mr-4">
                <Link href="/public-resolutions" className="text-sm font-medium hover:text-primary transition-colors">
                    Public Resolutions 2026
                </Link>
                {user && (
                    <Link href="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
                        My Resolutions
                    </Link>
                )}
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
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
                        <Link href="/dashboard">My Resolutions</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href={`/${userData?.username || user.uid}`}>Public Profile</Link>
                    </DropdownMenuItem>
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
            <Button variant="ghost" asChild>
                <Link href="/">Log In</Link>
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
                <Link href="/">Get Started</Link>
            </Button>
        </div>
    )
}
            </div >
        </header >
    );
}
