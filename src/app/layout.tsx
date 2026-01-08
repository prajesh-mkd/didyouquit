
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://didyouquit.com'),
  title: {
    default: "DidYouQuit? | Public Goal & Resolution Tracker (Anonymous)",
    template: "%s | DidYouQuit?"
  },
  description:
    "Track goals and resolutions through public accountability while staying anonymous. Get motivation and support from others to stay on track all year.",
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: "DidYouQuit? | Public Goals, Private Identity",
    description:
      "A public goal and resolution tracker where commitments are visible, identities stay private, and community support helps you stay consistent.",
    url: 'https://didyouquit.com',
    siteName: 'DidYouQuit?',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "DidYouQuit? | Public Goals, Private Identity",
    description:
      "Make goals and resolutions public while staying anonymous. Weekly check-ins and community support help you stay accountable.",
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
