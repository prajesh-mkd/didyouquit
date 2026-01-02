"use client";

import { useRef, useLayoutEffect } from "react";
import { Check, X, Minus } from "lucide-react";
import { startOfWeek, endOfWeek, format, setWeek, getISOWeek } from "date-fns";

interface TimelinePillsProps {
    resId: string;
    weeklyLog?: { [key: string]: boolean };
    currentYear: number;
}

export function TimelinePills({ resId, weeklyLog, currentYear }: TimelinePillsProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const currentWeekNum = getISOWeek(new Date());

    useLayoutEffect(() => {
        if (scrollContainerRef.current) {
            const currentWeekId = `pill-${resId}-${currentWeekNum}`;
            const element = document.getElementById(currentWeekId);

            if (element) {
                const container = scrollContainerRef.current;
                const offset = element.offsetLeft - (container.clientWidth / 2) + (element.clientWidth / 2);
                container.scrollTo({ left: offset, behavior: "smooth" });
            } else {
                if (currentWeekNum > 26) {
                    scrollContainerRef.current.scrollLeft = 9999;
                }
            }
        }
    }, [currentWeekNum, resId]);

    const getWeekRange = (weekNum: number) => {
        const targetDate = setWeek(new Date(currentYear, 0, 4), weekNum, { weekStartsOn: 1 });
        const start = startOfWeek(targetDate, { weekStartsOn: 1 });
        const end = endOfWeek(targetDate, { weekStartsOn: 1 });
        return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
    };

    const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

    return (
        <div className="relative w-full overflow-hidden group/timeline">
            {/* Fade Gradients (Desktop specific, maybe less needed if we want clean table) */}
            {/* We keep them strictly for visual polish if container is small */}
            <div
                ref={scrollContainerRef}
                className="flex overflow-x-auto pb-2 pt-1 gap-2 no-scrollbar snap-x snap-mandatory scroll-px-4 px-1"
            >
                {weeks.map((week) => {
                    const weekKey = `${currentYear}-W${week.toString().padStart(2, '0')}`;
                    const status = weeklyLog?.[weekKey];
                    const isCurrentWeek = week === currentWeekNum;

                    let bgClass = "bg-slate-50 border-slate-200 text-slate-400";
                    let icon = <Minus className="h-3 w-3" />;

                    if (status === true) {
                        bgClass = "bg-emerald-100 border-emerald-200 text-emerald-700";
                        icon = <Check className="h-3 w-3" />;
                    } else if (status === false) {
                        bgClass = "bg-red-50 border-red-200 text-red-600";
                        icon = <X className="h-3 w-3" />;
                    } else if (isCurrentWeek) {
                        bgClass = "bg-blue-50 border-blue-200 text-blue-600 ring-1 ring-blue-200";
                    }

                    return (
                        <div
                            key={week}
                            id={`pill-${resId}-${week}`}
                            className={`
                                flex flex-col items-center justify-center 
                                min-w-[100px] h-[52px] 
                                rounded-lg border ${bgClass} 
                                text-xs snap-start flex-shrink-0
                            `}
                        >
                            <div className="font-bold text-[10px] uppercase tracking-wider mb-0.5 opacity-80">
                                Week {week}
                            </div>
                            <div className="font-medium whitespace-nowrap px-2">
                                {getWeekRange(week)}
                            </div>
                            {isCurrentWeek && (
                                <div className="absolute -top-1 right-1 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                            )}
                        </div>
                    );
                })}
            </div>
            {/* Fade Gradients */}
            <div className="absolute left-0 top-0 bottom-2 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
        </div>
    );
}
