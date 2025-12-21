import Link from 'next/link';
import {
    Music,
    Image as ImageIcon,
    Settings,
    Cpu,
    Youtube,
    Sparkles,
    ArrowRight,
    Layers,
    Wand2,
    Share2,
    Zap
} from 'lucide-react';

export default function ProductionPhasesPage() {
    return (
        <div className="min-h-screen bg-[#050505] text-white selection:bg-purple-500/30">
            {/* Background Gradients */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] mix-blend-screen" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-6 py-24">
                {/* Hero Section */}
                <header className="text-center mb-32 space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-sm font-medium text-purple-300 mb-4">
                        <Sparkles className="w-4 h-4" />
                        <span>The Makine Workflow</span>
                    </div>
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-100 to-gray-400 pb-2">
                        Production Phases
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">
                        A seamless journey from raw assets to viral content.
                        Experience the power of automated video production.
                    </p>
                </header>

                {/* Timeline Section */}
                <div className="relative space-y-24">
                    {/* Connecting Line */}
                    <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-purple-500/50 to-transparent hidden md:block" />

                    {/* Phase 1: Ingestion */}
                    <Phase
                        number="01"
                        title="Asset Ingestion"
                        description="The foundation of your masterpiece. Import high-quality audio tracks and visual assets into the secure cloud library."
                        icon={Music}
                        tags={['Lossless Audio', '4K Images', 'Cloud Storage']}
                        color="blue"
                        align="left"
                    />

                    {/* Phase 2: Configuration */}
                    <Phase
                        number="02"
                        title="Smart Configuration"
                        description="Define the soul of your video. Set loop counts, apply visual overlays, and configure dynamic visualizers tailored to your beat."
                        icon={Settings}
                        tags={['Loop Logic', 'Overlays', 'Fonts']}
                        color="purple"
                        align="right"
                    />

                    {/* Phase 3: Generation */}
                    <Phase
                        number="03"
                        title="AI Generation Engine"
                        description="Our dedicated render farm brings your vision to life. Generating smooth 60fps animations synchronized perfectly with your audio."
                        icon={Cpu}
                        tags={['FFmpeg', 'GPU Acceleration', 'Auto-Scaling']}
                        color="pink"
                        align="left"
                    />

                    {/* Phase 4: Metadata */}
                    <Phase
                        number="04"
                        title="Intelligent Metadata"
                        description="Leverage VLM (Vision Language Models) to analyze your content and generate click-worthy titles, descriptions, and tags."
                        icon={Wand2}
                        tags={['GPT-4o', 'SEO Optimized', 'Context Aware']}
                        color="orange"
                        align="right"
                    />

                    {/* Phase 5: Distribution */}
                    <Phase
                        number="05"
                        title="Global Distribution"
                        description="Publish directly to YouTube with a single click. Schedule your premieres and manage your channel growth from one dashboard."
                        icon={Youtube}
                        tags={['YouTube API', 'Scheduling', 'Analytics']}
                        color="red"
                        align="center"
                    />
                </div>

                {/* CTA */}
                <div className="mt-32 text-center">
                    <Link
                        href="/"
                        className="group inline-flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:bg-gray-200 transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
                    >
                        Start Creating <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </div>
        </div>
    );
}

function Phase({ number, title, description, icon: Icon, tags, color, align }: any) {
    const isCenter = align === 'center';
    const isRight = align === 'right';

    // Color variants
    const colors: any = {
        blue: 'from-blue-500 to-cyan-400',
        purple: 'from-purple-500 to-pink-400',
        pink: 'from-pink-500 to-rose-400',
        orange: 'from-orange-500 to-yellow-400',
        red: 'from-red-500 to-orange-500',
    };
    const gradient = colors[color] || colors.purple;

    return (
        <div className={`relative flex flex-col md:flex-row items-center gap-8 ${isCenter ? 'justify-center' : ''}`}>

            {/* Card Content */}
            <div className={`flex-1 w-full ${isRight ? 'md:order-1 md:text-right' : 'md:text-left'} ${isCenter ? 'text-center max-w-2xl' : ''}`}>
                <div className={`relative group p-8 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-xl hover:bg-white/[0.05] transition-all hover:border-white/10 overflow-hidden`}>

                    {/* Hover Gradient Glow */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-xl`} />

                    <div className="relative z-10">
                        <div className={`inline-flex items-center justify-center p-3 rounded-xl bg-white/5 text-white mb-6 border border-white/10`}>
                            <Icon className="w-6 h-6" />
                        </div>

                        <h3 className="text-3xl font-bold mb-3 text-white">{title}</h3>
                        <p className="text-gray-400 leading-relaxed mb-6">{description}</p>

                        <div className={`flex flex-wrap gap-2 ${isRight ? 'justify-end' : isCenter ? 'justify-center' : 'justify-start'}`}>
                            {tags.map((tag: string) => (
                                <span key={tag} className="px-3 py-1 text-xs font-semibold tracking-wide uppercase bg-white/5 text-gray-300 rounded-full border border-white/5">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Timeline Node (Center Dot) - Hidden on mobile, hidden for center layout */}
            {!isCenter && (
                <div className={`hidden md:flex absolute left-1/2 -ml-3 items-center justify-center w-6 h-6 rounded-full bg-[#050505] border-2 border-white/20 z-10`}>
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${gradient}`} />
                </div>
            )}

            {/* Empty Space for Grid Balance */}
            {!isCenter && <div className={`flex-1 hidden md:block ${isRight ? 'md:order-0' : ''}`} />}

        </div>
    );
}
