import { History } from 'lucide-react';
import { JobHistory } from '@/components/JobHistory';

export const metadata = {
    title: 'Video History - Makine',
    description: 'View your generated music videos',
};

export default function HistoryPage() {
    return (
        <div className="min-h-screen">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <History className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Video History</h1>
                        <p className="text-sm text-muted">All your generated music videos</p>
                    </div>
                </div>

                <JobHistory />
            </div>
        </div>
    );
}
