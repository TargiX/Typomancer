import type { Language } from '../types.ts';

/**
 * The shareable artifact for runs that produced no comic frames — which is
 * every run on the local fallback and the authored missions. A single-glance
 * stat card in the og.png visual language; rendered client-side, so sharing
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
        beacon: 'SYSTEM ONLINE',
        beaconLost: 'LINK SEVERED',
        wpm: 'WPM',
        acc: 'ACC',
        score: 'SCORE',
        url: 'typomancer.xyz'
    },
    ru: {
        beacon: 'СИСТЕМА В СЕТИ',
        beaconLost: 'КАНАЛ ПОТЕРЯН',
        wpm: 'СЛ/М',
        acc: 'ТЧК',
        score: 'СЧЁТ',
        url: 'typomancer.xyz'
    }
} as const;

const fitFont = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    startSize: number,
    family: string
): number => {
    let size = startSize;
    while (size > 20) {
        ctx.font = `700 ${size}px ${family}`;
        if (ctx.measureText(text).width <= maxWidth) return size;
        size -= 4;
    }
    return size;
};

const drawScoreCard = (canvas: HTMLCanvasElement, data: ScoreCardData): void => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = SCORE_CARD_WIDTH;
    const H = SCORE_CARD_HEIGHT;
    const T = CARD_TEXT[data.language];
    const accent = data.outcome === 'victory' ? '#34d399' : '#fb7185';
    const mono = "'JetBrains Mono', monospace";
    const display = "'Space Grotesk', 'JetBrains Mono', monospace";

    ctx.fillStyle = '#070a11';
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W * 0.78, H * 0.42, 40, W * 0.78, H * 0.42, 420);
    glow.addColorStop(0, 'rgba(52,211,153,0.13)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

    ctx.strokeStyle = 'rgba(52,211,153,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(26, 26, W - 52, H - 52);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    const c = 26;
    const cl = 26;
    for (const [x, y, dx, dy] of [[c, c, 1, 1], [W - c, c, -1, 1], [c, H - c, 1, -1], [W - c, H - c, -1, -1]] as const) {
        ctx.beginPath();
        ctx.moveTo(x, y + dy * cl);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx * cl, y);
        ctx.stroke();
    }

    ctx.textBaseline = 'alphabetic';
    const left = 86;

    ctx.font = `700 20px ${mono}`;
    ctx.fillStyle = accent;
    ctx.fillText(`● ${data.outcome === 'victory' ? T.beacon : T.beaconLost}`, left, 168);

    const titleSize = fitFont(ctx, data.title, 700, 76, display);
    ctx.font = `700 ${titleSize}px ${display}`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(52,211,153,0.35)';
    ctx.shadowBlur = 40;
    ctx.fillText(data.title, left, 168 + titleSize + 34);
    ctx.shadowBlur = 0;

    ctx.font = `400 24px ${mono}`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(data.subtitle.toUpperCase(), left, 168 + titleSize + 78);

    const statsY = 430;
    const stats: Array<{ label: string; value: string; color: string }> = [
        { label: T.wpm, value: String(data.wpm), color: '#e2e8f0' },
        { label: T.acc, value: `${Math.round(data.accuracy)}%`, color: '#e2e8f0' },
        { label: T.score, value: String(data.score), color: accent }
    ];
    stats.forEach((stat, i) => {
        const x = left + i * 200;
        ctx.font = `700 15px ${mono}`;
        ctx.fillStyle = '#64748b';
        ctx.fillText(stat.label, x, statsY);
        ctx.font = `700 52px ${display}`;
        ctx.fillStyle = stat.color;
        ctx.fillText(stat.value, x, statsY + 58);
    });

    if (data.badge) {
        ctx.font = `700 15px ${mono}`;
        const pad = 14;
        const width = ctx.measureText(data.badge.toUpperCase()).width + pad * 2;
        const bx = left;
        const by = statsY + 88;
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, width, 30);
        ctx.fillStyle = accent;
        ctx.fillText(data.badge.toUpperCase(), bx + pad, by + 21);
    }

    ctx.font = `700 190px ${mono}`;
    ctx.fillStyle = 'rgba(52,211,153,0.85)';
    ctx.shadowColor = 'rgba(52,211,153,0.45)';
    ctx.shadowBlur = 60;
    const glyphX = W - 400;
    const gtWidth = ctx.measureText('>').width;
    ctx.fillText('>', glyphX, 390);
    ctx.fillText('_', glyphX + gtWidth * 0.72, 390);
    ctx.shadowBlur = 0;

    ctx.font = `400 17px ${mono}`;
    ctx.fillStyle = '#475569';
    ctx.fillText(T.url, left, H - 58);
};

export const renderScoreCard = async (data: ScoreCardData): Promise<Blob | null> => {
    try {
        // fonts.ready only waits for loads that already started — Cyrillic and
        // other unicode-range subsets begin loading when the glyphs are drawn,
        // which is too late. fonts.load() with the real text forces the exact
        // subset faces the card needs before a single pixel is drawn.
        const T = CARD_TEXT[data.language];
        const charset = `${data.title}${data.subtitle}${data.badge ?? ''}${T.beacon}${T.beaconLost}${T.wpm}${T.acc}${T.score}${T.url}0123456789%×·●`;
        await Promise.all([
            document.fonts.load(`700 76px 'Space Grotesk'`, charset),
            document.fonts.load(`700 52px 'Space Grotesk'`, charset),
            document.fonts.load(`700 20px 'JetBrains Mono'`, charset),
            document.fonts.load(`400 24px 'JetBrains Mono'`, charset)
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
