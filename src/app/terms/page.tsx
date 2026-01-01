import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-[#F0FDF4] font-sans text-slate-800 flex flex-col">
            <Header />
            <main className="container mx-auto px-6 py-12 flex-grow max-w-4xl">
                <h1 className="text-3xl font-bold text-emerald-900 mb-8">Terms of Service</h1>

                <div className="prose prose-slate max-w-none bg-white p-10 rounded-xl shadow-sm border border-slate-100">
                    <p className="text-sm text-slate-500 mb-6 font-mono">Last Updated: January 1, 2026</p>

                    <h3>1. Acceptance of Terms</h3>
                    <p>
                        By accessing or using DidYouQuit.com, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
                    </p>

                    <h3>2. Description of Service</h3>
                    <p>
                        DidYouQuit.com provides a platform for tracking personal resolutions and goals ("Service"). Users may post public resolutions, track weekly progress, and view others' public commitments.
                    </p>

                    <h3>3. User Accounts</h3>
                    <p>
                        To access certain features, you must create an account via Email or Google Sign-In. You are responsible for maintaining the confidentiality of your account information.
                    </p>

                    <h3>4. User Content & Conduct</h3>
                    <p>
                        You retain ownership of the resolutions and data you post. By making a resolution "Public", you grant us a non-exclusive license to display it on the platform.
                    </p>
                    <p>
                        You agree not to post content that is illegal, abusive, harassing, or violates the rights of others. We reserve the right to remove any content that violates these terms.
                    </p>

                    <h3>5. Termination</h3>
                    <p>
                        We reserve the right to suspend or terminate your account at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason.
                    </p>

                    <h3>6. Disclaimer of Warranties</h3>
                    <p>
                        The Service is provided on an "AS IS" and "AS AVAILABLE" basis. We disclaim all warranties of any kind, whether express or implied.
                    </p>

                    <h3>7. Limitation of Liability</h3>
                    <p>
                        In no event shall DidYouQuit.com be liable for any indirect, incidental, special, consequential or punitive damages arising out of or related to your use of the Service.
                    </p>

                    <h3>8. Contact</h3>
                    <p>
                        For any questions regarding these Terms, please contact us.
                    </p>
                </div>
            </main>
            <Footer />
        </div>
    );
}
