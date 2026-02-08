'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Loader2, Bot, Video, RefreshCw, AlertCircle } from 'lucide-react';

interface AISettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface AISettings {
    id: string;
    vlm_provider: string;
    vlm_model: string;
    vlm_api_url: string;
    video_provider: string;
    video_model: string;
    video_api_url: string;
    video_status_url: string;
    default_duration: number;
    poll_interval_ms: number;
    max_poll_attempts: number;
    animation_system_prompt: string;
    animation_user_prompt: string;
}

export default function AISettingsModal({ isOpen, onClose }: AISettingsModalProps) {
    const [settings, setSettings] = useState<AISettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'vlm' | 'video' | 'prompts'>('vlm');
    const [mounted, setMounted] = useState(false);

    // Handle client-side mounting for portal
    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch settings when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchSettings();
        }
    }, [isOpen]);

    const fetchSettings = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/settings/ai');
            if (!res.ok) throw new Error('Failed to fetch settings');
            const data = await res.json();
            setSettings(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;

        setIsSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const res = await fetch('/api/settings/ai', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            if (!res.ok) throw new Error('Failed to save settings');

            const data = await res.json();
            setSettings(data);
            setSuccess('Settings saved successfully!');
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    const updateField = (field: keyof AISettings, value: string | number) => {
        if (!settings) return;
        setSettings({ ...settings, [field]: value });
    };

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-white/10 w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">AI Settings</h2>
                            <p className="text-sm text-white/60">Configure models, APIs, and prompts</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-white/60" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-6 py-3 border-b border-white/10 bg-black/20">
                    {[
                        { id: 'vlm' as const, icon: Bot, label: 'VLM Model' },
                        { id: 'video' as const, icon: Video, label: 'Video Generation' },
                        { id: 'prompts' as const, icon: RefreshCw, label: 'Prompts' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === tab.id
                                ? 'bg-white/10 text-white'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                        </div>
                    ) : settings ? (
                        <div className="space-y-6">
                            {/* VLM Tab */}
                            {activeTab === 'vlm' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-white/80 mb-2">Provider</label>
                                            <select
                                                value={settings.vlm_provider}
                                                onChange={(e) => updateField('vlm_provider', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="openai">OpenAI</option>
                                                <option value="anthropic">Anthropic</option>
                                                <option value="google">Google AI</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-white/80 mb-2">Model</label>
                                            <input
                                                type="text"
                                                value={settings.vlm_model}
                                                onChange={(e) => updateField('vlm_model', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                placeholder="gpt-4o"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-white/80 mb-2">API URL</label>
                                        <input
                                            type="text"
                                            value={settings.vlm_api_url}
                                            onChange={(e) => updateField('vlm_api_url', e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                                            placeholder="https://api.openai.com/v1/chat/completions"
                                        />
                                    </div>
                                    <p className="text-sm text-white/50 flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        API keys are stored in environment variables for security. Update them in your .env.local file.
                                    </p>
                                </div>
                            )}

                            {/* Video Tab */}
                            {activeTab === 'video' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-white/80 mb-2">Provider</label>
                                            <select
                                                value={settings.video_provider}
                                                onChange={(e) => updateField('video_provider', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            >
                                                <option value="fal-kling">Fal.ai (Kling)</option>
                                                <option value="fal-minimax">Fal.ai (MiniMax)</option>
                                                <option value="runway">Runway</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-white/80 mb-2">Model</label>
                                            <input
                                                type="text"
                                                value={settings.video_model}
                                                onChange={(e) => updateField('video_model', e.target.value)}
                                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                placeholder="kling-video-o1"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-white/80 mb-2">Video API URL</label>
                                        <input
                                            type="text"
                                            value={settings.video_api_url}
                                            onChange={(e) => updateField('video_api_url', e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-white/80 mb-2">Status URL</label>
                                        <input
                                            type="text"
                                            value={settings.video_status_url}
                                            onChange={(e) => updateField('video_status_url', e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-white/80 mb-2">Default Duration (s)</label>
                                            <input
                                                type="number"
                                                value={settings.default_duration}
                                                onChange={(e) => updateField('default_duration', parseInt(e.target.value) || 10)}
                                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-white/80 mb-2">Poll Interval (ms)</label>
                                            <input
                                                type="number"
                                                value={settings.poll_interval_ms}
                                                onChange={(e) => updateField('poll_interval_ms', parseInt(e.target.value) || 15000)}
                                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-white/80 mb-2">Max Poll Attempts</label>
                                            <input
                                                type="number"
                                                value={settings.max_poll_attempts}
                                                onChange={(e) => updateField('max_poll_attempts', parseInt(e.target.value) || 40)}
                                                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Prompts Tab */}
                            {activeTab === 'prompts' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-white/80 mb-2">System Prompt</label>
                                        <textarea
                                            value={settings.animation_system_prompt}
                                            onChange={(e) => updateField('animation_system_prompt', e.target.value)}
                                            rows={3}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none font-mono text-sm"
                                            placeholder="System prompt for the VLM..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-white/80 mb-2">
                                            User Prompt Template
                                            <span className="text-white/50 font-normal ml-2">Use {'{user_prompt}'} as placeholder</span>
                                        </label>
                                        <textarea
                                            value={settings.animation_user_prompt}
                                            onChange={(e) => updateField('animation_user_prompt', e.target.value)}
                                            rows={12}
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none font-mono text-sm"
                                            placeholder="User prompt template..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-white/60">
                            Failed to load settings
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
                    <div>
                        {error && (
                            <p className="text-red-400 text-sm flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </p>
                        )}
                        {success && (
                            <p className="text-green-400 text-sm">{success}</p>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-white/60 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !settings}
                            className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
