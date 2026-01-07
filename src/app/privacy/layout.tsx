import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Privacy Policy",
    description: "How DidYouQuit protects your data and privacy.",
};

export default function PrivacyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
