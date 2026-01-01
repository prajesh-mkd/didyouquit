"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    deleteDoc,
    doc,
    updateDoc,
    serverTimestamp,
    orderBy
} from "firebase/firestore";
import { toast } from "sonner";
import { getFriendlyErrorMessage } from "@/lib/error-utils";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { getCurrentWeekKey } from "@/lib/date-utils";
import { clsx } from "clsx";

interface Resolution {
    id: string;
    title: string;
    weeklyLog: Record<string, boolean>;
    createdAt: any;
}

export default function Dashboard() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [resolutions, setResolutions] = useState<Resolution[]>([]);
    const [loading, setLoading] = useState(true);
    const [newResTitle, setNewResTitle] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/");
        }
    }, [authLoading, user, router]);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "resolutions"),
            where("uid", "==", user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const resData: Resolution[] = [];
            snapshot.forEach((doc) => {
                resData.push({ id: doc.id, ...doc.data() } as Resolution);
            });
            // Client-side sort to avoid Firestore Index requirement
            resData.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
            setResolutions(resData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching resolutions:", error);
            toast.error("Could not load resolutions. Check permissions.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleCreateResolution = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newResTitle.trim() || !user) return;

        setIsSubmitting(true);
        try {
            await addDoc(collection(db, "resolutions"), {
                uid: user.uid,
                title: newResTitle,
                weeklyLog: {},
                createdAt: serverTimestamp(),
            });
            setNewResTitle("");
            setIsDialogOpen(false);
            toast.success("Resolution created!");
        } catch (error: any) {
            const msg = getFriendlyErrorMessage(error);
            if (msg) toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this resolution?")) return;
        try {
            await deleteDoc(doc(db, "resolutions", id));
            toast.success("Resolution deleted");
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    const toggleWeek = async (res: Resolution, weekKey: string, value: boolean) => {
        try {
            const resRef = doc(db, "resolutions", res.id);
            await updateDoc(resRef, {
                [`weeklyLog.${weekKey}`]: value,
            });
        } catch (error: any) {
            toast.error("Failed to update status");
        }
    };

    if (authLoading || loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const currentWeek = getCurrentWeekKey();

    return (
        <div className="min-h-screen flex flex-col bg-[#F0FDF4]">
            <Header />
            <main className="container py-8 px-4 flex-1">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold">My Resolutions</h1>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" /> Add New
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Resolution</DialogTitle>
                                <DialogDescription>
                                    What do you want to achieve or quit this year?
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleCreateResolution}>
                                <div className="grid gap-4 py-4">
                                    <Input
                                        placeholder="e.g. Quit Smoking, Read more books..."
                                        value={newResTitle}
                                        onChange={(e) => setNewResTitle(e.target.value)}
                                        required
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Add Resolution"}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {resolutions.length === 0 ? (
                    <div className="text-center py-20 bg-muted/20 rounded-lg border border-dashed">
                        <h3 className="text-xl font-medium mb-2">No resolutions yet</h3>
                        <p className="text-muted-foreground mb-6">
                            Start by adding your first resolution for the year.
                        </p>
                        <Button onClick={() => setIsDialogOpen(true)}>Add Resolution</Button>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {resolutions.map((res) => (
                            <div key={res.id} className="border rounded-lg p-6 bg-card shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="font-semibold text-lg leading-tight pr-4">
                                        {res.title}
                                    </h3>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDelete(res.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between bg-muted/50 p-3 rounded-md mb-4">
                                    <span className="text-sm font-medium">This Week ({currentWeek.split('-W')[1]})</span>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant={res.weeklyLog?.[currentWeek] === true ? "default" : "outline"}
                                            className={clsx(
                                                res.weeklyLog?.[currentWeek] === true && "bg-green-600 hover:bg-green-700"
                                            )}
                                            onClick={() => toggleWeek(res, currentWeek, true)}
                                        >
                                            Yes
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant={res.weeklyLog?.[currentWeek] === false ? "default" : "outline"}
                                            className={clsx(
                                                res.weeklyLog?.[currentWeek] === false && "bg-red-600 hover:bg-red-700"
                                            )}
                                            onClick={() => toggleWeek(res, currentWeek, false)}
                                        >
                                            No
                                        </Button>
                                    </div>
                                </div>

                                {/* Visual Grid for History - Just a simple placeholder for now */}
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground">History</p>
                                    <div className="flex flex-wrap gap-1">
                                        {/* We could render past weeks here later */}
                                        {Object.entries(res.weeklyLog || {})
                                            .sort((a, b) => b[0].localeCompare(a[0]))
                                            .slice(0, 20) // show last 20 entries
                                            .map(([week, status]) => (
                                                <div
                                                    key={week}
                                                    className={clsx(
                                                        "h-3 w-3 rounded-full",
                                                        status ? "bg-green-500" : "bg-red-500"
                                                    )}
                                                    title={week}
                                                />
                                            ))
                                        }
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
            <Footer />
        </div>
    );
}
