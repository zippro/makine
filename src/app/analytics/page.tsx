'use client';

import { useState, useEffect } from 'react';
import { useProject } from '@/context/ProjectContext';
import {
    Eye, Youtube, ThumbsUp, MessageSquare, Film, TrendingUp,
    Clock, BarChart3, Loader2, Trophy, Calendar, ExternalLink
} from 'lucide-react';

interface VideoStats {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    publishedAt: string;
    duration: string;
    viewCount: number;
    likeCount: number;
    commentCount: number;
}

interface AnalyticsData {
    channel: {
        title: string;
        description: string;
        thumbnail: string;
        customUrl: string;
        subscriberCount: number;
        totalViewCount: number;
        videoCount: number;
        createdAt: string;
    };
    stats: {
        totalViews: number;
        totalLikes: number;
        totalComments: number;
        videoCount: number;
    };
    videos: VideoStats[];
    topByViews: VideoStats[];
    topByLikes: VideoStats[];
    recentVideos: VideoStats[];
}

function formatDuration(iso: string): string {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return iso;
    const h = match[1] ? `${match[1]}h ` : '';
    const m = match[2] ? `${match[2]}m ` : '';
    const s = match[3] ? `${match[3]}s` : '';
    return `${h}${m}${s}`.trim() || '0s';
}

function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatNumber(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toLocaleString();
}

export default function AnalyticsPage() {
    const { currentProject } = useProject();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'overview' | 'videos' | 'top'>('overview');

    useEffect(() => {
        if (!currentProject) return;
        setLoading(true);
        setError(null);

        fetch(`/api/analytics?projectId=${currentProject.id}`)
            .then(r => {
                if (!r.ok) throw new Error('Failed to load analytics');
                return r.json();
            })
            .then(d => setData(d))
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [currentProject]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
                    <p className="text-muted">Loading YouTube analytics...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-3">
                    <BarChart3 className="w-8 h-8 text-muted mx-auto" />
                    <p className="text-muted">{error || 'No data available'}</p>
                    <p className="text-xs text-muted-foreground">Make sure YouTube is connected in Project Settings</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Channel Header */}
            <div className="flex items-center gap-5">
                {data.channel.thumbnail && (
                    <img
                        src={data.channel.thumbnail}
                        alt={data.channel.title}
                        className="w-16 h-16 rounded-full border-2 border-border"
                    />
                )}
                <div>
                    <h1 className="text-2xl font-bold">{data.channel.title}</h1>
                    <div className="flex items-center gap-3 mt-1">
                        {data.channel.customUrl && (
                            <a
                                href={`https://youtube.com/${data.channel.customUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-red-500 hover:text-red-400 flex items-center gap-1"
                            >
                                <Youtube className="w-3.5 h-3.5" />
                                {data.channel.customUrl}
                                <ExternalLink className="w-3 h-3" />
                            </a>
                        )}
                        <span className="text-xs text-muted">
                            Since {formatDate(data.channel.createdAt)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatCard icon={Eye} label="Total Views" value={formatNumber(data.channel.totalViewCount)} color="text-blue-400" bg="bg-blue-500/10" />
                <StatCard icon={Youtube} label="Subscribers" value={formatNumber(data.channel.subscriberCount)} color="text-red-500" bg="bg-red-500/10" />
                <StatCard icon={Film} label="Videos" value={data.channel.videoCount.toString()} color="text-green-400" bg="bg-green-500/10" />
                <StatCard icon={ThumbsUp} label="Total Likes" value={formatNumber(data.stats.totalLikes)} color="text-pink-400" bg="bg-pink-500/10" />
                <StatCard icon={MessageSquare} label="Comments" value={formatNumber(data.stats.totalComments)} color="text-purple-400" bg="bg-purple-500/10" />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
                <TabButton active={tab === 'overview'} onClick={() => setTab('overview')} icon={BarChart3} label="Overview" />
                <TabButton active={tab === 'videos'} onClick={() => setTab('videos')} icon={Film} label="All Videos" />
                <TabButton active={tab === 'top'} onClick={() => setTab('top')} icon={Trophy} label="Top Performers" />
            </div>

            {/* Tab Content */}
            {tab === 'overview' && (
                <div className="space-y-6">
                    {/* Recent Videos */}
                    <div>
                        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-400" />
                            Recent Videos (Last 30 Days)
                        </h2>
                        {data.recentVideos.length === 0 ? (
                            <p className="text-muted text-sm py-4">No videos published in the last 30 days</p>
                        ) : (
                            <div className="grid gap-3">
                                {data.recentVideos.map(v => (
                                    <VideoRow key={v.id} video={v} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* All Videos Summary */}
                    <div>
                        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-green-400" />
                            Channel Performance
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <MiniStat label="Avg Views/Video" value={data.videos.length > 0 ? formatNumber(Math.round(data.stats.totalViews / data.videos.length)) : '0'} />
                            <MiniStat label="Avg Likes/Video" value={data.videos.length > 0 ? formatNumber(Math.round(data.stats.totalLikes / data.videos.length)) : '0'} />
                            <MiniStat label="Engagement Rate" value={data.stats.totalViews > 0 ? `${((data.stats.totalLikes / data.stats.totalViews) * 100).toFixed(1)}%` : '0%'} />
                            <MiniStat label="Avg Comments" value={data.videos.length > 0 ? formatNumber(Math.round(data.stats.totalComments / data.videos.length)) : '0'} />
                        </div>
                    </div>
                </div>
            )}

            {tab === 'videos' && (
                <div className="space-y-3">
                    <p className="text-sm text-muted">{data.videos.length} videos total</p>
                    {data.videos.map(v => (
                        <VideoRow key={v.id} video={v} showDetails />
                    ))}
                </div>
            )}

            {tab === 'top' && (
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Top by Views */}
                    <div>
                        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <Eye className="w-5 h-5 text-blue-400" />
                            Top by Views
                        </h2>
                        <div className="space-y-2">
                            {data.topByViews.map((v, i) => (
                                <div key={v.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                                    <span className={`text-sm font-bold w-6 text-center ${i < 3 ? 'text-yellow-500' : 'text-muted'}`}>
                                        #{i + 1}
                                    </span>
                                    {v.thumbnail && (
                                        <img src={v.thumbnail} alt="" className="w-16 h-9 rounded object-cover" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{v.title}</p>
                                        <p className="text-xs text-muted">{formatNumber(v.viewCount)} views</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top by Likes */}
                    <div>
                        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                            <ThumbsUp className="w-5 h-5 text-pink-400" />
                            Top by Likes
                        </h2>
                        <div className="space-y-2">
                            {data.topByLikes.map((v, i) => (
                                <div key={v.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                                    <span className={`text-sm font-bold w-6 text-center ${i < 3 ? 'text-yellow-500' : 'text-muted'}`}>
                                        #{i + 1}
                                    </span>
                                    {v.thumbnail && (
                                        <img src={v.thumbnail} alt="" className="w-16 h-9 rounded object-cover" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{v.title}</p>
                                        <p className="text-xs text-muted">{formatNumber(v.likeCount)} likes</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Components ──────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, bg }: {
    icon: any; label: string; value: string; color: string; bg: string;
}) {
    return (
        <div className="bg-card border border-border rounded-xl p-4">
            <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-muted">{label}</p>
        </div>
    );
}

function TabButton({ active, onClick, icon: Icon, label }: {
    active: boolean; onClick: () => void; icon: any; label: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${active
                ? 'bg-primary/10 text-primary'
                : 'text-muted hover:text-foreground hover:bg-card-hover'
                }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );
}

function VideoRow({ video, showDetails }: { video: VideoStats; showDetails?: boolean }) {
    return (
        <a
            href={`https://youtu.be/${video.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 bg-card border border-border rounded-xl p-3 hover:border-primary/30 transition-colors group"
        >
            {video.thumbnail && (
                <img src={video.thumbnail} alt="" className="w-28 h-16 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{video.title}</p>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-muted flex-wrap">
                    <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(video.publishedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(video.duration)}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-5 flex-shrink-0">
                <div className="text-right">
                    <p className="text-sm font-semibold">{formatNumber(video.viewCount)}</p>
                    <p className="text-[10px] text-muted">views</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-semibold text-pink-400">{formatNumber(video.likeCount)}</p>
                    <p className="text-[10px] text-muted">likes</p>
                </div>
                {showDetails && (
                    <div className="text-right">
                        <p className="text-sm font-semibold text-purple-400">{formatNumber(video.commentCount)}</p>
                        <p className="text-[10px] text-muted">comments</p>
                    </div>
                )}
                <ExternalLink className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
            </div>
        </a>
    );
}

function MiniStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-lg font-bold">{value}</p>
            <p className="text-xs text-muted">{label}</p>
        </div>
    );
}
