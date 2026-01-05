import { format, parseISO, subWeeks, startOfWeek, setWeek, getISOWeek, getISOWeekYear, differenceInCalendarWeeks } from "date-fns";

export function calculateStreak(weeklyLog: Record<string, boolean> = {}, referenceDate: Date = new Date()): number {
    // 0. Check for explicit failure at the end
    // If the *most recent* recorded entry is a FAILURE (false), streak is reset to 0.
    const allKeys = Object.keys(weeklyLog).sort().reverse();
    if (allKeys.length > 0) {
        const latestKey = allKeys[0];
        if (weeklyLog[latestKey] === false) {
            return 0;
        }

        // Check 2: Inactivity Gap (The "Grey Box" Rule)
        // If the gap between NOW (referenceDate) and the Latest Entry is >= 2 weeks, streak is 0.
        // (i.e. Last week was missed/grey AND Current week is grey)
        const latestDate = getDateFromWeekKey(latestKey);
        // We use differenceInCalendarWeeks to count full week boundaries crossed
        // weekStartsOn: 1 (Monday) ensures Monday-Sunday weeks
        const diff = differenceInCalendarWeeks(referenceDate, latestDate, { weekStartsOn: 1 });

        // If diff is 3 or more, it means we skipped at least TWO full weeks in between.
        // e.g. Current: W5. Latest: W2. Diff = 3. (W4, W3 skipped). Reset.
        // e.g. Current: W5. Latest: W3. Diff = 2. (W4 skipped). Valid.
        if (diff >= 3) {
            return 0;
        }
    }

    // 1. Extract all keys where status is explicitly TRUE
    const trueKeys = Object.entries(weeklyLog)
        .filter(([_, status]) => status === true)
        .map(([key]) => key)
        .sort() // ASCII sort works for YYYY-Www format
        .reverse(); // Newest first

    if (trueKeys.length === 0) return 0;

    let streak = 0;

    // 2. Start from the latest success
    // We parse the key to a Date object to robustly calculate "Previous Week"
    // handling year boundaries correctly (e.g. after W01 comes prev year W52/53)
    let currentKey = trueKeys[0];

    // Safety check: If for some reason the gap check passed (e.g. latest was FALSE? No, we return 0 above)
    // Wait, latestKey might be TRUE (W3). Current Key is W3.
    // Diff logic handled the W5 vs W3 case.

    streak = 1;

    for (let i = 1; i < trueKeys.length; i++) {
        const prevKey = trueKeys[i];

        // Calculate what the *expected* previous key should be
        const expectedPrevKey = getPreviousWeekKey(currentKey);

        if (prevKey === expectedPrevKey) {
            streak++;
            currentKey = prevKey;
        } else {
            // Gap detected, streak ends
            break;
        }
    }

    return streak;
}

// Helper: Parse "YYYY-Www" to Date (Monday of that week)
function getDateFromWeekKey(key: string): Date {
    const [yearStr, weekStr] = key.split("-W");
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);

    // Get ISO week date
    // Jan 4th is always in First ISO Week.
    return startOfWeek(setWeek(new Date(year, 0, 4), week, { weekStartsOn: 1 }), { weekStartsOn: 1 });
}

// Helper to reliably decrement week key
function getPreviousWeekKey(key: string): string {
    const [yearStr, weekStr] = key.split("-W");
    const year = parseInt(yearStr);
    const week = parseInt(weekStr);

    // Create a date object for the Monday of that week
    if (week > 1) {
        return `${year}-W${(week - 1).toString().padStart(2, '0')}`;
    }

    // Boundary Case: Week 1 -> Need last week of previous year
    const w1Date = setWeek(new Date(year, 0, 4), 1, { weekStartsOn: 1 });
    const prevWeekDate = subWeeks(w1Date, 1);

    const pYear = getISOWeekYear(prevWeekDate);
    const pWeek = getISOWeek(prevWeekDate);

    return `${pYear}-W${pWeek.toString().padStart(2, '0')}`;
}
