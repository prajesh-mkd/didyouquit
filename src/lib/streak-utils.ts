import { getISOWeek, getYear } from "date-fns";

export function calculateStreak(weeklyLog: Record<string, boolean> = {}): number {
    const now = new Date();
    const currentYear = getYear(now);
    const currentWeek = getISOWeek(now);

    let streak = 0;
    // Iterate backwards from current week
    // We allow the current week to be undecided, but if there's a break before that, streak ends.

    // Pointer starts at current week
    let year = currentYear;
    let week = currentWeek;

    // Safety break
    let iterations = 0;
    while (iterations < 100) { // Max 2 years back roughly
        const weekKey = `${year}-W${week.toString().padStart(2, '0')}`;
        const status = weeklyLog[weekKey];

        if (status === true) {
            streak++;
        } else if (status === false) {
            // Explicit failure breaks streak
            // Exception: If this is the *very first* check we are doing (i.e. we are at current week)
            // and we marked it false, then streak is definitely 0.
            // If we are looking at past weeks and hit a false, streak ends.
            break;
        } else {
            // Status is undefined/null
            // If this is the current week, we ignore it (streak continues from separate)
            // If this is a past week, that's a break (missing entry) -> Streak ends.

            // Wait, "current week" is special.
            const isCurrentWeek = year === currentYear && week === currentWeek;
            if (!isCurrentWeek) {
                break;
            }
            // If it IS current week and undefined, we just continue checking previous week.
        }

        // Decrement week
        week--;
        if (week < 1) {
            week = 52; // roughly handle year rollover
            year--;
        }

        // Don't go back forever, maybe limit to this year? 
        // For this app, it seems data is keyed by year-week. 
        // If we only have 52 weeks in current view (as per TimelinePills using 'currentYear'), 
        // maybe we only care about 'currentYear'?
        // The prompt implies "Retroactive" check-ins, so likely just this year.
        if (year < currentYear) {
            break; // Simplified: only track streak within current year for now as per UI limits
        }

        iterations++;
    }

    return streak;
}
