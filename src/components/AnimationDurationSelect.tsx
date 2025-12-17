"use client";

interface AnimationDurationSelectProps {
    value: 5 | 10;
    onChange: (value: 5 | 10) => void;
}

export default function AnimationDurationSelect({ value, onChange }: AnimationDurationSelectProps) {
    return (
        <div className="mb-6 p-4 rounded-xl bg-card border border-border">
            <label className="text-sm font-medium text-foreground mb-3 block">Animation Duration</label>
            <div className="flex gap-3">
                <button
                    onClick={() => onChange(5)}
                    className={`px-6 py-3 rounded-lg font-medium transition-all ${value === 5
                        ? 'bg-primary text-white'
                        : 'bg-card border border-border text-muted hover:border-primary'
                        }`}
                >
                    5 seconds
                </button>
                <button
                    onClick={() => onChange(10)}
                    className={`px-6 py-3 rounded-lg font-medium transition-all ${value === 10
                        ? 'bg-primary text-white'
                        : 'bg-card border border-border text-muted hover:border-primary'
                        }`}
                >
                    10 seconds
                </button>
            </div>
        </div>
    );
}
