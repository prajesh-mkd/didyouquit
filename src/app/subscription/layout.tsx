import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Premium Plan",
    description: "Upgrade your resolution tracking. Get unlimited goals, advanced analytics, and community badges.",
};

export default function SubscriptionLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
