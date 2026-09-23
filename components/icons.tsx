import React from 'react';
import type { Perk, StoryGenreId } from '../types';

export const PerkTypeIcon: React.FC<{ type: Perk['type'] }> = ({ type }) => {
    const iconClass = 'h-5 w-5';

    if (type === 'defense') {
        return (
            <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3 20 6v5c0 5.2-3.4 8.5-8 10-4.6-1.5-8-4.8-8-10V6l8-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="m9 12 2 2 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }

    if (type === 'stealth') {
        return (
            <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 3 21 21M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.7 10.7 0 0 1 12 4c5.2 0 8.5 4.5 9.5 6.2a3.5 3.5 0 0 1 0 3.6 14.4 14.4 0 0 1-2.2 2.8M6.2 6.2a14.4 14.4 0 0 0-3.7 4 3.5 3.5 0 0 0 0 3.6C3.5 15.5 6.8 20 12 20c1 0 1.9-.2 2.7-.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }

    if (type === 'utility') {
        return (
            <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="5" y="7" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="2" />
                <path d="M9 3v4m6-4v4M9 17v4m6-4v4M2 10h3m-3 4h3m14-4h3m-3 4h3m-8-4-3 4h4l-3 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }

    return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

export const GenreIcon: React.FC<{ genre: StoryGenreId; className?: string }> = ({ genre, className = 'h-5 w-5' }) => {
    if (genre === 'space_horror') {
        return (
            <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 16.5a9 9 0 0 1 14 0M8 13a5 5 0 0 1 8 0M11 9.5a1.5 1.5 0 1 1 2 0M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }

    if (genre === 'noir') {
        return (
            <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="2" />
                <path d="m15 15 5 5M8.5 8.5h4M10.5 6.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
        );
    }

    if (genre === 'dark_fable') {
        return (
            <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v17H8.5A3.5 3.5 0 0 0 5 22V5.5ZM19 5.5A3.5 3.5 0 0 0 15.5 2H12v17h3.5A3.5 3.5 0 0 1 19 22V5.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 6h1m6 0h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
        );
    }

    if (genre === 'dead_channel') {
        return (
            <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="6" width="18" height="13" rx="1.5" stroke="currentColor" strokeWidth="2" />
                <path d="m9 2 3 4 3-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 11h2m2 0h2m2 0h2M7 14.5h4m2 0h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
            </svg>
        );
    }
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};
