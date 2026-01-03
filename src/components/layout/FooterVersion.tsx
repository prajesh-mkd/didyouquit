"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function FooterVersion() {
    const [version, setVersion] = useState<string | null>(null);

    useEffect(() => {
        const fetchVersion = async () => {
            try {
                // We assume there is a document 'app_config/public' with field 'version'
                const docRef = doc(db, "app_config", "public");
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && docSnap.data().version) {
                    setVersion(docSnap.data().version);
                } else {
                    // Fallback to minimal default or console log? 
                    // Let's silently fail to default if missing, or specific value
                    console.log("No version config found in DB");
                }
            } catch (error) {
                console.error("Error fetching version:", error);
            }
        };

        fetchVersion();
    }, []);

    if (!version) return null; // Or return generic loading state? Better to hide if failing.

    return <span>(v{version})</span>;
}
