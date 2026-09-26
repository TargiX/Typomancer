import { DAILY_RULESET } from '../services/sessionRules.ts';
const DAILY_ID_PATTERN = /^SECTOR-(\d{8})$/;
const clampScore = (value: number): number => Math.max(0, Math.min(9_999_999, Math.floor(value)));

const json = (res: any, status: number, data: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
};

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const COPY = {
  en: {
    title: (score: number) => `I scored ${score.toLocaleString('en-US')} in Typomancer's Daily Sector — beat it`,
    description: 'A consequence-driven RPG typing game. Every keystroke rewrites the story.',
    link: 'Accept the challenge'
  },
  ru: {
    title: (score: number) => `Я набрал ${score.toLocaleString('en-US')} в Дневном секторе Typomancer — сможешь побить?`,
    description: 'RPG-тренажёр печати: каждая опечатка гнёт историю.',
    link: 'Принять вызов'
  }
} as const;

/**
 * Share-target wrapper for challenge links. Social crawlers see OG meta with a
 * rendered score card (/api/og); humans get bounced straight into the game
 * with the canonical ?challenge=…&target=… params the app already parses.
 */
export default function handler(req: any, res: any) {
  const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'typomancer.xyz';
  const proto = req.headers?.['x-forwarded-proto'] || 'https';
  const origin = `${proto}://${Array.isArray(host) ? host[0] : host}`;

  const url = new URL(req.url || '/', origin);
  const dailyId = url.searchParams.get('d') || '';
  const score = clampScore(Number(url.searchParams.get('s')) || 0);
  const lang = url.searchParams.get('l') === 'ru' ? 'ru' : 'en';

  if (!DAILY_ID_PATTERN.test(dailyId)) {
    res.statusCode = 302;
    res.setHeader('Location', '/');
    return res.end();
  }

  const rules = url.searchParams.get('r') === DAILY_RULESET ? `&rules=${DAILY_RULESET}&lang=${lang}` : '';
  const T = COPY[lang];
  const appUrl = `${origin}/?challenge=${dailyId}&target=${score}${rules}&utm_source=player-challenge&utm_medium=share&utm_campaign=daily-challenge`;
  const ogImage = `${origin}/api/og?d=${dailyId}&s=${score}${lang === 'ru' ? '&l=ru' : ''}`;
  const title = escapeHtml(T.title(score));
  const description = escapeHtml(T.description);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.end(`<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(appUrl)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:image" content="${ogImage}" />
    <meta http-equiv="refresh" content="0;url=${escapeHtml(appUrl)}" />
  </head>
  <body style="background:#070a11;color:#e2e8f0;font-family:monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
    <script>location.replace(${JSON.stringify(appUrl)});</script>
    <a href="${escapeHtml(appUrl)}" style="color:#34d399">${escapeHtml(T.link)}</a>
  </body>
</html>`);
}
