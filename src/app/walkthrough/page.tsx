'use client';

import Link from 'next/link';
import {
    Music,
    Image as ImageIcon,
    Wand2,
    CheckCircle,
    Layers,
    Youtube,
    ArrowRight,
    Repeat
} from 'lucide-react';

export default function WalkthroughPage() {
    return (
        <div className="min-h-screen py-10 px-4">
            <div className="max-w-4xl mx-auto space-y-12">

                {/* Header */}
                <div className="text-center space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                        How to Create a Masterpiece
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        Your step-by-step guide to generating aesthetic music videos.
                    </p>
                </div>

                {/* Steps Container */}
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">

                    {/* Step 1 */}
                    <StepCard
                        icon={<Music className="w-8 h-8 text-blue-400" />}
                        title="1. Select Music"
                        description="Find at least 10-20 music tracks. Aim for a total duration of 30-60 minutes."
                        bg="bg-blue-500/10"
                        border="border-blue-500/20"
                    />

                    {/* Step 2 */}
                    <StepCard
                        icon={<ImageIcon className="w-8 h-8 text-emerald-400" />}
                        title="2. Collect Images"
                        description="Find at least 10-20 high-quality aesthetic images to serve as the base for your animations."
                        bg="bg-emerald-500/10"
                        border="border-emerald-500/20"
                    />

                    {/* Step 3 */}
                    <StepCard
                        icon={<Wand2 className="w-8 h-8 text-purple-400" />}
                        title="3. Generate Animations"
                        description="Upload images to generate animations. Each takes ~2 minutes. 20 images = ~40 mins."
                        bg="bg-purple-500/10"
                        border="border-purple-500/20"
                    >
                        <div className="mt-4 flex items-center gap-2 text-xs text-purple-300 bg-purple-500/20 p-2 rounded">
                            <Repeat className="w-3 h-3" />
                            <span>While preparing, loop back to Step 1.</span>
                        </div>
                    </StepCard>

                    {/* Step 4 */}
                    <StepCard
                        icon={<CheckCircle className="w-8 h-8 text-amber-400" />}
                        title="4. Approve Content"
                        description="Review your generated animations. Select and approve the most successful ones for the final video."
                        bg="bg-amber-500/10"
                        border="border-amber-500/20"
                    />

                    {/* Step 5 */}
                    <StepCard
                        icon={<Layers className="w-8 h-8 text-pink-400" />}
                        title="5. Assemble Video"
                        description="Combine music and animations. A 30-minute video takes about 40 minutes to process."
                        bg="bg-pink-500/10"
                        border="border-pink-500/20"
                    >
                        <div className="mt-4 flex items-center gap-2 text-xs text-pink-300 bg-pink-500/20 p-2 rounded">
                            <Repeat className="w-3 h-3" />
                            <span>While processing, start your next batch.</span>
                        </div>
                    </StepCard>

                    {/* Step 6 */}
                    <StepCard
                        icon={<Youtube className="w-8 h-8 text-red-500" />}
                        title="6. Publish"
                        description="Your video is ready! Download it and publish to YouTube to share with the world."
                        bg="bg-red-500/10"
                        border="border-red-500/20"
                    />

                </div>

                {/* Action Button */}
                <div className="flex justify-center pt-8">
                    <Link
                        href="/"
                        className="group flex items-center gap-2 px-8 py-4 bg-primary text-black rounded-full font-bold text-lg hover:bg-primary-hover hover:scale-105 transition-all shadow-lg shadow-primary/25"
                    >
                        Start Creating
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </div>
    );
}

function StepCard({ icon, title, description, bg, border, children }: { icon: React.ReactNode, title: string, description: string, bg: string, border: string, children?: React.ReactNode }) {
    return (
        <div className={`p-6 rounded-2xl ${bg} border ${border} hover:bg-opacity-20 transition-all backdrop-blur-sm`}>
            <div className="mb-4 p-3 bg-background/50 rounded-xl w-fit">
                {icon}
            </div>
            <h3 className="text-xl font-bold mb-2">{title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
                {description}
            </p>
            {children}
        </div>
    );
}
