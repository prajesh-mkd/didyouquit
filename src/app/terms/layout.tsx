import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Terms of Service",
    description: "Terms and conditions for using DidYouQuit.com.",
};

export default function TermsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
