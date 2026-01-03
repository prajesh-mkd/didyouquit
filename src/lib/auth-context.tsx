"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

import { UserProfile } from "./types";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    userData: UserData | null; // Custom user data from Firestore
    refreshUserData: () => Promise<void>;
}

export type UserData = UserProfile;

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    userData: null,
    refreshUserData: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUserData = async (uid: string, email: string | null) => {
        try {
            const docRef = doc(db, "users", uid);
            const docSnap = getDoc(docRef);
            // Wait for it but don't block auth state if possible? 
            // Actually we want to display username, so waiting is okay.
            const snapshot = await docSnap;
            if (snapshot.exists()) {
                const data = snapshot.data() as UserData;
                setUserData(data);

                // Backfill email if missing in Firestore
                if (email && !data.email) {
                    await updateDoc(docRef, { email: email });
                    setUserData({ ...data, email: email });
                }
            } else {
                setUserData(null);
            }
        } catch (e) {
            console.error("Error fetching user data:", e);
        }
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);
            if (user) {
                await fetchUserData(user.uid, user.email);
            } else {
                setUserData(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const refreshUserData = async () => {
        if (user) {
            await fetchUserData(user.uid, user.email);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, userData, refreshUserData }}>
            {children}
        </AuthContext.Provider>
    );
};
