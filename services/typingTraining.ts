import type { Language } from '../types.ts';

export const TYPING_TRAINING_STORAGE_KEY = 'typomancerTypingTraining';
export const MAX_PATTERN_STATS = 64;
export const MAX_BENCHMARKS = 12;

export interface TypingObservation {
  expected: string;
  previousExpected?: string;
  correct: boolean;
  latencyMs: number;
}

export interface PatternStat {
  token: string;
  attempts: number;
  errors: number;
  totalLatencyMs: number;
  timedAttempts?: number;
}

export interface TrainingBenchmark {
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
}

export const EMPTY_TYPING_TRAINING: TypingTrainingProfile = {
  version: 1,
  samples: 0,
  keys: [],
  bigrams: [],
  benchmarks: []
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
    || typeof item.completedAt !== 'string'
  ) return null;
  return {
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
  const target = storage || (typeof localStorage !== 'undefined' ? localStorage : undefined);
  try {
    const raw = target?.getItem(TYPING_TRAINING_STORAGE_KEY);
    return raw ? normalizeTypingTraining(JSON.parse(raw)) : normalizeTypingTraining(null);
  } catch {
    return normalizeTypingTraining(null);
  }
};

export const saveTypingTraining = (profile: TypingTrainingProfile, storage?: Storage): TypingTrainingProfile => {
  const normalized = normalizeTypingTraining(profile);
  const target = storage || (typeof localStorage !== 'undefined' ? localStorage : undefined);
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
  getToken: (observation: TypingObservation) => string
): PatternStat[] => {
  const merged = new Map(current.map((stat) => [stat.token, { ...stat }]));
  for (const observation of observations) {
    const token = normalizeTrainingToken(getToken(observation));
    if (!token) continue;
    const stat = merged.get(token) || { token, attempts: 0, errors: 0, totalLatencyMs: 0, timedAttempts: 0 };
    stat.attempts += 1;
    if (!observation.correct) stat.errors += 1;
    const latencyMs = Math.round(finite(observation.latencyMs));
    // A long pause belongs to the player deciding/reading, not to the next key.
    if (latencyMs >= 25 && latencyMs <= 1_200) {
      stat.totalLatencyMs += latencyMs;
      stat.timedAttempts = (stat.timedAttempts || 0) + 1;
    }
    merged.set(token, stat);
  }
  return [...merged.values()]
    .sort((a, b) => b.attempts - a.attempts || b.errors - a.errors || a.token.localeCompare(b.token))
    .slice(0, MAX_PATTERN_STATS);
};

export const recordTypingSession = (
  profile: TypingTrainingProfile,
  observations: TypingObservation[],
  benchmark?: TrainingBenchmark
): TypingTrainingProfile => {
  const current = normalizeTypingTraining(profile);
  const valid = observations.filter((item) => normalizeTrainingToken(item.expected));
  const bigramObservations = valid.filter((item) => item.previousExpected !== undefined);
  return normalizeTypingTraining({
    ...current,
    samples: current.samples + valid.length,
    keys: mergePatterns(current.keys, valid, (item) => item.expected),
    bigrams: mergePatterns(current.bigrams, bigramObservations, (item) => `${item.previousExpected}${item.expected}`),
    benchmarks: benchmark ? [normalizeBenchmark(benchmark), ...current.benchmarks].filter(Boolean).slice(0, MAX_BENCHMARKS) : current.benchmarks
  });
};

const weaknessScore = (stat: PatternStat): number => {
  const errorRate = stat.errors / Math.max(1, stat.attempts);
  const averageLatency = stat.totalLatencyMs / Math.max(1, stat.timedAttempts || 0);
  return (errorRate * 0.85) + (Math.min(1, averageLatency / 700) * 0.15);
};

export const getWeakPatterns = (profile: TypingTrainingProfile, limit = 5): PatternStat[] => {
  const current = normalizeTypingTraining(profile);
  return [...current.bigrams, ...current.keys]
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
  minAttempts = 6
): string[] => {
  const isLetters = (token: string) => /^[\p{Letter}]+$/u.test(token);
  // Rank the full bounded profile first: truncating to limit * 3 up front let
  // one- and two-attempt noise occupy every candidate slot and starve the real
  // weak patterns ranked below them.
  return getWeakPatterns(profile, MAX_PATTERN_STATS * 2)
    .filter((stat) => stat.attempts >= minAttempts)
    .map((stat) => stat.token.toLowerCase())
    .filter((token) => token.length > 0 && token.length <= 2 && isLetters(token))
    .filter((token, index, all) => all.indexOf(token) === index)
    .slice(0, limit);
};

export const buildTargetedDrill = (language: Language, profile: TypingTrainingProfile): string => {
  const words = language === 'ru' ? RU_WORDS : EN_WORDS;
  const weakTokens = getWeakPatterns(profile, 6).map((stat) => stat.token).filter((token) => token.trim());
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

export const getBenchmarkDelta = (profile: TypingTrainingProfile): { wpm: number; accuracy: number; sessions: number } | null => {
  const benchmarks = normalizeTypingTraining(profile).benchmarks.filter((item) => item.kind !== 'run');
  if (benchmarks.length < 2) return null;
  const latest = benchmarks[0];
  const baseline = benchmarks[benchmarks.length - 1];
  return {
    wpm: latest.wpm - baseline.wpm,
    accuracy: latest.accuracy - baseline.accuracy,
    sessions: benchmarks.length
  };
};
