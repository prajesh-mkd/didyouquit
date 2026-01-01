import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-[#F0FDF4] font-sans text-slate-800 flex flex-col">
            <Header />
            <main className="container mx-auto px-6 py-12 flex-grow">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-extrabold text-emerald-900 tracking-tight mb-4">Privacy Policy</h1>
                        <p className="text-emerald-700/80 font-medium">Last Updated: January 1, 2026</p>
                    </div>

                    <div className="bg-white p-8 md:p-12 rounded-2xl shadow-sm border border-slate-100 prose prose-lg prose-emerald max-w-none prose-headings:font-extrabold prose-headings:tracking-tight prose-h2:text-3xl prose-h2:text-emerald-950 prose-h2:border-b prose-h2:border-slate-100 prose-h2:pb-4 prose-h2:mt-12 prose-h2:mb-6 prose-h3:text-xl prose-h3:text-emerald-800 prose-p:text-slate-600 prose-li:text-slate-600">
                        <section>
                            <h2>1. Introduction</h2>
                            <p>
                                Welcome to <strong>DidYouQuit.com</strong> ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy.
                                This Privacy Policy explains what information we collect, how we use it, and your rights in relation to it.
                            </p>
                            <p>
                                By accessing or using our Service, you agree to the collection and use of information in accordance with this policy.
                            </p>
                        </section>

                        <section>
                            <h2>2. Information We Collect</h2>
                            <p>We collect only the information necessary to provide our resolution tracking service.</p>

                            <h3>2.1 Personal Data provided by you</h3>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong>Authentication Data:</strong> When you sign up via Google or Email, we collect your email address and, where available, your profile name and avatar URL.</li>
                                <li><strong>User Generated Content:</strong> We collect the Resolutions, Titles, and Weekly Progress Logs you create.</li>
                                <li><strong>Public Profile Data:</strong> If you choose to make your resolutions "Public," your username, country (if provided), and resolution progress become visible to other users.</li>
                            </ul>

                            <h3>2.2 Automatically Collected Data</h3>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong>Log Data:</strong> Like most websites, our hosting provider (Google Firebase) collects standard log files including IP addresses, browser type, and timestamps to ensure security and prevent abuse.</li>
                            </ul>
                        </section>

                        <section className="bg-emerald-50 p-6 rounded-lg border border-emerald-100 not-prose my-8">
                            <h3 className="text-emerald-900 font-bold text-lg mb-2">No Tracking or Analytics</h3>
                            <p className="text-emerald-800 text-sm leading-relaxed">
                                DidYouQuit.com does not utilize Google Analytics, Facebook Pixels, Mixpanel, or any third-party marketing trackers.
                                We do not sell your personal data to advertisers or data brokers.
                            </p>
                        </section>

                        <section>
                            <h2>3. How We Use Your Information</h2>
                            <p>We process your data for the following specific purposes:</p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong>To Provide the Service:</strong> Enabling you to create, edit, and track your New Year's resolutions.</li>
                                <li><strong>Authentication:</strong> verifying your identity and securing your account.</li>
                                <li><strong>Social Features:</strong> Displaying your "Public Resolutions" on the community feed (only with your explicit action).</li>
                                <li><strong>Security:</strong> Monitoring for fraudulent activity or abuse of our Terms of Service.</li>
                            </ul>
                        </section>

                        <section>
                            <h2>4. Data Processors & Third Parties</h2>
                            <p>We generally do not share your data with third parties. However, we use trusted infrastructure providers to run our Service:</p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li>
                                    <strong>Google Firebase (United States):</strong> Used for Database (Firestore), Authentication, and Hosting. Google acts as a Data Processor.
                                    Auth data is processed in the U.S. under standard contractual clauses.
                                </li>
                            </ul>
                        </section>

                        <section>
                            <h2>5. Data Retention</h2>
                            <p>
                                We retain your personal information only for as long as is necessary for the purposes set out in this Privacy Policy.
                                You may delete your account at any time via the Dashboard, which will permanently erase your personal data from our active databases immediately.
                            </p>
                        </section>

                        <section>
                            <h2>6. Your Data Protection Rights (GDPR & CCPA)</h2>
                            <p>Depending on your location, you have certain rights regarding your personal information:</p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong>The Right to Access:</strong> You can request copies of your personal data.</li>
                                <li><strong>The Right to Rectification:</strong> You can request that we correct any information you believe is inaccurate.</li>
                                <li><strong>The Right to Erasure:</strong> You can request that we erase your personal data (available via "Delete Account" in Dashboard).</li>
                                <li><strong>The Right to Restrict Processing:</strong> You have the right to request that we restrict the processing of your personal data.</li>
                                <li><strong>The Right to Data Portability:</strong> You have the right to request that we transfer the data that we have collected to another organization, or directly to you.</li>
                            </ul>
                            <p>
                                To exercise these rights, please contact us. We will respond to your request within 30 days.
                            </p>
                        </section>

                        <section>
                            <h2>7. Children's Privacy</h2>
                            <p>
                                Our Service is not intended for use by children under the age of 13. We do not knowingly collect personally identifiable information from children under 13.
                                If you become aware that a child has provided us with Personal Data, please contact us. Use of the service is restricted to those 13 years of age or older.
                            </p>
                        </section>

                        <section>
                            <h2>8. Changes to This Privacy Policy</h2>
                            <p>
                                We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
                                You are advised to review this Privacy Policy periodically for any changes.
                            </p>
                        </section>

                        <div className="border-t border-slate-100 pt-8 mt-12">
                            <h3 className="mb-2">Contact Us</h3>
                            <p>If you have any questions about this Privacy Policy, please contact us at:</p>
                            <p className="font-medium text-emerald-700">contact@didyouquit.com</p>
                        </div>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
