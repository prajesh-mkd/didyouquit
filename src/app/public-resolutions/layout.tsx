import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Public Resolutions 2026",
    description: "Browse public New Year's resolutions for 2026. See what others are committing to and get inspired.",
};

export default function PublicResolutionsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
