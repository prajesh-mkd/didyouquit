import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-[#F0FDF4] font-sans text-slate-800 flex flex-col">
            <Header />
            <main className="container mx-auto px-6 py-12 flex-grow">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-extrabold text-emerald-900 tracking-tight mb-4">Terms of Service</h1>
                        <p className="text-emerald-700/80 font-medium">Last Updated: January 1, 2026</p>
                    </div>

                    <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-100 prose prose-lg prose-emerald max-w-none prose-headings:font-extrabold prose-headings:tracking-tight prose-h2:text-3xl prose-h2:text-emerald-950 prose-h2:border-b prose-h2:border-slate-100 prose-h2:pb-4 prose-h2:mt-12 prose-h2:mb-6 prose-h3:text-xl prose-h3:text-emerald-800 prose-p:text-slate-600 prose-li:text-slate-600">
                        <section>
                            <h2>1. Agreement to Terms</h2>
                            <p>
                                These Terms of Service constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you") and <strong>DidYouQuit.com</strong> ("we," "us," or "our"),
                                concerning your access to and use of the DidYouQuit.com website and any related services (collectively, the "Service").
                            </p>
                            <p>
                                By accessing or using the Service, you agree that you have read, understood, and accept to be bound by complying with these Terms.
                                <strong> If you do not agree with all of these Terms, then you are expressly prohibited from using the Service and must discontinue use immediately.</strong>
                            </p>
                        </section>

                        <section>
                            <h2>2. User Accounts</h2>
                            <h3>2.1 Registration</h3>
                            <p>
                                To access certain features of the Service (such as creating resolutions), you may be required to register for an account using Google Sign-In or an email address.
                                You agree to provide accurate, current, and complete information during the registration process.
                            </p>
                            <h3>2.2 Account Security</h3>
                            <p>
                                You are responsible for safeguarding the password and credentials that you use to access the Service.
                                You agree not to disclose your password to any third party and to notify us immediately if you suspect any unauthorized use of your account.
                            </p>
                        </section>

                        <section>
                            <h2>3. User Generated Content</h2>
                            <h3>3.1 Ownership</h3>
                            <p>
                                You retain full ownership of the text, data, and information you post, upload, or otherwise make available via the Service ("User Content").
                                We do not claim ownership rights to your User Content.
                            </p>
                            <h3>3.2 License to DidYouQuit.com</h3>
                            <p>
                                By making your Resolutions "Public," you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, adapt, publish,
                                and display such User Content in connection with providing and improving the Service (e.g., displaying it on the Public Resolutions Feed).
                            </p>
                            <h3>3.3 Responsibility</h3>
                            <p>
                                You are solely responsible for your User Content. You represent and warrant that you own or have the necessary rights to use and authorize the use of your User Content.
                            </p>
                        </section>

                        <section>
                            <h2>4. Prohibited Activities</h2>
                            <p>You may not access or use the Service for any purpose other than that for which we make the Service available. As a user of the Service, you agree not to:</p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>Use the Service to harass, abuse, or harm another person or group.</li>
                                <li>Make any unauthorized use of the Service, including collecting usernames or email addresses of users by electronic or other means for the purpose of sending unsolicited email.</li>
                                <li>Upload or transmit any content that infringes on any intellectual property rights or violates the privacy rights of any third party.</li>
                                <li>Upload or transmit viruses, Trojan horses, or other material, including excessive use of capital letters and spamming (continuous posting of repetitive text), that interferes with any party's uninterrupted use and enjoyment of the Service.</li>
                            </ul>
                        </section>

                        <section>
                            <h2>5. Termination</h2>
                            <p>
                                We may terminate or suspend your account and bar access to the Service immediately, without prior notice or liability, under our sole discretion, for any reason whatsoever and without limitation, including but not limited to a breach of the Terms.
                            </p>
                        </section>

                        <section>
                            <h2>6. Disclaimer of Warranties</h2>
                            <p className="uppercase text-xs font-bold tracking-widest text-slate-500 mb-2">Please read carefully</p>
                            <p>
                                The Service is provided on an "AS IS" and "AS AVAILABLE" basis. DidYouQuit.com makes no representations or warranties of any kind, express or implied, as to the operation of the services, or the information, content, and materials included therein.
                                You expressly agree that your use of the Service is at your sole risk.
                            </p>
                        </section>

                        <section>
                            <h2>7. Limitation of Liability</h2>
                            <p>
                                In no event shall DidYouQuit.com, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages,
                                including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from (i) your access to or use of or inability to access or use the Service;
                                (ii) any conduct or content of any third party on the Service; or (iii) unauthorized access, use or alteration of your transmissions or content.
                            </p>
                        </section>

                        <section>
                            <h2>8. Governing Law</h2>
                            <p>
                                These Terms shall be governed and construed in accordance with the laws of the State of New Jersey, United States, without regard to its conflict of law provisions.
                                Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
                            </p>
                        </section>

                        <section>
                            <h2>9. Changes to Terms</h2>
                            <p>
                                We reserve the right, at our sole discretion, to modify or replace these Terms at any time. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
                            </p>
                        </section>

                        <div className="border-t border-slate-100 pt-8 mt-12">
                            <h3 className="mb-2">Contact Us</h3>
                            <p>If you have any questions about these Terms, please contact us at:</p>
                            <p className="font-medium text-emerald-700">contact@didyouquit.com</p>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
