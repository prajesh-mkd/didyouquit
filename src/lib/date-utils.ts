
import { startOfWeek, getISOWeek, getYear, format, parseISO } from "date-fns";

export function getCurrentWeekKey() {
    const now = new Date();
    const week = getISOWeek(now);
    const year = getYear(now);
    return `${year}-W${week.toString().padStart(2, '0')}`;
}

export function getWeekKey(date: Date) {
    const week = getISOWeek(date);
    const year = getYear(date);
    return `${year}-W${week.toString().padStart(2, '0')}`;
}

export function getWeekLabel(weekKey: string) {
    // Format "2024-W01" to "Week 1, 2024" or shorter
    const [year, week] = weekKey.split("-W");
    return `W${week}`;
}
