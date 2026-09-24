import type { Language } from '../types.ts';

/**
 * The shareable artifact for runs that produced no comic frames — which is
 * every run on the local fallback and the authored missions. A single-glance
 * stat card in the og.png visual language (paper, ink, keycaps); rendered client-side, so sharing
 * costs nothing and works offline.
 */
export interface ScoreCardData {
    outcome: 'victory' | 'defeat';
    title: string;
    subtitle: string;
    score: number;
    wpm: number;
    accuracy: number;
    badge?: string;
    language: Language;
}

export const SCORE_CARD_WIDTH = 1200;
export const SCORE_CARD_HEIGHT = 630;

const CARD_TEXT = {
    en: {
        beacon: 'OPERATION COMPLETE',
        beaconLost: 'LINK SEVERED',
        wpm: 'WPM',
        acc: 'ACC',
        score: 'SCORE',
        url: 'typomancer.xyz'
    },
    ru: {
        beacon: 'ОПЕРАЦИЯ ЗАВЕРШЕНА',
        beaconLost: 'КАНАЛ ПОТЕРЯН',
        wpm: 'СЛ/М',
        acc: 'ТЧК',
        score: 'СЧЁТ',
        url: 'typomancer.xyz'
    }
} as const;

const PAPER = '#ece3cf';
const INK = '#15120e';
const INK_SOFT = '#4a4238';
const DISPLAY = "Unbounded, 'Martian Mono', sans-serif";
const PROSE = "'Victor Mono', 'Martian Mono', monospace";
const MONO = "'Martian Mono', monospace";

const fitFont = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    startSize: number,
    family: string
): number => {
    let size = startSize;
    while (size > 20) {
        ctx.font = `800 ${size}px ${family}`;
        if (ctx.measureText(text).width <= maxWidth) return size;
        size -= 4;
    }
    return size;
};

// The run's colourway accent, read from the shell that is on screen.
const readAccent = (outcome: ScoreCardData['outcome']): string => {
    if (outcome === 'defeat') return '#d7263d';
    const shell = typeof document !== 'undefined' ? document.querySelector('[data-colorway]') : null;
    const rgb = shell ? getComputedStyle(shell).getPropertyValue('--signal-rgb').trim() : '';
    return rgb ? `rgb(${rgb})` : '#ff6a2b';
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
};

// The same keycap wordmark as the title screen: dark TYPO, cream MANCER.
const drawKeycapWordmark = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    const word = 'TYPOMANCER';
    const gap = size * 0.12;
    const wall = size * 0.16;
    for (let i = 0; i < word.length; i++) {
        const cream = i >= 4;
        const cx = x + i * (size + gap);
        ctx.fillStyle = '#000';
        roundRect(ctx, cx - 2, y - 2, size + 4, size + wall + 4, size * 0.17);
        ctx.fill();
        ctx.fillStyle = cream ? '#a69879' : '#23212a';
        roundRect(ctx, cx, y, size, size + wall, size * 0.15);
        ctx.fill();
        ctx.fillStyle = cream ? '#f3ecdc' : '#3d3b45';
        roundRect(ctx, cx, y, size, size, size * 0.15);
        ctx.fill();
        ctx.fillStyle = cream ? INK : '#efe7d6';
        ctx.font = `800 ${Math.round(size * 0.42)}px ${DISPLAY}`;
        ctx.textAlign = 'center';
        ctx.fillText(word[i], cx + size / 2, y + size * 0.66);
    }
    ctx.textAlign = 'left';
};

const drawScoreCard = (canvas: HTMLCanvasElement, data: ScoreCardData): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = SCORE_CARD_WIDTH;
    const H = SCORE_CARD_HEIGHT;
    const T = CARD_TEXT[data.language];
    const accent = readAccent(data.outcome);
    const left = 64;

    // Paper with a faint halftone — the card is the cover of a printed issue.
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(80, 60, 30, 0.07)';
    for (let y = 0, row = 0; y < H; y += 6, row++) {
        for (let x = row % 2 ? 3 : 0; x < W; x += 6) ctx.fillRect(x, y, 1.3, 1.3);
    }

    // Ink masthead with the keycap wordmark and the outcome on the right.
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, 132);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 132, W, 8);
    drawKeycapWordmark(ctx, left, 36, 50);
    ctx.textAlign = 'right';
    ctx.font = `700 18px ${MONO}`;
    ctx.fillStyle = accent;
    ctx.fillText(data.outcome === 'victory' ? T.beacon : T.beaconLost, W - left, 76);
    ctx.textAlign = 'left';

    ctx.textBaseline = 'alphabetic';
    const titleSize = fitFont(ctx, data.title, W - left * 2, 64, DISPLAY);
    ctx.font = `800 ${titleSize}px ${DISPLAY}`;
    ctx.fillStyle = INK;
    ctx.fillText(data.title, left, 200 + titleSize);

    ctx.font = `italic 500 26px ${PROSE}`;
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(data.subtitle, left, 200 + titleSize + 48);

    // Stats in ink boxes; the score box is filled with the accent.
    const boxY = 400;
    const boxW = 220;
    const boxH = 116;
    const stats: Array<{ label: string; value: string; filled?: boolean }> = [
        { label: T.wpm, value: String(data.wpm) },
        { label: T.acc, value: `${Math.round(data.accuracy)}%` },
        { label: T.score, value: String(data.score), filled: true }
    ];
    stats.forEach((stat, i) => {
        const x = left + i * (boxW + 18);
        if (stat.filled) {
            ctx.fillStyle = accent;
            ctx.fillRect(x, boxY, boxW, boxH);
        }
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, boxY, boxW, boxH);
        ctx.font = `700 15px ${MONO}`;
        ctx.fillStyle = stat.filled ? INK : INK_SOFT;
        ctx.fillText(stat.label, x + 18, boxY + 32);
        const valueSize = fitFont(ctx, stat.value, boxW - 36, 52, DISPLAY);
        ctx.font = `800 ${valueSize}px ${DISPLAY}`;
        ctx.fillStyle = INK;
        ctx.fillText(stat.value, x + 18, boxY + 92);
    });

    // A badge is a rubber stamp, slightly off-square.
    if (data.badge) {
        ctx.save();
        ctx.font = `700 20px ${MONO}`;
        const text = data.badge.toUpperCase();
        const pad = 18;
        const width = ctx.measureText(text).width + pad * 2;
        const bx = left + 3 * (boxW + 18) + 24;
        const by = boxY + 30;
        ctx.translate(bx + width / 2, by + 24);
        ctx.rotate(-0.05);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 4;
        ctx.strokeRect(-width / 2, -24, width, 48);
        ctx.fillStyle = accent;
        ctx.textAlign = 'center';
        ctx.fillText(text, 0, 7);
        ctx.restore();
    }

    ctx.font = `700 17px ${MONO}`;
    ctx.fillStyle = INK_SOFT;
    ctx.fillText(T.url, left, H - 40);
};

export const renderScoreCard = async (data: ScoreCardData): Promise<Blob | null> => {
    try {
        // fonts.ready only waits for loads that already started — Cyrillic and
        // other unicode-range subsets begin loading when the glyphs are drawn,
        // which is too late. fonts.load() with the real text forces the exact
        // subset faces the card needs before a single pixel is drawn.
        const T = CARD_TEXT[data.language];
        const charset = `${data.title}${data.subtitle}${data.badge ?? ''}${T.beacon}${T.beaconLost}${T.wpm}${T.acc}${T.score}${T.url}TYPOMANCER0123456789%×·`;
        await Promise.all([
            document.fonts.load(`800 64px Unbounded`, charset),
            document.fonts.load(`italic 500 26px 'Victor Mono'`, charset),
            document.fonts.load(`700 18px 'Martian Mono'`, charset)
        ]);
        await document.fonts.ready;
    } catch {
        // Fonts API can be unavailable — the card still renders with fallbacks.
    }
    const canvas = document.createElement('canvas');
    canvas.width = SCORE_CARD_WIDTH;
    canvas.height = SCORE_CARD_HEIGHT;
    drawScoreCard(canvas, data);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'));
};

export type ScoreCardShareResult = 'shared' | 'downloaded' | 'failed';

export const shareScoreCardImage = async (data: ScoreCardData, shareText: string): Promise<ScoreCardShareResult> => {
    const blob = await renderScoreCard(data);
    if (!blob) return 'failed';
    const fileName = `typomancer-${data.outcome}-${Date.now()}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
        try {
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Typomancer', text: shareText });
                return 'shared';
            }
        } catch {
            // Cancelled share sheet or unsupported payload — fall to download.
        }
    }

    try {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        return 'downloaded';
    } catch {
        return 'failed';
    }
};
