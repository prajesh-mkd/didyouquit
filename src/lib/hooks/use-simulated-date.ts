"use client";

import { useState, useEffect } from "react";

const SIMULATION_KEY = "didyouquit_simulated_date";
const SIMULATION_ACTIVE_KEY = "didyouquit_simulation_active";

export function useSimulatedDate() {
    const [date, setDate] = useState<Date>(new Date());
    const [isSimulated, setIsSimulated] = useState(false);

    // Initial Load
    useEffect(() => {
        const storedDate = localStorage.getItem(SIMULATION_KEY);
        const storedActive = localStorage.getItem(SIMULATION_ACTIVE_KEY);

        if (storedActive === "true" && storedDate) {
            setDate(new Date(storedDate));
            setIsSimulated(true);
        } else {
            // Force client-side date on mount to prevent hydration mismatch with server time
            setDate(new Date());
        }
    }, []);

    // Listen for custom event to update across components immediately
    useEffect(() => {
        const handleStorageChange = () => {
            const storedDate = localStorage.getItem(SIMULATION_KEY);
            const storedActive = localStorage.getItem(SIMULATION_ACTIVE_KEY);

            if (storedActive === "true" && storedDate) {
                setDate(new Date(storedDate));
                setIsSimulated(true);
            } else {
                setDate(new Date());
                setIsSimulated(false);
            }
        };

        window.addEventListener("didyouquit_date_simulation_update", handleStorageChange);
        return () => window.removeEventListener("didyouquit_date_simulation_update", handleStorageChange);
    }, []);

    const enableSimulation = (targetDate: Date) => {
        localStorage.setItem(SIMULATION_KEY, targetDate.toISOString());
        localStorage.setItem(SIMULATION_ACTIVE_KEY, "true");
        window.dispatchEvent(new Event("didyouquit_date_simulation_update"));
    };

    const disableSimulation = () => {
        localStorage.setItem(SIMULATION_ACTIVE_KEY, "false");
        window.dispatchEvent(new Event("didyouquit_date_simulation_update"));
    };

    return {
        date,
        isSimulated,
        enableSimulation,
        disableSimulation
    };
}
