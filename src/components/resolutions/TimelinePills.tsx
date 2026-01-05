import { useRef, useLayoutEffect, useState, useEffect } from "react";
import { useSimulatedDate } from "@/lib/hooks/use-simulated-date";
import { Check, X, Minus, CheckCircle2, XCircle } from "lucide-react";
import { startOfWeek, endOfWeek, format, setWeek, getISOWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CheckInDialog } from "./CheckInDialog";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import Link from "next/link";

interface TimelinePillsProps {
    resId: string;
    weeklyLog?: { [key: string]: boolean };
    weeklyNotes?: { [key: string]: string };
    currentYear: number;
    onStatusChange?: (weekKey: string, status: boolean, note?: string) => void;
}

export function TimelinePills({ resId, weeklyLog, weeklyNotes, currentYear, onStatusChange }: TimelinePillsProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const simulation = useSimulatedDate();
    const currentWeekNum = getISOWeek(simulation.date);

    // Dialog State
    const [activeWeek, setActiveWeek] = useState<string | null>(null);
    const [note, setNote] = useState("");

    // When opening a week, load existing note
    useEffect(() => {
        if (activeWeek && weeklyNotes && weeklyNotes[activeWeek]) {
            setNote(weeklyNotes[activeWeek]);
        } else if (activeWeek) {
            setNote("");
        }
    }, [activeWeek, weeklyNotes]);


    // State for Journal IDs map (Public View)
    const [journalMap, setJournalMap] = useState<{ [weekKey: string]: string }>({});

    // Fetch Journal Entries for Public View (when no onStatusChange provided)
    useEffect(() => {
        if (onStatusChange) return; // Don't fetch if we are in "My Resolutions" (Edit Mode)
        if (!resId) return;

        const q = query(
            collection(db, "journal_entries"),
            where("resolutionId", "==", resId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const map: { [key: string]: string } = {};
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.weekKey) {
                    map[data.weekKey] = doc.id;
                }
            });
            setJournalMap(map);
        });

        return () => unsubscribe();
    }, [resId, onStatusChange]);

    useLayoutEffect(() => {
        if (scrollContainerRef.current) {
            // Target the PREVIOUS week (so user sees context), unless it's week 1
            const targetWeekNum = currentWeekNum > 1 ? currentWeekNum - 1 : 1;

            // Use setTimeout to ensure layout is final before scrolling
            // Increased to 300ms to be safe against rendering delays
            const timer = setTimeout(() => {
                // Scope selector to THIS container to avoid issues with duplicate IDs (e.g. mobile/desktop views)
                // We use data-week-num attribute for reliable scoping
                const element = scrollContainerRef.current?.querySelector(`[data-week-num="${targetWeekNum}"]`);

                if (element) {
                    // scrollIntoView is more robust than manual offset calculation
                    // inline: 'start' aligns it to the left
                    element.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'start' });
                }
            }, 300);

            return () => clearTimeout(timer);
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
            <div
                ref={scrollContainerRef}
                className="relative flex overflow-x-auto pb-2 pt-1 gap-2 no-scrollbar snap-x snap-mandatory scroll-px-4 px-1"
            >
                {weeks.map((week) => {
                    const weekKey = `${currentYear}-W${week.toString().padStart(2, '0')}`;
                    const status = weeklyLog?.[weekKey];
                    const isCurrentWeek = week === currentWeekNum;
                    // Lock current week AND future weeks
                    const isLocked = week >= currentWeekNum;

                    // Journal Link Logic
                    const journalId = journalMap[weekKey];
                    // Can only click if: Not current week, Not future, and Journal Entry exists (Success or Failure entry)
                    // Note: User said "can not click on past weeks which have not been checked-in (meaning they are grey)".
                    // If journalId exists, it means they checked in.
                    const canViewJournal = !isCurrentWeek && !isLocked && !!journalId;

                    let bgClass = "bg-slate-50 border-slate-300 text-slate-500";
                    let icon = <Minus className="h-3 w-3" />;

                    if (status === true) {
                        bgClass = "bg-emerald-500 border-emerald-600 text-slate-900 shadow-sm";
                        icon = <Check className="h-3 w-3 text-slate-900" />;
                    } else if (status === false) {
                        bgClass = "bg-red-500 border-red-600 text-slate-900 shadow-sm";
                        icon = <X className="h-3 w-3 text-slate-900" />;
                    } else if (isCurrentWeek) {
                        // Current Week: Active Green Border + Background Pulse (Text stays distinct)
                        bgClass = "bg-white border-slate-300 text-slate-900";
                    }

                    // Calculate progress for current week
                    let progressPercent = 0;
                    if (isCurrentWeek) {
                        const targetDate = setWeek(new Date(currentYear, 0, 4), week, { weekStartsOn: 1 });
                        const start = startOfWeek(targetDate, { weekStartsOn: 1 });
                        const end = endOfWeek(targetDate, { weekStartsOn: 1 });
                        const now = simulation.date;
                        const total = end.getTime() - start.getTime();
                        const current = now.getTime() - start.getTime();
                        progressPercent = Math.min(100, Math.max(0, (current / total) * 100));
                    }

                    const PillContent = (
                        <div
                            key={week}
                            id={`pill-${resId}-${week}`}
                            data-week-num={week}
                            className={`
                                    flex flex-col items-center justify-center 
                                    min-w-[100px] h-[52px] 
                                    rounded-lg border ${bgClass} 
                                    text-xs snap-start flex-shrink-0 relative overflow-hidden transform-gpu [backface-visibility:hidden]
                                    ${onStatusChange && !isLocked ? 'cursor-pointer hover:opacity-90 active:scale-95 transition-all' : ''}
                                    ${canViewJournal ? 'cursor-pointer hover:opacity-90 hover:ring-2 hover:ring-emerald-400/50 transition-all' : ''}
                                    ${isLocked && !isCurrentWeek ? 'cursor-default' : ''}
                                `}
                        >
                            {isCurrentWeek && !status && (
                                <div
                                    className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-slate-50 to-orange-400 pointer-events-none transition-all duration-1000 ease-out"
                                    style={{ width: `${Math.min(progressPercent, 95)}%` }}
                                    role="progressbar"
                                    aria-valuenow={progressPercent}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                >
                                    {/* Flat Edge Pulse */}
                                    <div
                                        className="absolute top-0 bottom-0 right-[-3px] w-[6px] h-full animate-pulse-right bg-orange-400 shadow-[2px_0_5px_rgba(251,146,60,0.3)] will-change-transform"
                                    />
                                </div>
                            )}
                            <div className="font-bold text-[10px] uppercase tracking-wider mb-0.5 z-10 relative">
                                {isCurrentWeek ? "Current Week" : `Week ${week}`}
                            </div>
                            <div className="font-medium whitespace-nowrap px-2 z-10 relative">
                                {getWeekRange(week)}
                            </div>
                        </div>
                    );

                    // If user can change status and it's NOT locked (past weeks)
                    // This is My Resolutions View
                    if (onStatusChange && !isLocked) {
                        return (
                            <button key={week} onClick={() => setActiveWeek(weekKey)} className="focus:outline-none">
                                {PillContent}
                            </button>
                        );
                    }

                    // Public View: Link to Journal if possible
                    if (canViewJournal) {
                        return (
                            <Link key={week} href={`/forums/journal/${journalId}`} className="focus:outline-none">
                                {PillContent}
                            </Link>
                        );
                    }

                    // Default read-only view (locked, current, or no entry)
                    return PillContent;
                })}
            </div>
            {/* Fade Gradients */}
            <div className="absolute left-0 top-0 bottom-2 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />

            {/* Check-in Dialog */}
            <CheckInDialog
                open={!!activeWeek}
                onOpenChange={(open) => {
                    if (!open) {
                        setActiveWeek(null);
                        setNote("");
                    }
                }}
                title="Weekly Check-in"
                onSave={(status, note) => {
                    if (activeWeek && onStatusChange) {
                        onStatusChange(activeWeek, status, note);
                        setActiveWeek(null);
                        setNote("");
                    }
                }}
                initialStatus={activeWeek && weeklyLog ? weeklyLog[activeWeek] : null}
                initialNote={note}
            />
        </div>
    );
}
