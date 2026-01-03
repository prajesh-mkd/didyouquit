import { useRef, useLayoutEffect, useState, useEffect } from "react";
import { Check, X, Minus, CheckCircle2, XCircle } from "lucide-react";
import { startOfWeek, endOfWeek, format, setWeek, getISOWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface TimelinePillsProps {
    resId: string;
    weeklyLog?: { [key: string]: boolean };
    weeklyNotes?: { [key: string]: string };
    currentYear: number;
    onStatusChange?: (weekKey: string, status: boolean, note?: string) => void;
}

export function TimelinePills({ resId, weeklyLog, weeklyNotes, currentYear, onStatusChange }: TimelinePillsProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const currentWeekNum = getISOWeek(new Date());

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

    const handleSave = (status: boolean) => {
        if (activeWeek && onStatusChange) {
            onStatusChange(activeWeek, status, note);
            setActiveWeek(null);
            setNote("");
        }
    };

    const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

    return (
        <TooltipProvider delayDuration={0}>
            <div className="relative w-full overflow-hidden group/timeline">
                <div
                    ref={scrollContainerRef}
                    className="flex overflow-x-auto pb-2 pt-1 gap-2 no-scrollbar snap-x snap-mandatory scroll-px-4 px-1"
                >
                    {weeks.map((week) => {
                        const weekKey = `${currentYear}-W${week.toString().padStart(2, '0')}`;
                        const status = weeklyLog?.[weekKey];
                        const isCurrentWeek = week === currentWeekNum;
                        // Lock current week AND future weeks
                        const isLocked = week >= currentWeekNum;

                        let bgClass = "bg-slate-50 border-slate-200 text-slate-600";
                        let icon = <Minus className="h-3 w-3" />;

                        if (status === true) {
                            bgClass = "bg-emerald-500 border-emerald-600 text-white shadow-sm";
                            icon = <Check className="h-3 w-3 text-white" />;
                        } else if (status === false) {
                            bgClass = "bg-red-500 border-red-600 text-white shadow-sm";
                            icon = <X className="h-3 w-3 text-white" />;
                        }

                        const PillContent = (
                            <div
                                key={week}
                                id={`pill-${resId}-${week}`}
                                className={`
                                    flex flex-col items-center justify-center 
                                    min-w-[100px] h-[52px] 
                                    rounded-lg border ${bgClass} 
                                    text-xs snap-start flex-shrink-0
                                    ${onStatusChange && !isLocked ? 'cursor-pointer hover:opacity-90 active:scale-95 transition-all' : ''}
                                    ${isLocked ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}
                                `}
                            >
                                <div className="font-bold text-[10px] uppercase tracking-wider mb-0.5 opacity-80">
                                    {isCurrentWeek ? "Current Week" : `Week ${week}`}
                                </div>
                                <div className="font-medium whitespace-nowrap px-2">
                                    {getWeekRange(week)}
                                </div>
                            </div>
                        );

                        // If user can change status and it's NOT locked (past weeks)
                        if (onStatusChange && !isLocked) {
                            return (
                                <button key={week} onClick={() => setActiveWeek(weekKey)} className="focus:outline-none">
                                    {PillContent}
                                </button>
                            );
                        }

                        // If it IS locked (current/future), show Tooltip explaining why
                        if (isLocked) {
                            return (
                                <Tooltip key={week}>
                                    <TooltipTrigger asChild>
                                        <div className="cursor-not-allowed">{PillContent}</div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>You can only check in for this week once it is over (next Monday).</p>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        }

                        // Default read-only view
                        return PillContent;
                    })}
                </div>
                {/* Fade Gradients */}
                <div className="absolute left-0 top-0 bottom-2 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none" />
                <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />

                {/* Check-in Dialog */}
                <Dialog open={!!activeWeek} onOpenChange={(open) => !open && setActiveWeek(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Weekly Check-in</DialogTitle>
                            <DialogDescription>
                                Did you keep your resolution for this week?
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-2">
                            <div className="flex gap-4 justify-center">
                                <Button
                                    size="lg"
                                    onClick={() => handleSave(true)}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-12 text-base"
                                >
                                    <CheckCircle2 className="h-5 w-5" /> Yes, I did it!
                                </Button>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    onClick={() => handleSave(false)}
                                    className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 gap-2 h-12 text-base"
                                >
                                    <XCircle className="h-5 w-5" /> I missed it
                                </Button>
                            </div>
                            <div className="space-y-2 pt-2 border-t mt-2">
                                <label className="text-sm font-medium text-slate-700">Add a note (optional)</label>
                                <Textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="How did it go? share your wins or struggles..."
                                    className="min-h-[100px]"
                                />
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
}
