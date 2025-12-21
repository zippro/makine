import Link from 'next/link';
import { HelpCircle } from 'lucide-react';

export function Footer() {
    return (
        <footer className="w-full border-t border-border mt-auto bg-background/50 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                    &copy; {new Date().getFullYear()} Makine. All rights reserved.
                </p>

                <Link
                    href="/walkthrough"
                    className="flex items-center gap-2 text-sm text-primary hover:text-primary-hover transition-colors px-4 py-2 rounded-lg hover:bg-primary/10"
                >
                    <HelpCircle className="w-4 h-4" />
                    How it Works
                </Link>
            </div>
        </footer>
    );
}
