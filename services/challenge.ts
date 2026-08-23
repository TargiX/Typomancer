export interface TypomancerChallenge {
  dailyId: `SECTOR-${string}`;
  targetScore: number;
}

const DAILY_ID_PATTERN = /^SECTOR-(\d{8})$/;

export const parseChallenge = (search: string): TypomancerChallenge | null => {
  const params = new URLSearchParams(search);
  const dailyId = params.get('challenge');
  const target = Number(params.get('target'));
  if (!dailyId || !DAILY_ID_PATTERN.test(dailyId) || !Number.isFinite(target) || target < 0) return null;
  return {
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
