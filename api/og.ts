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
    readFile(join(process.cwd(), 'public/fonts/MartianMono-Bold.woff')),
    readFile(join(process.cwd(), 'public/fonts/Unbounded-ExtraBold.woff'))
]);
const DAILY_ID_PATTERN = /^SECTOR-(\d{8})$/;
const clampScore = (value) => Math.max(0, Math.min(9_999_999, Math.floor(value)));
const COPY = {
    en: {
        beacon: 'SCORE TO BEAT',
        sector: 'DAILY SECTOR',
        challenge: 'CAN YOU BEAT IT?',
        tagline: 'TYPE YOUR OWN FATE',
        url: 'typomancer.xyz'
    },
    ru: {
        beacon: 'СЧЁТ, КОТОРЫЙ НАДО ПОБИТЬ',
        sector: 'ДНЕВНОЙ СЕКТОР',
        challenge: 'СМОЖЕШЬ ПОБИТЬ?',
        tagline: 'НАПЕЧАТАЙ СВОЮ СУДЬБУ',
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
    const h = React.createElement;
    // The card is the cover of a printed issue: paper, an ink masthead with the
    // name set in keycaps, the score in heavy type, and the dare as a stamp.
    const INK = '#15120e';
    const SIGNAL = '#ff6a2b';
    const cap = (letter: string, index: number) => {
        const cream = index >= 4;
        return h('div', { key: index, style: {
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 50, height: 50, borderRadius: 8,
                backgroundColor: cream ? '#f3ecdc' : '#3d3b45',
                borderBottom: `8px solid ${cream ? '#a69879' : '#23212a'}`,
                boxShadow: `0 0 0 2px #000`,
                color: cream ? INK : '#efe7d6',
                fontFamily: 'Unbounded', fontSize: 21, paddingTop: 2
            } }, letter);
    };
    const image = new ImageResponse(h('div', { style: {
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            backgroundColor: '#ece3cf', fontFamily: 'Martian Mono', color: INK
        } },
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 132, padding: '0 64px', backgroundColor: INK, borderBottom: `8px solid ${SIGNAL}` } },
            h('div', { style: { display: 'flex', gap: 6, flexShrink: 0 } }, ...'TYPOMANCER'.split('').map(cap)),
            h('div', { style: { display: 'flex', marginLeft: 32, whiteSpace: 'nowrap', color: SIGNAL, fontSize: 17, letterSpacing: 3 } }, `${T.sector}${sectorLabel ? ` · ${sectorLabel}` : ''}`)),
        h('div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center', padding: '0 64px' } },
            h('div', { style: { display: 'flex', fontSize: 22, letterSpacing: 5, color: '#4a4238' } }, T.beacon),
            h('div', { style: { display: 'flex', fontFamily: 'Unbounded', fontSize: 168, lineHeight: 1.05, letterSpacing: -6 } }, score.toLocaleString('en-US')),
            h('div', { style: { display: 'flex' } },
                h('div', { style: { display: 'flex', marginTop: 8, padding: '8px 18px', border: `4px solid ${SIGNAL}`, borderRadius: 6, color: SIGNAL, fontSize: 30, letterSpacing: 5, transform: 'rotate(-2deg)' } }, T.challenge))),
        h('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '0 64px 40px', fontSize: 19, letterSpacing: 4, color: '#4a4238' } },
            h('div', { style: { display: 'flex' } }, T.url),
            h('div', { style: { display: 'flex' } }, T.tagline))), {
        width: 1200,
        height: 630,
        fonts: [
            { name: 'Martian Mono', data: monoFont, weight: 700, style: 'normal' },
            { name: 'Unbounded', data: displayFont, weight: 800, style: 'normal' }
        ]
    });
    res.statusCode = image.status;
    image.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(Buffer.from(await image.arrayBuffer()));
}
