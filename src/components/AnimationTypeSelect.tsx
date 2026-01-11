'use client';

import { Project } from '@/lib/types';
import { useProject } from '@/context/ProjectContext';
import { Type } from 'lucide-react';

interface AnimationTypeSelectProps {
    value: string;
    onChange: (value: string) => void;
}

export default function AnimationTypeSelect({ value, onChange }: AnimationTypeSelectProps) {
    const { currentProject } = useProject();

    // Default fallback if no custom prompts exist
    const defaultPrompts = [
        {
            id: 'loop',
            name: 'Seamless Loop',
            prompt: "Look at this image. Write a single prompt for Kling AI to generate a SEAMLESS LOOP animation based on this image."
        }
    ];

    const animationTypes = (currentProject?.animation_prompts && currentProject.animation_prompts.length > 0)
        ? currentProject.animation_prompts
        : defaultPrompts;

    return (
        <div className="flex flex-col items-center gap-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-primary" />
                Animation Type
            </label>
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full p-1 border border-white/10">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="bg-transparent text-sm font-medium focus:outline-none px-3 py-1 cursor-pointer min-w-[140px] text-center"
                >
                    {animationTypes.map((type) => (
                        <option key={type.id} value={type.id} className="bg-background text-foreground">
                            {type.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
