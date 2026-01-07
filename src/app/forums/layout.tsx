import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Community Forum",
    description: "Join the discussion. Share tips, find support, and track your resolution progress with the community.",
};

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function ForumsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex flex-col bg-[#F0FDF4]">
            <Header />
            <main className="container py-8 px-4 flex-1 max-w-4xl mx-auto">
                {children}
            </main>
            <Footer />
        </div>
    );
}
