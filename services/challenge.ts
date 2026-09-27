import { DAILY_RULESET } from './sessionRules.ts';
export interface TypomancerChallenge {
  dailyId: `SECTOR-${string}`;
  targetScore: number;
  language?: 'en' | 'ru';
  ruleset?: string;
}

export interface ChallengeVerdict {
  outcome: 'beaten' | 'missed' | 'tied';
  delta: number;
}

const DAILY_ID_PATTERN = /^SECTOR-(\d{8})$/;

export const parseChallenge = (search: string): TypomancerChallenge | null => {
  const params = new URLSearchParams(search);
  const dailyId = params.get('challenge');
  const target = Number(params.get('target'));
  if (!dailyId || !DAILY_ID_PATTERN.test(dailyId) || !Number.isFinite(target) || target < 0) return null;
  return {
    ...(params.get('lang') === 'en' || params.get('lang') === 'ru' ? { language: params.get('lang') as 'en' | 'ru' } : {}),
    ...(params.get('rules') === DAILY_RULESET ? { ruleset: DAILY_RULESET } : {}),
    dailyId: dailyId as `SECTOR-${string}`,
    targetScore: Math.min(9_999_999, Math.floor(target))
  };
};

export const buildChallengeUrl = (
  origin: string,
  dailyId: string,
  targetScore: number
): string | null => {
  if (!DAILY_ID_PATTERN.test(dailyId) || !/^https?:\/\//.test(origin)) return null;
  const url = new URL(origin);
  url.search = '';
  url.hash = '';
  url.searchParams.set('challenge', dailyId);
  url.searchParams.set('target', String(Math.max(0, Math.min(9_999_999, Math.floor(targetScore)))));
  url.searchParams.set('utm_source', 'player-challenge');
  url.searchParams.set('utm_medium', 'share');
  url.searchParams.set('utm_campaign', 'daily-challenge');
  return url.toString();
};

/**
 * The URL that actually gets posted. It routes through /api/challenge so link
 * unfurlers get a rendered OG card with the score baked in, then the wrapper
 * bounces humans back into the app with the same validated params.
 */
export const buildChallengeShareUrl = (
  origin: string,
  dailyId: string,
  targetScore: number,
  language: 'en' | 'ru' = 'en'
): string | null => {
  if (!DAILY_ID_PATTERN.test(dailyId) || !/^https?:\/\//.test(origin)) return null;
  const url = new URL('/api/challenge', origin);
  url.searchParams.set('d', dailyId);
  url.searchParams.set('s', String(Math.max(0, Math.min(9_999_999, Math.floor(targetScore)))));
  url.searchParams.set('l', language);
  url.searchParams.set('r', DAILY_RULESET);
  return url.toString();
};

export const getChallengeVerdict = (
  challenge: TypomancerChallenge | null,
  dailyId: string | null,
  score: number,
  language?: 'en' | 'ru'
): ChallengeVerdict | null => {
  if (!challenge || !dailyId || challenge.dailyId !== dailyId || !Number.isFinite(score)) return null;
  if (language && (challenge.language !== language || challenge.ruleset !== DAILY_RULESET)) return null;
  const delta = Math.floor(score) - challenge.targetScore;
  return {
    outcome: delta > 0 ? 'beaten' : delta < 0 ? 'missed' : 'tied',
    delta
  };
};
