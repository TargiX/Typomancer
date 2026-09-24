import React, { useEffect, useRef, useState } from 'react';

// The name of the game, set in keycaps. "TYPO" sits on dark alphas and
// "MANCER" on cream ones — a two-tone colourway, the error and the magic.
// On arrival the word types itself onto blank caps; afterwards any letter the
// player presses on their real keyboard sinks the matching cap, so the first
// thing the game answers to is a keystroke.
const WORD = 'TYPOMANCER';
const SPLIT = 4;
const TYPE_INTERVAL_MS = 90;
const PRESS_MS = 130;

const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const KeycapWordmark: React.FC = () => {
    const [reduced] = useState(prefersReducedMotion);
    const [revealed, setRevealed] = useState(() => (reduced ? WORD.length : 0));
    const [pressed, setPressed] = useState<ReadonlySet<number>>(() => new Set());
    const timers = useRef<number[]>([]);

    const press = (index: number) => {
        setPressed(prev => new Set(prev).add(index));
        const id = window.setTimeout(() => {
            setPressed(prev => {
                const next = new Set(prev);
                next.delete(index);
                return next;
            });
        }, PRESS_MS);
        timers.current.push(id);
    };

    useEffect(() => {
        if (reduced) return;
        let index = 0;
        const id = window.setInterval(() => {
            press(index);
            index += 1;
            setRevealed(index);
            if (index >= WORD.length) window.clearInterval(id);
        }, TYPE_INTERVAL_MS);
        return () => window.clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reduced]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
            const key = event.key.length === 1 ? event.key.toUpperCase() : '';
            if (!key) return;
            for (let i = 0; i < WORD.length; i++) if (WORD[i] === key) press(i);
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            timers.current.forEach(id => window.clearTimeout(id));
            timers.current = [];
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <h1 className="wordmark" aria-label="Typomancer">
            {WORD.split('').map((letter, index) => (
                <span
                    key={index}
                    aria-hidden="true"
                    data-pressed={pressed.has(index) ? 'true' : undefined}
                    className={`wordmark-cap ${index < SPLIT ? 'wordmark-cap--dark' : 'wordmark-cap--cream'}`}
                >
                    <span className={`wordmark-legend ${index < revealed ? 'is-set' : ''}`}>{letter}</span>
                </span>
            ))}
        </h1>
    );
};

export default KeycapWordmark;
