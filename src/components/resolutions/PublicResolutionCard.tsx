"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Globe } from "lucide-react";
import { TimelinePills } from "@/components/resolutions/TimelinePills";

interface PublicResolutionCardProps {
    res: {
        id: string;
        uid: string;
        title: string;
        weeklyLog?: { [key: string]: boolean };
        user?: {
            username: string;
            photoURL?: string;
            country?: string;
        };
    };
    currentYear: number;
}

export function PublicResolutionCard({ res, currentYear }: PublicResolutionCardProps) {
    return (
        <div className="p-5 space-y-4">
            {/* Header: User & Title */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <Link href={`/${res.user?.username || res.uid}`}>
                        <Avatar className="h-10 w-10 border border-slate-200">
                            <AvatarImage src={res.user?.photoURL} />
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-bold">
                                {res.user?.username?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </Link>
                    <div>
                        <Link href={`/${res.user?.username || res.uid}`} className="font-semibold text-slate-800 hover:text-emerald-700 transition-colors block">
                            {res.user?.username || "Anonymous"}
                        </Link>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <Globe className="h-3 w-3" />
                            {res.user?.country || "Unknown"}
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <div className="flex items-center gap-2 font-medium text-slate-900 text-lg">
                    {res.title}
                </div>
                {/* Mobile-Only Quote/Description place could go here */}
            </div>

            {/* Horizontal Scroll Timeline */}
            {/* Negative margin to allow full-width scroll on mobile while keeping padding elsewhere */}
            <div className="-mx-5 px-5">
                <TimelinePills resId={res.id} weeklyLog={res.weeklyLog} currentYear={currentYear} />
            </div>
        </div>
    );
}
