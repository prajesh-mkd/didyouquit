import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { auth, db } from "@/lib/firebase";
import {
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, collection, query, limit, getDocs, orderBy } from "firebase/firestore";
import { toast } from "sonner";
import { FolderCheck, Loader2, Globe } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

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
  const [authLoading, setAuthLoading] = useState(false);
  const [publicResolutions, setPublicResolutions] = useState<PublicResolution[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  // Email/Pass State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && user) {
      if (userData) {
        router.push("/dashboard");
      } else {
        router.push("/onboarding");
      }
    }
  }, [user, userData, loading, router]);

  // Fetch Public Feed
  useEffect(() => {
    const fetchFeed = async () => {
      try {
        // Fetch last 50 resolutions
        // Note: Client-side sorting used to avoid needing a composite index immediately
        const q = query(collection(db, "resolutions"), limit(50));
        const snapshot = await getDocs(q);

        const rawRes: PublicResolution[] = [];
        const userIds = new Set<string>();

        snapshot.forEach((doc) => {
          const data = doc.data();
          rawRes.push({ id: doc.id, ...data } as PublicResolution);
          if (data.uid) userIds.add(data.uid);
        });

        // Fetch users for these resolutions
        const userMap = new Map();
        // Fire all user fetches in parallel (ok for < 50 items)
        await Promise.all(
          Array.from(userIds).map(async (uid) => {
            try {
              const userSnap = await getDoc(doc(db, "users", uid));
              if (userSnap.exists()) {
                userMap.set(uid, userSnap.data());
              }
            } catch (e) {
              console.error("Failed to fetch user", uid);
            }
          })
        );

        // Join data and sort
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
      // Auth state listener in context will handle redirect
    } catch (error: any) {
      toast.error(error.message);
      setAuthLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // Auth state listener handles redirect
    } catch (error: any) {
      toast.error(error.message);
      setAuthLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      toast.error(error.message);
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <div className="flex-1 flex flex-col items-center p-4">

        <div className="max-w-md w-full space-y-8 text-center mb-12 mt-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary/10 rounded-full">
              <FolderCheck className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
            Did You Quit?
          </h1>
          <p className="text-xl text-muted-foreground">
            A simple, public way to track your New Year resolutions. Week by week.
          </p>
        </div>

        <Tabs defaultValue="login" className="w-[400px] max-w-full mb-16">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Login</CardTitle>
                <CardDescription>
                  Welcome back. Sign in to update your progress.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={authLoading}
                >
                  {authLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Continue with Google
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with email
                    </span>
                  </div>
                </div>
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="m@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Login"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card>
              <CardHeader>
                <CardTitle>Sign Up</CardTitle>
                <CardDescription>
                  Create an account to start tracking your resolutions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={authLoading}
                >
                  {authLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sign up with Google
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with email
                    </span>
                  </div>
                </div>
                <form onSubmit={handleEmailSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="m@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={authLoading}>
                    {authLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Account"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Global Feed Section */}
        <div className="w-full max-w-5xl space-y-6">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-2xl font-bold tracking-tight">Recently Added</h2>
          </div>

          {feedLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : publicResolutions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No resolutions found. Be the first!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {publicResolutions.map((res) => (
                <Link key={res.id} href={`/${res.user?.username || '#'}`} className="block transition-transform hover:-translate-y-1">
                  <Card className="h-full hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={res.user?.photoURL} />
                          <AvatarFallback>{res.user?.username?.[0] || "?"}</AvatarFallback>
                        </Avatar>
                        <div className="text-sm font-medium">
                          {res.user?.username || "Unknown"}
                        </div>
                        {res.user?.country && (
                          <span className="text-xs text-muted-foreground ml-auto bg-muted px-2 py-1 rounded-full">
                            {res.user.country}
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <h3 className="font-semibold text-lg leading-snug line-clamp-2">
                        {res.title}
                      </h3>
                      {res.createdAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          added {formatDistanceToNow(res.createdAt.toDate(), { addSuffix: true })}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
