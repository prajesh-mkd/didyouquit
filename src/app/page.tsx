"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { auth, db } from "@/lib/firebase";
import {
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { doc, getDoc, collection, query, limit, getDocs } from "firebase/firestore";
import { toast } from "sonner";
import { Loader2, Target, CheckCircle2, Users, ArrowRight, Globe } from "lucide-react";
import Link from "next/link";
import { startOfWeek, endOfWeek, format, setWeek } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getFriendlyErrorMessage } from "@/lib/error-utils";
import { LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

interface PublicResolution {
  id: string;
  title: string;
  uid: string;
  createdAt: any;
  user?: {
    username: string;
    country: string;
    photoURL?: string;
  };
}

function HomeContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auth State
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Feed State
  const [publicResolutions, setPublicResolutions] = useState<PublicResolution[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  // Helper for tooltips
  const getWeekRange = (weekNum: number) => {
    const now = new Date();
    const targetDate = setWeek(now, weekNum, { weekStartsOn: 1 });
    const start = startOfWeek(targetDate, { weekStartsOn: 1 });
    const end = endOfWeek(targetDate, { weekStartsOn: 1 });
    return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
  };

  const currentYear = new Date().getFullYear();
  const weeks = Array.from({ length: 52 }, (_, i) => i + 1);

  // Check URL query params for auth trigger
  useEffect(() => {
    const authParam = searchParams.get("auth");
    if (authParam === "login") {
      setAuthMode("login");
      setAuthOpen(true);
      window.history.replaceState(null, "", "/");
    } else if (authParam === "signup") {
      setAuthMode("signup");
      setAuthOpen(true);
      window.history.replaceState(null, "", "/");
    }
  }, [searchParams]);

  // Fetch Public Feed
  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const q = query(collection(db, "resolutions"), limit(50));
        const snapshot = await getDocs(q);

        const rawRes: PublicResolution[] = [];
        const userIds = new Set<string>();

        snapshot.forEach((doc) => {
          const data = doc.data();
          rawRes.push({ id: doc.id, ...doc.data() } as PublicResolution);
          if (data.uid) userIds.add(data.uid);
        });

        const userMap = new Map();
        await Promise.all(
          Array.from(userIds).map(async (uid) => {
            try {
              const userSnap = await getDoc(doc(db, "users", uid));
              if (userSnap.exists()) userMap.set(uid, userSnap.data());
            } catch (e) { console.error(e); }
          })
        );

        const enriched = rawRes.map(res => ({
          ...res,
          user: userMap.get(res.uid)
        }));

        const shuffled = enriched.sort(() => 0.5 - Math.random()).slice(0, 15);
        setPublicResolutions(shuffled);
      } catch (error) {
        console.error("Error fetching feed:", error);
      } finally {
        setFeedLoading(false);
      }
    };
    fetchFeed();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setAuthLoading(false);
      setAuthOpen(false);
      toast.success(authMode === "signup" ? "Account created! Welcome." : "Welcome back!");
    } catch (error: any) {
      const msg = getFriendlyErrorMessage(error);
      if (msg) toast.error(msg);
      setAuthLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (authMode === "signup") {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        toast.success("Account created! Verification email sent.");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Welcome back!");
      }
      setAuthLoading(false);
      setAuthOpen(false);
    } catch (error: any) {
      const msg = getFriendlyErrorMessage(error);
      if (msg) toast.error(msg);
      setAuthLoading(false);
    }
  };

  const openAuth = (mode: "login" | "signup") => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#F0FDF4] font-sans text-slate-800">
      <Header />

      <section className="container mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold text-emerald-800 tracking-tight mb-6">
          Keep Your Resolutions.
        </h1>
        <p className="text-lg text-slate-600 max-w-4xl mx-auto mb-10 leading-relaxed">
          Public accountability for your New Year's goals. Share your resolutions anonymously, track your weekly progress, and join a community committed to self-improvement.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-14 text-lg rounded-full shadow-lg shadow-emerald-200 w-full sm:w-auto"
            onClick={() => router.push("/public-resolutions")}
          >
            View Public Resolutions 2026
          </Button>
          <Button
            variant="outline"
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-8 h-14 text-lg rounded-full w-full sm:w-auto"
            onClick={() => user ? router.push("/dashboard") : openAuth("signup")}
          >
            {user ? "View My Resolutions" : "Add Yours Anonymously"} <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-12 text-center">
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <Target className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold mb-3">Share Your Goal</h3>
            <p className="text-slate-500 leading-relaxed">
              Make your resolution public. Declaring your intention is the first step towards achieving it.
            </p>
          </div>
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold mb-3">Track Your Progress</h3>
            <p className="text-slate-500 leading-relaxed">
              Every week, mark whether you've stuck to your resolution. Simple yes or no is all it takes.
            </p>
          </div>
          <div className="flex flex-col items-center">
            <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <Users className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold mb-3">Stay Motivated</h3>
            <p className="text-slate-500 leading-relaxed">
              See how others are doing. The power of a community can provide the encouragement you need.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-20 border-t border-emerald-100">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16 text-emerald-900">Public Resolutions 2026</h2>

          {feedLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : publicResolutions.length === 0 ? (
            <div className="text-center bg-slate-50 py-12 rounded-lg border border-dashed border-slate-200">
              <p className="text-slate-500">No public resolutions yet. Be the first to share your goal!</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="md:hidden divide-y divide-slate-100">
                {publicResolutions.map((res) => (
                  <div key={res.id} className="p-4 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Link href={`/${res.user?.username || res.uid}`}>
                          <Avatar className="h-10 w-10 border border-slate-200">
                            <AvatarImage src={res.user?.photoURL} />
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-bold">
                              {res.user?.username?.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div>
                          <Link href={`/${res.user?.username || res.uid}`} className="font-semibold text-slate-800 hover:text-emerald-700 transition-colors block">
                            {res.user?.username || "Anonymous"}
                          </Link>
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <Globe className="h-3 w-3" />
                            {res.user?.country || "Earth"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 font-medium text-slate-900 mb-2">
                        <Target className="h-4 w-4 text-emerald-500 shrink-0" />
                        {res.title}
                      </div>
                    </div>

                    <div className="bg-slate-50/50 rounded-lg p-3 border border-slate-100">
                      <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider font-semibold">Yearly Progress</p>
                      <div className="flex flex-wrap gap-3">
                        <TooltipProvider delayDuration={0}>
                          {weeks.map((week) => {
                            const weekKey = `${currentYear}-W${week.toString().padStart(2, '0')}`;
                            const status = (res as any).weeklyLog?.[weekKey];

                            let colorClass = "bg-slate-200 border-slate-300";
                            if (status === true) colorClass = "bg-emerald-500 border-emerald-500";
                            if (status === false) colorClass = "bg-red-400 border-red-400";

                            return (
                              <Tooltip key={week}>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`w-3 h-3 rounded-full border ${colorClass} shrink-0 cursor-default`}
                                  />
                                </TooltipTrigger>
                                <TooltipContent className="bg-slate-800 text-white border-0 text-xs">
                                  <p className="font-bold mb-0.5">Week {week}</p>
                                  <p className="text-slate-300 font-normal">{getWeekRange(week)}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-emerald-50/50 text-emerald-900">
                    <tr>
                      <th className="p-4 font-semibold border-b border-emerald-100 w-[250px]">User</th>
                      <th className="p-4 font-semibold border-b border-emerald-100 w-[150px]">Country</th>
                      <th className="p-4 font-semibold border-b border-emerald-100 w-[300px]">Resolution</th>
                      <th className="p-4 font-semibold border-b border-emerald-100 min-w-[300px]">Progress (52 Weeks)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {publicResolutions.map((res) => (
                      <tr key={res.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="p-4">
                          <Link href={`/${res.user?.username || res.uid}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                            <Avatar className="h-8 w-8 border border-slate-200">
                              <AvatarImage src={res.user?.photoURL} />
                              <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                                {res.user?.username?.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-slate-700 group-hover:text-emerald-700 transition-colors">
                              {res.user?.username || "Anonymous"}
                            </span>
                          </Link>
                        </td>
                        <td className="p-4 text-slate-600">
                          <div className="flex items-center gap-2">
                            <Globe className="h-4 w-4 text-slate-400" />
                            {res.user?.country || "Unknown"}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 font-medium text-slate-800">
                            <Target className="h-4 w-4 text-emerald-500 shrink-0" />
                            {res.title}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-3 max-w-[600px]">
                            <TooltipProvider delayDuration={0}>
                              {weeks.map((week) => {
                                const weekKey = `${currentYear}-W${week.toString().padStart(2, '0')}`;
                                const status = (res as any).weeklyLog?.[weekKey];

                                let colorClass = "bg-slate-100 border-slate-200";
                                if (status === true) colorClass = "bg-emerald-500 border-emerald-500";
                                if (status === false) colorClass = "bg-red-400 border-red-400";

                                return (
                                  <Tooltip key={week}>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`w-3 h-3 rounded-full border ${colorClass} cursor-default`}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-slate-800 text-white border-0 text-xs">
                                      <p className="font-bold mb-0.5">Week {week}</p>
                                      <p className="text-slate-300 font-normal">{getWeekRange(week)}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </TooltipProvider>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-12 text-center">
            <Button size="lg" className="bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50" asChild>
              <Link href="/public-resolutions">
                View All Resolutions <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-md p-8 bg-white shadow-2xl border-slate-100">
          <DialogHeader className="space-y-4 mb-4 text-center">
            <DialogTitle className="text-3xl font-bold tracking-tight text-slate-900">
              {authMode === "signup" ? "Create an account" : "Welcome back"}
            </DialogTitle>
            <DialogDescription className="text-base text-slate-600">
              {authMode === "signup"
                ? "Choose your preferred sign-up method"
                : "Sign in to continue tracking your goals"}
            </DialogDescription>
          </DialogHeader>

          <Button
            variant="outline"
            className="w-full bg-white border-slate-200 hover:bg-slate-50 h-12 text-base font-medium text-slate-700"
            onClick={handleGoogleLogin}
            disabled={authLoading}
          >
            {authLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Google
          </Button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-500 font-semibold">
                Or continue with
              </span>
            </div>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-600">
                {authMode === "signup" ? "Enter your email" : "Email"}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                className="h-12 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-slate-600">
                  {authMode === "signup" ? "Set password" : "Password"}
                </Label>
                {authMode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthOpen(false);
                      setForgotPasswordOpen(true);
                    }}
                    className="text-xs text-emerald-600 hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                type="password"
                className="h-12 bg-white border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base bg-emerald-500 hover:bg-emerald-600 text-white mt-2"
              disabled={authLoading}
            >
              {authLoading ? <Loader2 className="animate-spin" /> : (authMode === "signup" ? "Create Account" : "Log In")}
            </Button>

            {authMode === "signup" && (
              <p className="text-xs text-center text-slate-400 mt-4 px-4 leading-relaxed">
                By clicking continue, you agree to our{" "}
                <Link href="#" className="underline hover:text-emerald-600">Terms of Service</Link>
                {" "}and{" "}
                <Link href="#" className="underline hover:text-emerald-600">Privacy Policy</Link>.
              </p>
            )}
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setAuthMode(authMode === "signup" ? "login" : "signup");
                setEmail("");
                setPassword("");
              }}
              className="text-sm text-slate-500 hover:text-emerald-600 underline underline-offset-4"
            >
              {authMode === "signup" ? "Already have an account? Log In" : "Need an account? Sign Up"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <ForgotPasswordDialog
        open={forgotPasswordOpen}
        onOpenChange={setForgotPasswordOpen}
        defaultEmail={email}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
