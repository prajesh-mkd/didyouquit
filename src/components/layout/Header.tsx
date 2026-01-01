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
import { CheckCircle, LogOut, User } from "lucide-react";
// ... (imports remain the same)

// Inside component
<Link href="/" className="flex items-center gap-2 font-bold text-xl">
    <CheckCircle className="h-6 w-6 text-emerald-600" />
    <span>DidYouQuit<span className="text-emerald-600">?</span></span>
</Link>

// ...

                ) : (
    <div className="flex items-center gap-2">
        <Button variant="ghost" asChild>
            <Link href="/">Log In</Link>
        </Button>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
            <Link href="/">Get Started</Link>
        </Button>
    </div>
)}
            </div >
        </header >
    );
}
