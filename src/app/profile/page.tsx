'use client';

import { useEffect, useState, useCallback } from 'react';
import { User, AtSign, Loader2, Check, Edit2, X, ListChecks, AlertCircle } from 'lucide-react';

interface TodoItem {
    id: string;
    title: string;
    description: string | null;
    completed: boolean;
    priority: 'low' | 'medium' | 'high';
    todo_lists: {
        id: string;
        name: string;
        project_id: string;
        projects: {
            id: string;
            name: string;
        };
    };
}

interface UserProfile {
    id: string;
    user_id: string;
    email: string;
    nickname: string | null;
}

const priorityColors = {
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    high: 'bg-red-500/20 text-red-400 border-red-500/30'
};

export default function ProfilePage() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [mentions, setMentions] = useState<TodoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditingNickname, setIsEditingNickname] = useState(false);
    const [nicknameInput, setNicknameInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

    const fetchProfile = useCallback(async () => {
        try {
            const res = await fetch('/api/profile');
            if (res.ok) {
                const data = await res.json();
                setProfile(data);
                setNicknameInput(data.nickname || '');
            }
        } catch (err) {
            console.error('Failed to fetch profile:', err);
        }
    }, []);

    const fetchMentions = useCallback(async () => {
        try {
            const res = await fetch('/api/profile/mentions');
            if (res.ok) {
                const data = await res.json();
                setMentions(data.items || []);
            }
        } catch (err) {
            console.error('Failed to fetch mentions:', err);
        }
    }, []);

    useEffect(() => {
        Promise.all([fetchProfile(), fetchMentions()]).finally(() => setLoading(false));
    }, [fetchProfile, fetchMentions]);

    const saveNickname = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname: nicknameInput.trim() || null })
            });

            if (res.ok) {
                const data = await res.json();
                setProfile(data);
                setIsEditingNickname(false);
                // Refresh mentions with new nickname
                fetchMentions();
            } else {
                const errData = await res.json();
                setError(errData.error || 'Failed to save');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setSaving(false);
        }
    };

    const toggleItemComplete = async (item: TodoItem) => {
        setUpdatingItemId(item.id);
        try {
            const res = await fetch('/api/profile/mentions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_id: item.id, completed: !item.completed })
            });

            if (res.ok) {
                setMentions(prev => prev.map(m =>
                    m.id === item.id ? { ...m, completed: !m.completed } : m
                ));
            }
        } catch (err) {
            console.error('Failed to update item:', err);
        } finally {
            setUpdatingItemId(null);
        }
    };

    // Highlight @mentions in text
    const highlightMentions = (text: string) => {
        if (!text) return '';
        const parts = text.split(/(@\w+)/g);
        return parts.map((part, i) =>
            part.startsWith('@')
                ? <span key={i} className="text-primary font-medium">{part}</span>
                : part
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const pendingMentions = mentions.filter(m => !m.completed);
    const completedMentions = mentions.filter(m => m.completed);

    return (
        <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
                    <User className="w-8 h-8" />
                    Profile
                </h1>
                <p className="text-muted mt-1">Manage your profile and see your assigned tasks</p>
            </div>

            {/* Profile Card */}
            <div className="bg-card border border-border rounded-xl p-6 mb-8">
                <div className="flex items-start gap-6">
                    {/* Avatar */}
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        {profile?.nickname === 'sincap' ? (
                            <span className="text-5xl">🐿️</span>
                        ) : profile?.nickname === 'mirket' ? (
                            <span className="text-5xl">🦦</span>
                        ) : (
                            <span className="text-3xl font-bold text-primary">
                                {profile?.email?.charAt(0).toUpperCase() || '?'}
                            </span>
                        )}
                    </div>

                    <div className="flex-1">
                        {/* Email */}
                        <p className="text-muted text-sm">Email</p>
                        <p className="text-lg font-medium mb-4">{profile?.email}</p>

                        {/* Nickname */}
                        <p className="text-muted text-sm mb-1 flex items-center gap-1">
                            <AtSign className="w-3 h-3" /> Nickname
                        </p>

                        {isEditingNickname ? (
                            <div className="flex items-center gap-2">
                                <span className="text-primary text-lg">@</span>
                                <input
                                    type="text"
                                    value={nicknameInput}
                                    onChange={(e) => setNicknameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                    placeholder="your_nickname"
                                    className="bg-background border border-primary rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    autoFocus
                                />
                                <button
                                    onClick={saveNickname}
                                    disabled={saving}
                                    className="p-2 bg-primary text-black rounded-lg hover:bg-primary-hover disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsEditingNickname(false);
                                        setNicknameInput(profile?.nickname || '');
                                        setError(null);
                                    }}
                                    className="p-2 hover:bg-card rounded-lg"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                {profile?.nickname ? (
                                    <span className="text-lg font-medium text-primary">@{profile.nickname}</span>
                                ) : (
                                    <span className="text-muted italic">Not set</span>
                                )}
                                <button
                                    onClick={() => setIsEditingNickname(true)}
                                    className="p-1.5 hover:bg-primary/10 rounded-lg text-muted hover:text-primary transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="mt-2 text-sm text-red-400 flex items-center gap-1">
                                <AlertCircle className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mentioned Tasks */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-primary" />
                    <h2 className="font-semibold text-lg">Your Assigned Tasks</h2>
                    {mentions.length > 0 && (
                        <span className="ml-auto text-sm text-muted">
                            {pendingMentions.length} pending, {completedMentions.length} done
                        </span>
                    )}
                </div>

                {!profile?.nickname ? (
                    <div className="p-8 text-center text-muted">
                        <AtSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Set a nickname to see tasks assigned to you</p>
                        <p className="text-sm mt-1">Tasks mentioning @{'{'}your_nickname{'}'} will appear here</p>
                    </div>
                ) : mentions.length === 0 ? (
                    <div className="p-8 text-center text-muted">
                        <ListChecks className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No tasks mentioning @{profile.nickname}</p>
                        <p className="text-sm mt-1">When someone adds @{profile.nickname} to a task, it will appear here</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {/* Pending Tasks */}
                        {pendingMentions.map(item => (
                            <div
                                key={item.id}
                                className="p-4 hover:bg-card-hover transition-colors flex items-start gap-3"
                            >
                                <button
                                    onClick={() => toggleItemComplete(item)}
                                    disabled={updatingItemId === item.id}
                                    className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                                        ${item.completed
                                            ? 'bg-primary border-primary'
                                            : 'border-border hover:border-primary/50'
                                        } disabled:opacity-50`}
                                >
                                    {updatingItemId === item.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : item.completed && (
                                        <Check className="w-3 h-3 text-black" />
                                    )}
                                </button>

                                <div className="flex-1 min-w-0">
                                    <p className={item.completed ? 'line-through text-muted' : ''}>
                                        {highlightMentions(item.title)}
                                    </p>
                                    {item.description && (
                                        <p className="text-sm text-muted mt-1">
                                            {highlightMentions(item.description)}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2 text-xs text-muted">
                                        <span>{item.todo_lists?.projects?.name}</span>
                                        <span>•</span>
                                        <span>{item.todo_lists?.name}</span>
                                    </div>
                                </div>

                                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${priorityColors[item.priority]}`}>
                                    {item.priority}
                                </span>
                            </div>
                        ))}

                        {/* Completed Tasks */}
                        {completedMentions.length > 0 && (
                            <>
                                <div className="px-4 py-2 bg-background/50 text-sm text-muted">
                                    Completed ({completedMentions.length})
                                </div>
                                {completedMentions.map(item => (
                                    <div
                                        key={item.id}
                                        className="p-4 hover:bg-card-hover transition-colors flex items-start gap-3 opacity-60"
                                    >
                                        <button
                                            onClick={() => toggleItemComplete(item)}
                                            disabled={updatingItemId === item.id}
                                            className="mt-1 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 bg-primary border-primary disabled:opacity-50"
                                        >
                                            {updatingItemId === item.id ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <Check className="w-3 h-3 text-black" />
                                            )}
                                        </button>

                                        <div className="flex-1 min-w-0">
                                            <p className="line-through text-muted">
                                                {highlightMentions(item.title)}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                                                <span>{item.todo_lists?.projects?.name}</span>
                                                <span>•</span>
                                                <span>{item.todo_lists?.name}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
