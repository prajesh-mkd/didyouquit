
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://didyouquit.com'),
  title: {
    default: "DidYouQuit? - Public New Year's Resolution Tracker",
    template: "%s | DidYouQuit?"
  },
  description: "Track your New Year resolutions simply. Anonymous public accountability to help you keep your goals in 2026.",
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "DidYouQuit? - Public New Year's Resolution Tracker",
    description: "Track your New Year resolutions simply. Anonymous public accountability to help you keep your goals in 2026.",
    url: 'https://didyouquit.com',
    siteName: 'DidYouQuit?',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "DidYouQuit?",
    description: "Track your resolutions simply. Anonymous public accountability.",
  },
};

import { SubscriptionStatusBanner } from "@/components/subscription/SubscriptionStatusBanner";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";

// ... (other imports)

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning={true}>
        <AuthProvider>
          <SubscriptionStatusBanner />
          <ImpersonationBanner />
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
