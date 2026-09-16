import React, { useEffect, useMemo, useState } from 'react';

// Live "signal monitor" that replaces the cliché status pill: the label continuously
// scrambles through glyphs and re-decodes, next to a scrolling oscilloscope, a pulsing
// REC dot, a drifting ping readout and a scanline sweep — a hacker rig that feels alive.
const BEACON_SCRAMBLE = "ABCDEF0123456789#%&/\\<>[]{}=+*!?";

const SystemBeacon: React.FC<{ label: string }> = ({ label }) => {
    const [text, setText] = useState(label);
    const [ping, setPing] = useState(4);

    useEffect(() => {
        let frame = 0;
        const id = window.setInterval(() => {
            frame++;
            const period = label.length + 26; // decode, then hold, then re-scramble
            const t = frame % period;
            const revealed = Math.max(0, Math.min(label.length, t - 4));
            let out = "";
            for (let i = 0; i < label.length; i++) {
                const ch = label[i];
                if (ch === " ") { out += " "; continue; }
                out += i < revealed ? ch : BEACON_SCRAMBLE[Math.floor(Math.random() * BEACON_SCRAMBLE.length)];
            }
            setText(out);
        }, 55);
        return () => window.clearInterval(id);
    }, [label]);

    useEffect(() => {
        const id = window.setInterval(() => setPing(2 + Math.floor(Math.random() * 8)), 700);
        return () => window.clearInterval(id);
    }, []);

    const wave = useMemo(() => {
        const pts: string[] = [];
        const mid = 12;
        for (let x = 0; x <= 240; x += 3) {
            const base = Math.sin((x * 2 * Math.PI) / 40) * 2.4;
            const fine = Math.sin((x * 2 * Math.PI) / 8) * 1.0;
            let spike = 0;
            const m = x % 40;
            if (m < 3) spike = -7.5; else if (m >= 20 && m < 23) spike = 7.5;
            pts.push(`${x},${(mid + base + fine + spike).toFixed(1)}`);
        }
        return "M" + pts.join(" L");
    }, []);

    const cut = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';

    return (
        <div className="relative inline-flex items-center gap-3 px-4 py-2 overflow-hidden" style={{ clipPath: cut }}>
            {/* emerald frame + dark face */}
            <div className="absolute inset-0 z-0" style={{ clipPath: cut, background: 'linear-gradient(180deg, rgba(52,211,153,0.55), rgba(52,211,153,0.12))' }} />
            <div className="absolute inset-[1.5px] z-0 bg-[#060c12]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }} />
            {/* scanline sweep */}
            <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
                <div className="beacon-scan h-2.5 w-full bg-gradient-to-b from-transparent via-emerald-400/25 to-transparent" />
            </div>

            {/* REC dot */}
            <span className="relative z-20 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>

            {/* decoding label */}
            <span className="relative z-20 beacon-flicker font-mono fs-label font-bold tracking-[0.22em] text-emerald-300 whitespace-nowrap" style={{ textShadow: '0 0 8px rgba(52,211,153,0.45)' }}>
                {text}
            </span>

            {/* oscilloscope */}
            <div className="relative z-20 h-4 w-16 overflow-hidden">
                <svg className="absolute inset-0 h-full scope-scroll" style={{ width: '200%' }} viewBox="0 0 240 24" preserveAspectRatio="none">
                    <path d={wave} fill="none" stroke="#34d399" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
            </div>

            {/* drifting ping */}
            <span className="relative z-20 font-mono fs-micro tracking-[0.15em] text-emerald-500/70 tabular-nums whitespace-nowrap">
                {ping}ms
            </span>
        </div>
    );
};

export default SystemBeacon;
