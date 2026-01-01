
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";
import { auth, db } from "@/lib/firebase";
import {
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, collection, query, limit, getDocs } from "firebase/firestore";
import { toast } from "sonner";
import { Loader2, Target, CheckCircle2, Users, ArrowRight, CircleUserRound } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getFriendlyErrorMessage } from "@/lib/error-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";
import { signOut } from "firebase/auth";

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

export default function Home() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  // Auth State
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Feed State
  const [publicResolutions, setPublicResolutions] = useState<PublicResolution[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  // Removed auto-redirect to allow logged-in users to see landing page


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
          rawRes.push({ id: doc.id, ...data } as PublicResolution);
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
        })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        setPublicResolutions(enriched);
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
      // Success handling:
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
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      // Success handling:
      setAuthLoading(false);
      setAuthOpen(false);
      toast.success(authMode === "signup" ? "Account created! Welcome." : "Welcome back!");
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

  if (loading) return null; // Avoid flicker

  return (
    <div className="min-h-screen bg-[#F0FDF4] font-sans text-slate-800">
      {/* Navbar */}
      <header className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6 text-emerald-600" />
          <span className="font-bold text-xl tracking-tight">DidYouQuit.com</span>
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <Button variant="ghost" asChild className="hidden md:flex text-emerald-800 hover:text-emerald-900 hover:bg-emerald-100/50">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-white ring-2 ring-emerald-100">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={userData?.photoURL} alt={userData?.username || "User"} />
                      <AvatarFallback className="bg-emerald-100 text-emerald-600 font-bold">{userData?.username?.slice(0, 2).toUpperCase() || "U"}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{userData?.username || "User"}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard">Dashboard</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/${userData?.username || user.uid}`}>Public Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={async () => {
                    await signOut(auth);
                    router.push("/");
                    toast.success("Logged out successfully");
                  }}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <>
              <button
                onClick={() => openAuth("login")}
                className="text-sm font-medium hover:text-emerald-600 transition-colors"
              >
                Log In
              </button>
              <Button
                onClick={() => openAuth("signup")}
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-md px-6 shadow-md shadow-emerald-200"
              >
                Sign Up
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-5xl md:text-6xl font-extrabold text-emerald-800 tracking-tight mb-6">
          Keep Your Resolutions.
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          Public accountability for your New Year's goals. Share your resolutions, track your weekly progress, and join a community committed to self-improvement.
        </p>
        <Button
          size="lg"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-14 text-lg rounded-full shadow-lg shadow-emerald-200"
          onClick={() => user ? router.push("/dashboard") : openAuth("signup")}
        >
          {user ? "Go to Dashboard" : "Start Your Journey"} <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </section>

      {/* Features Grid */}
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

      {/* Public Commitments / Feed */}
      <section className="bg-white py-20 border-t border-emerald-100">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-16">Public Commitments</h2>

          {feedLoading ? (
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : publicResolutions.length === 0 ? (
            <div className="text-center bg-slate-50 py-12 rounded-lg border border-dashed border-slate-200">
              <p className="text-slate-500">No public resolutions yet. Be the first to share your goal!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publicResolutions.map((res) => (
                <Link key={res.id} href={`/ ${res.user?.username || '#'} `} className="block group">
                  <div className="bg-white border border-slate-100 p-6 rounded-xl hover:shadow-md hover:border-emerald-200 transition-all h-full flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="h-10 w-10 border border-slate-100">
                        <AvatarImage src={res.user?.photoURL} />
                        <AvatarFallback className="bg-emerald-50 text-emerald-600">{res.user?.username?.[0] || "?"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-sm">{res.user?.username || "Anonymous"}</p>
                        <p className="text-xs text-slate-500">{res.user?.country || "Earth"}</p>
                      </div>
                    </div>
                    <h3 className="font-medium text-lg text-slate-800 mb-2 group-hover:text-emerald-700 transition-colors">
                      {res.title}
                    </h3>
                    <div className="mt-auto pt-4 flex items-center text-xs text-slate-400">
                      <CircleUserRound className="h-3 w-3 mr-1" />
                      <span>added {res.createdAt ? formatDistanceToNow(res.createdAt.toDate(), { addSuffix: true }) : 'recently'}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-12 border-t border-slate-100 text-center text-slate-400 text-sm">
        <p>© 2026 DidYouQuit.com. All rights reserved. (v2.0)</p>
      </footer>

      {/* Auth Dialog */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="sm:max-w-md p-8 bg-emerald-50/50 backdrop-blur-xl border-emerald-100">
          <DialogHeader className="space-y-4 mb-4 text-center">
            <DialogTitle className="text-2xl font-bold">
              {authMode === "signup" ? "Create an account" : "Welcome back"}
            </DialogTitle>
            <DialogDescription>
              {authMode === "signup"
                ? "Choose your preferred sign-up method"
                : "Sign in to continue tracking your goals"}
            </DialogDescription>
          </DialogHeader>

          <Button
            variant="outline"
            className="w-full bg-white border-slate-200 hover:bg-slate-50 h-12 text-base font-normal"
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
              <span className="bg-[#effef6] px-2 text-slate-400">
                Or continue with
              </span>
            </div>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-600">Email</Label>
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
              <Label htmlFor="password" className="text-slate-600">Password</Label>
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
    </div>
  );
}

