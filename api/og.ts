// Plain TypeScript entrypoint: the Vercel Node builder does not trace TSX functions reliably.
export const config = { maxDuration: 30 };
import { ImageResponse } from '@vercel/og';
import React from 'react';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
/**
 * Dynamic share card for challenge links. Crawlers only read meta tags, so
 * /api/challenge serves them this rendered card — the score is baked into the
 * image, which is what actually makes people click "beat it".
 */
// Resolve packaged assets rather than fetching the request's Host (which may
// be untrusted or a deployment-protected preview URL).
const fonts = Promise.all([
    readFile(join(process.cwd(), 'public/fonts/JetBrainsMono-Bold.ttf')),
    readFile(join(process.cwd(), 'public/fonts/SpaceGrotesk-Bold.ttf'))
]);
const DAILY_ID_PATTERN = /^SECTOR-(\d{8})$/;
const clampScore = (value) => Math.max(0, Math.min(9_999_999, Math.floor(value)));
const COPY = {
    en: {
        beacon: 'SYSTEM ONLINE',
        sector: 'DAILY SECTOR',
        challenge: 'CAN YOU BEAT IT?',
        url: 'typomancer.xyz'
    },
    ru: {
        beacon: 'СИСТЕМА В СЕТИ',
        sector: 'ДНЕВНОЙ СЕКТОР',
        challenge: 'СМОЖЕШЬ ПОБИТЬ?',
        url: 'typomancer.xyz'
    }
};
export default async function handler(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
    const url = new URL(req.url || '/', 'https://typomancer.xyz');
    const score = clampScore(Number(url.searchParams.get('s')) || 0);
    const dailyId = url.searchParams.get('d') || '';
    const lang = url.searchParams.get('l') === 'ru' ? 'ru' : 'en';
    const T = COPY[lang];
    const sectorLabel = DAILY_ID_PATTERN.test(dailyId)
        ? dailyId.replace('SECTOR-', '').replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')
        : '';
    const [monoFont, displayFont] = await fonts;
    const image = new ImageResponse((React.createElement("div", { style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: '#070a11',
            padding: '52px 72px',
            fontFamily: 'JetBrains Mono'
        } },
        React.createElement("div", { style: { display: 'flex', alignItems: 'center', gap: 14, color: '#34d399', fontSize: 20, letterSpacing: 6 } },
            React.createElement("div", { style: { width: 11, height: 11, borderRadius: 11, backgroundColor: '#34d399' } }),
            T.beacon),
        React.createElement("div", { style: { display: 'flex', flexDirection: 'column' } },
            React.createElement("div", { style: { color: '#94a3b8', fontSize: 26, letterSpacing: 4 } }, `${T.sector}${sectorLabel ? ` · ${sectorLabel}` : ''}`),
            React.createElement("div", { style: {
                    fontFamily: 'Space Grotesk',
                    fontSize: 148,
                    fontWeight: 700,
                    color: '#ffffff',
                    lineHeight: 1.05,
                    letterSpacing: -4
                } }, score.toLocaleString('en-US')),
            React.createElement("div", { style: { color: '#34d399', fontSize: 30, letterSpacing: 5, marginTop: 6 } }, T.challenge)),
        React.createElement("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' } },
            React.createElement("div", { style: { color: '#475569', fontSize: 19, letterSpacing: 4 } }, T.url),
            React.createElement("div", { style: { color: 'rgba(52,211,153,0.9)', fontSize: 88, fontWeight: 700, letterSpacing: -8 } }, '>_')),
        React.createElement("div", { style: {
                position: 'absolute',
                top: 26,
                left: 26,
                right: 26,
                bottom: 26,
                border: '2px solid rgba(52,211,153,0.35)'
            } }))), {
        width: 1200,
        height: 630,
        fonts: [
            { name: 'JetBrains Mono', data: monoFont, weight: 700, style: 'normal' },
            { name: 'Space Grotesk', data: displayFont, weight: 700, style: 'normal' }
        ]
    });
    res.statusCode = image.status;
    image.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(Buffer.from(await image.arrayBuffer()));
}
