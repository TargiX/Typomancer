import type { Language } from '../types.ts';
import { playerStorage } from './playerStorage.ts';

export const TYPING_TRAINING_STORAGE_KEY = 'typomancerTypingTraining';
export const MAX_PATTERN_STATS = 64;
export const MAX_BENCHMARKS = 12;

export interface TypingObservation {
  expected: string;
  previousExpected?: string;
  correct: boolean;
  latencyMs: number;
}

export interface PatternWindow { attempts: number; errors: number; totalLatencyMs: number; timedAttempts: number; at: string }
export interface PatternReview { token: string; language: Language; successfulDays: number; lastPracticedAt: string; nextReviewAt: string }
export interface PatternStat {
  recent?: PatternWindow[];
  token: string;
  attempts: number;
  errors: number;
  totalLatencyMs: number;
  timedAttempts?: number;
}

export interface TrainingBenchmark {
  language?: Language;
  promptId?: string;
  measurementVersion?: 2;
  kind: 'calibration' | 'drill' | 'run';
  wpm: number;
  accuracy: number;
  completedAt: string;
}

export interface TypingTrainingProfile {
  version: 1;
  samples: number;
  keys: PatternStat[];
  bigrams: PatternStat[];
  benchmarks: TrainingBenchmark[];
  baselines?: TrainingBenchmark[];
  reviews?: PatternReview[];
}

export const EMPTY_TYPING_TRAINING: TypingTrainingProfile = {
  version: 1,
  samples: 0,
  keys: [],
  bigrams: [],
  benchmarks: [], baselines: [], reviews: []
};

const EN_WORDS = [
  'signal', 'steady', 'clear', 'trace', 'quiet', 'vector', 'cipher', 'route', 'proof', 'network',
  'precise', 'control', 'breach', 'forward', 'shadow', 'ledger', 'rhythm', 'target', 'operator', 'system'
];
const RU_WORDS = [
  'сигнал', 'точность', 'ритм', 'канал', 'контроль', 'след', 'шифр', 'маршрут', 'улика', 'система',
  'оператор', 'спокойно', 'передача', 'цель', 'защита', 'вектор', 'сеть', 'движение', 'проверка', 'связь'
];

const finite = (value: unknown, fallback = 0): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

export const normalizeTrainingToken = (value: string): string => {
  const normalized = value
    .replace(/[—–−]/g, '-')
    .replace(/ё/gi, (match) => match === 'Ё' ? 'Е' : 'е')
    .replace(/ /g, ' ')
    .toLowerCase();
  return Array.from(normalized).slice(0, 2).join('');
};

const normalizeStat = (value: unknown, maxTokenLength: number): PatternStat | null => {
  if (!value || typeof value !== 'object') return null;
  const stat = value as Partial<PatternStat>;
  const token = typeof stat.token === 'string'
    ? Array.from(normalizeTrainingToken(stat.token)).slice(0, maxTokenLength).join('')
    : '';
  if (!token || Array.from(token).length > maxTokenLength) return null;
  const attempts = Math.max(0, Math.round(finite(stat.attempts)));
  if (attempts === 0) return null;
  return {
    ...(Array.isArray(stat.recent) ? { recent: stat.recent.filter(w => w && typeof w.at === 'string' && Number.isFinite(Date.parse(w.at))).slice(-8).map(w => ({ attempts: Math.max(0, Math.round(finite(w.attempts))), errors: Math.max(0, Math.min(finite(w.attempts), Math.round(finite(w.errors)))), totalLatencyMs: Math.max(0, Math.round(finite(w.totalLatencyMs))), timedAttempts: Math.max(0, Math.min(finite(w.attempts), Math.round(finite(w.timedAttempts)))), at: w.at })) } : {}),
    token,
    attempts,
    errors: Math.min(attempts, Math.max(0, Math.round(finite(stat.errors)))),
    totalLatencyMs: Math.max(0, Math.round(finite(stat.totalLatencyMs))),
    timedAttempts: Math.min(
      attempts,
      Math.max(0, Math.round(finite(stat.timedAttempts, finite(stat.totalLatencyMs) > 0 ? attempts : 0)))
    )
  };
};

const normalizeBenchmark = (value: unknown): TrainingBenchmark | null => {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<TrainingBenchmark>;
  if (
    (item.kind !== 'calibration' && item.kind !== 'drill' && item.kind !== 'run')
    || typeof item.completedAt !== 'string' || !Number.isFinite(Date.parse(item.completedAt))
  ) return null;
  return {
    ...(item.language === 'en' || item.language === 'ru' ? { language: item.language } : {}),
    ...(typeof item.promptId === 'string' ? { promptId: item.promptId.slice(0, 100) } : {}),
    ...(item.measurementVersion === 2 ? { measurementVersion: 2 as const } : {}),
    kind: item.kind,
    wpm: Math.max(0, Math.round(finite(item.wpm))),
    accuracy: Math.max(0, Math.min(100, finite(item.accuracy, 100))),
    completedAt: item.completedAt
  };
};

export const normalizeTypingTraining = (value: unknown): TypingTrainingProfile => {
  if (!value || typeof value !== 'object') return { ...EMPTY_TYPING_TRAINING, keys: [], bigrams: [], benchmarks: [] };
  const profile = value as Partial<TypingTrainingProfile>;
  return {
    version: 1,
    samples: Math.max(0, Math.round(finite(profile.samples))),
    baselines: Array.isArray(profile.baselines) ? profile.baselines.flatMap(item => normalizeBenchmark(item) || []).slice(0, 24) : [],
    reviews: Array.isArray(profile.reviews) ? profile.reviews.filter(r => r && (r.language === 'en' || r.language === 'ru') && typeof r.token === 'string' && r.token.length <= 2 && Number.isFinite(Date.parse(r.lastPracticedAt)) && Number.isFinite(Date.parse(r.nextReviewAt))).slice(0, 64).map(r => ({ ...r, successfulDays: Math.max(0, Math.min(3, Math.floor(finite(r.successfulDays)))) })) : [],
    keys: Array.isArray(profile.keys)
      ? profile.keys.flatMap((item) => normalizeStat(item, 1) || []).slice(0, MAX_PATTERN_STATS)
      : [],
    bigrams: Array.isArray(profile.bigrams)
      ? profile.bigrams.flatMap((item) => normalizeStat(item, 2) || []).slice(0, MAX_PATTERN_STATS)
      : [],
    benchmarks: Array.isArray(profile.benchmarks)
      ? profile.benchmarks.flatMap((item) => normalizeBenchmark(item) || []).slice(0, MAX_BENCHMARKS)
      : []
  };
};

export const loadTypingTraining = (storage?: Storage): TypingTrainingProfile => {
  const target = storage || playerStorage();
  try {
    const raw = target?.getItem(TYPING_TRAINING_STORAGE_KEY);
    return raw ? normalizeTypingTraining(JSON.parse(raw)) : normalizeTypingTraining(null);
  } catch {
    return normalizeTypingTraining(null);
  }
};

export const saveTypingTraining = (profile: TypingTrainingProfile, storage?: Storage): TypingTrainingProfile => {
  const normalized = normalizeTypingTraining(profile);
  const target = storage || playerStorage();
  try {
    target?.setItem(TYPING_TRAINING_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Training remains usable when browser storage is restricted.
  }
  return normalized;
};

const mergePatterns = (
  current: PatternStat[],
  observations: TypingObservation[],
  getToken: (observation: TypingObservation) => string,
  at: string
): PatternStat[] => {
  const merged = new Map(current.map((stat) => [stat.token, { ...stat }]));
  const batches = new Map<string, PatternWindow>();
  for (const observation of observations) {
    const token = normalizeTrainingToken(getToken(observation));
    if (!token) continue;
    const stat = merged.get(token) || { token, attempts: 0, errors: 0, totalLatencyMs: 0, timedAttempts: 0 };
    const batch = batches.get(token) || { attempts: 0, errors: 0, totalLatencyMs: 0, timedAttempts: 0, at };
    batch.attempts++;
    if (!observation.correct) batch.errors++;
    stat.attempts += 1;
    if (!observation.correct) stat.errors += 1;
    const latencyMs = Math.round(finite(observation.latencyMs));
    // A long pause belongs to the player deciding/reading, not to the next key.
    if (latencyMs >= 25 && latencyMs <= 1_200) {
      batch.totalLatencyMs += latencyMs; batch.timedAttempts++;
      stat.totalLatencyMs += latencyMs;
      stat.timedAttempts = (stat.timedAttempts || 0) + 1;
    }
    batches.set(token, batch);
    merged.set(token, stat);
  }
  for (const [token, batch] of batches) {
    const stat = merged.get(token)!;
    stat.recent = [...(stat.recent || []), batch].filter(w => Date.parse(at) - Date.parse(w.at) <= 14 * 86400000).slice(-8);
  }
  // Reserve half the bounded profile for supported weaknesses, even when rare.
  const all = [...merged.values()];
  const protectedStats = all.filter(s => recentPattern(s, Date.parse(at)).errors > 0 && recentPattern(s, Date.parse(at)).attempts >= 3)
    .sort((a, b) => weaknessScore(b) - weaknessScore(a)).slice(0, MAX_PATTERN_STATS / 2);
  const protectedTokens = new Set(protectedStats.map(s => s.token));
  return [...protectedStats, ...all.filter(s => !protectedTokens.has(s.token)).sort((a, b) =>
    Date.parse(b.recent?.at(-1)?.at || '1970-01-01') - Date.parse(a.recent?.at(-1)?.at || '1970-01-01') || b.attempts - a.attempts)].slice(0, MAX_PATTERN_STATS);
};

export const recordTypingSession = (
  profile: TypingTrainingProfile,
  observations: TypingObservation[],
  benchmark?: TrainingBenchmark,
  at = new Date().toISOString()
): TypingTrainingProfile => {
  const current = normalizeTypingTraining(profile);
  const valid = observations.filter((item) => normalizeTrainingToken(item.expected));
  const bigramObservations = valid.filter((item) => item.previousExpected !== undefined);
  const baselines = [...(current.baselines || [])];
  // Recover an anchor from existing history once; never replace it as history rolls over.
  for (const item of [...current.benchmarks].reverse().concat(benchmark ? [benchmark] : [])) {
    if (item.language && item.promptId && item.measurementVersion === 2 && !baselines.some(b => benchmarkKey(b) === benchmarkKey(item))) baselines.push(item);
  }
  return normalizeTypingTraining({
    ...current, baselines,
    samples: current.samples + valid.length,
    keys: mergePatterns(current.keys, valid, (item) => item.expected, at),
    bigrams: mergePatterns(current.bigrams, bigramObservations, (item) => `${item.previousExpected}${item.expected}`, at),
    benchmarks: benchmark ? [normalizeBenchmark(benchmark), ...current.benchmarks].filter(Boolean).slice(0, MAX_BENCHMARKS) : current.benchmarks
  });
};

export function recentPattern(stat: PatternStat, now = Date.now()): PatternStat {
  if (!stat.recent?.length) return stat;
  const windows = stat.recent.filter(w => now - Date.parse(w.at) <= 14 * 86400000);
  return windows.reduce<PatternStat>((sum, w) => ({ token: stat.token, attempts: sum.attempts + w.attempts,
    errors: sum.errors + w.errors, totalLatencyMs: sum.totalLatencyMs + w.totalLatencyMs,
    timedAttempts: (sum.timedAttempts || 0) + w.timedAttempts }), { token: stat.token, attempts: 0, errors: 0, totalLatencyMs: 0, timedAttempts: 0 });
}
const benchmarkKey = (b: TrainingBenchmark) => `${b.kind}:${b.language}:${b.promptId}:${b.measurementVersion}`;
const weaknessScore = (stat: PatternStat): number => {
  const errorRate = stat.errors / Math.max(1, stat.attempts);
  const averageLatency = stat.totalLatencyMs / Math.max(1, stat.timedAttempts || 0);
  return (errorRate * 0.85) + (Math.min(1, averageLatency / 700) * 0.15);
};

export const getWeakPatterns = (profile: TypingTrainingProfile, limit = 5): PatternStat[] => {
  const current = normalizeTypingTraining(profile);
  return [...current.bigrams, ...current.keys]
    .map(stat => recentPattern(stat))
    .filter((stat) => stat.errors > 0 || stat.attempts >= 3)
    .sort((a, b) => weaknessScore(b) - weaknessScore(a) || b.attempts - a.attempts)
    .slice(0, limit);
};

/**
 * Weak patterns cleaned up for the story generator.
 *
 * This is the point of the whole training profile: instead of exiling drills to
 * a separate practice screen, the campaign itself can lean on the letter pairs
 * the player actually fumbles. That makes the story the drill.
 *
 * Only letters survive, because asking a generator to work punctuation or digits
 * into prose distorts the sentence far more than it trains anything. Patterns
 * with almost no evidence behind them are dropped so the campaign is not shaped
 * by two unlucky keystrokes.
 */
export const getTrainingFocusTokens = (
  profile: TypingTrainingProfile,
  limit = 4,
  minAttempts = 6,
  language?: Language
): string[] => {
  const isLetters = (token: string) => /^[\p{Letter}]+$/u.test(token);
  // Rank the full bounded profile first: truncating to limit * 3 up front let
  // one- and two-attempt noise occupy every candidate slot and starve the real
  // weak patterns ranked below them.
  return getWeakPatterns(profile, MAX_PATTERN_STATS * 2)
    .filter((stat) => stat.attempts >= minAttempts && (!language || (language === 'ru' ? /^[а-яё]+$/ : /^[a-z]+$/).test(stat.token)))
    .map((stat) => stat.token.toLowerCase())
    .filter((token) => token.length > 0 && token.length <= 2 && isLetters(token))
    .filter((token, index, all) => all.indexOf(token) === index)
    .slice(0, limit);
};

export const getDrillPatterns = (language: Language, profile: TypingTrainingProfile, limit = 6, minAttempts = 6): PatternStat[] =>
  getWeakPatterns(profile, MAX_PATTERN_STATS * 2)
    .filter(stat => stat.attempts >= minAttempts && (language === 'ru' ? /^[а-я0-9\p{P}\p{S}]{1,2}$/u : /^[a-z0-9\p{P}\p{S}]{1,2}$/u).test(stat.token))
    .slice(0, limit);

export const buildTargetedDrill = (language: Language, profile: TypingTrainingProfile, focus?: string[]): string => {
  const words = language === 'ru' ? RU_WORDS : EN_WORDS;
  const candidates = getDrillPatterns(language, profile, 6, 0).map(stat => stat.token);
  const eligible = getDrillPatterns(language, profile).map(stat => stat.token);
  const selectedFocus = focus?.filter(token => eligible.includes(token));
  const weakTokens = selectedFocus?.length ? selectedFocus : candidates;
  const ranked = words
    .map((word, index) => ({
      word,
      index,
      score: weakTokens.reduce((sum, token) => sum + (word.includes(token) ? Array.from(token).length : 0), 0)
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = ranked.slice(0, 10).map((item) => item.word);
  const focusedTokens = weakTokens.flatMap((token) => [token, token, token]);
  return [...focusedTokens, ...selected, ...selected.slice(0, 4)].join(' ');
};

export const snapshotTypingObservations = (observations: TypingObservation[]): TypingObservation[] => (
  observations.map((observation) => ({ ...observation }))
);

export const getBenchmarkDelta = (profile: TypingTrainingProfile, language?: Language): { wpm: number; accuracy: number; sessions: number } | null => {
  const candidates = normalizeTypingTraining(profile).benchmarks.filter(item => item.kind !== 'run' && (!language || item.language === language) && item.language && item.promptId && item.measurementVersion === 2);
  const newest = candidates[0];
  const benchmarks = candidates.filter(item => item.kind === newest.kind && item.language === newest.language && item.promptId === newest.promptId);
  if (benchmarks.length < 2) return null;
  const latest = benchmarks[0];
  const baseline = profile.baselines?.find(b => benchmarkKey(b) === benchmarkKey(latest)) || benchmarks[benchmarks.length - 1];
  return {
    wpm: latest.wpm - baseline.wpm,
    accuracy: latest.accuracy - baseline.accuracy,
    sessions: benchmarks.length
  };
};

/** Review needs actual exposure on separate days; a single good burst cannot establish retention. */
export function recordPatternReview(profile: TypingTrainingProfile, language: Language, focus: string[], observations: TypingObservation[], completedAt: string): TypingTrainingProfile {
  const reviews = [...(profile.reviews || [])];
  for (const token of focus) {
    const exposure = observations.filter(o => normalizeTrainingToken(token.length === 1 ? o.expected : `${o.previousExpected || ''}${o.expected}`) === token);
    if (exposure.length < 8) continue;
    const index = reviews.findIndex(r => r.language === language && r.token === token);
    const previous = reviews[index];
    const clean = exposure.filter(o => !o.correct).length / exposure.length <= 0.02;
    const sameDay = previous?.lastPracticedAt.slice(0, 10) === completedAt.slice(0, 10);
    const due = !previous || Date.parse(completedAt) >= Date.parse(previous.nextReviewAt);
    const successfulDays = clean ? Math.min(3, (previous?.successfulDays || 0) + (!sameDay && due ? 1 : 0)) : 0;
    const nextReviewAt = clean && previous && !due ? previous.nextReviewAt : new Date(Date.parse(completedAt) + [1, 1, 3, 7][successfulDays] * 86400000).toISOString();
    const next = { token, language, successfulDays, lastPracticedAt: completedAt, nextReviewAt };
    if (index >= 0) reviews[index] = next; else reviews.push(next);
  }
  return normalizeTypingTraining({ ...profile, reviews: reviews.sort((a, b) => Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt)).slice(0, 64) });
}
export const getDuePatterns = (profile: TypingTrainingProfile, language: Language, now = Date.now()) =>
  (profile.reviews || []).filter(r => r.language === language && Date.parse(r.nextReviewAt) <= now).sort((a, b) => Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt));
