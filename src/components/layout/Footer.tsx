import Link from "next/link";

export function Footer() {
    return (
        <footer className="bg-white py-12 border-t border-slate-100 text-center text-slate-400 text-sm">
            <div className="flex justify-center gap-6 mb-4">
                <Link href="/terms" className="hover:text-emerald-600 transition-colors">Terms of Service</Link>
                <Link href="/privacy" className="hover:text-emerald-600 transition-colors">Privacy Policy</Link>
            </div>
            <p>© 2026 DidYouQuit.com. All rights reserved. (v3.3.0)</p>
        </footer>
    );
}
