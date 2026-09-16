import React from 'react';

const DeathSequence: React.FC<{ label: string }> = ({ label }) => (
    <div className="screens-death-sequence" role="alert" aria-live="assertive">
        <div className="screens-death-flash" aria-hidden="true" />
        <svg className="screens-death-crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M51 48 L44 34 L46 23 L38 7" />
            <path d="M49 49 L34 44 L24 36 L4 31" />
            <path d="M49 51 L36 61 L29 75 L14 92" />
            <path d="M52 49 L66 37 L77 34 L96 18" />
            <path d="M52 51 L68 57 L77 70 L94 82" />
            <path d="M50 50 L55 66 L52 81 L58 100" />
            <path d="M44 34 L34 27 L29 13 M66 37 L68 22 L78 9 M36 61 L20 60 L8 68 M68 57 L84 52 L100 54" />
        </svg>
        <div className="screens-death-copy">
            <span>{label}</span>
            <small>ERR // LINK_SEVERED</small>
        </div>
    </div>
);

export default DeathSequence;
