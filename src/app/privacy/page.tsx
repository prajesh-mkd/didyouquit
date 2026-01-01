import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-[#F0FDF4] font-sans text-slate-800 flex flex-col">
            <Header />
            <main className="container mx-auto px-6 py-12 flex-grow max-w-4xl">
                <h1 className="text-3xl font-bold text-emerald-900 mb-8">Privacy Policy</h1>

                <div className="prose prose-slate max-w-none bg-white p-10 rounded-xl shadow-sm border border-slate-100">
                    <p className="text-sm text-slate-500 mb-6 font-mono">Last Updated: January 1, 2026</p>

                    <h3>1. Introduction</h3>
                    <p>
                        DidYouQuit.com ("we", "us", or "our") respects your privacy. This Privacy Policy explains how we collect, use, and protect your personal information when you use our website.
                    </p>

                    <h3>2. Information We Collect</h3>
                    <p>We collect the following personal information via Firebase Authentication:</p>
                    <ul>
                        <li><strong>Account Information:</strong> Email address, Display Name, and Profile Picture (if provided via Google Sign-In).</li>
                        <li><strong>User Content:</strong> Resolutions, weekly progress logs, and any other text you enter into the application.</li>
                    </ul>

                    <h3>3. How We Use Your Information</h3>
                    <p>We use your information strictly to:</p>
                    <ul>
                        <li>Provide and maintain the Service (tracking your resolutions).</li>
                        <li>Manage your account and authentication.</li>
                        <li>Display your public profile and public resolutions (only if you choose to make them public).</li>
                    </ul>

                    <h3>4. Third-Party Services</h3>
                    <p>We use the following third-party services:</p>
                    <ul>
                        <li><strong>Google Firebase:</strong> We use Firebase for Authentication (log in/sign up), Database storage (Firestore), and Hosting. Firebase processes data on our behalf to provide these services.</li>
                        <li><strong>Google Sign-In:</strong> If you use Google Sign-In, we authenticate you via Google's OAuth service.</li>
                    </ul>
                    <p className="font-semibold text-emerald-700 bg-emerald-50 inline-block px-2 py-1 rounded">
                        Note: We do NOT use Google Analytics or any other third-party tracking pixels/cookies for marketing or analytics purposes.
                    </p>

                    <h3>5. Cookies</h3>
                    <p>
                        We use strictly necessary cookies (via Firebase Auth) to maintain your login session. We do not use advertising or tracking cookies.
                    </p>

                    <h3>6. GDPR Data Protection Rights</h3>
                    <p>If you are a resident of the European Economic Area (EEA), you have certain data protection rights, including:</p>
                    <ul>
                        <li>The right to access, update or delete the information we have on you.</li>
                        <li>The right of rectification.</li>
                        <li>The right to object.</li>
                        <li>The right of restriction.</li>
                        <li>The right to data portability.</li>
                        <li>The right to withdraw consent.</li>
                    </ul>
                    <p>
                        You can delete your account and all associated data directly within the application dashboard.
                    </p>

                    <h3>7. Contact Us</h3>
                    <p>
                        If you have any questions about this Privacy Policy, please contact us.
                    </p>
                </div>
            </main>
            <Footer />
        </div>
    );
}
