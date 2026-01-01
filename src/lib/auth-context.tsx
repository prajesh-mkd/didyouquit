"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    userData: UserData | null; // Custom user data from Firestore
    refreshUserData: () => Promise<void>;
}

export interface UserData {
    uid: string;
    username: string;
    country: string;
    photoURL: string;
    createdAt: any;
}

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

    const fetchUserData = async (uid: string) => {
        try {
            const docRef = doc(db, "users", uid);
            const docSnap = getDoc(docRef);
            // Wait for it but don't block auth state if possible? 
            // Actually we want to display username, so waiting is okay.
            const snapshot = await docSnap;
            if (snapshot.exists()) {
                setUserData(snapshot.data() as UserData);
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
                await fetchUserData(user.uid);
            } else {
                setUserData(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const refreshUserData = async () => {
        if (user) {
            await fetchUserData(user.uid);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, userData, refreshUserData }}>
            {children}
        </AuthContext.Provider>
    );
};
