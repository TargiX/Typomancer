import type { Language } from '../types.ts';
import { getComparableRuns, runCondition } from './playerProgress.ts';
/**
 * PROGRESS ANALYTICS — the one thing this game is really selling.
 *
 * Credits, endings and Pact multipliers are all internal currency. The only
 * reward that leaves with the player is that their hands got better, and until
 * now the game barely mentioned it: the trend and the streak were computed and
 * then filed behind menu item four, while a returning player was greeted by
 * their wallet.
 *
 * Everything here is derived from data the game already records, and everything
 * is pure so the numbers can be checked without a browser.
 */

import type { PlayerProgress, RunRecord } from './playerProgress.ts';
import { recentPattern, type PatternStat, type TypingTrainingProfile } from './typingTraining.ts';

/** Runs at each end of history used to compare "then" against "now". */
export const COMPARISON_WINDOW = 5;

export interface SkillPoint {
  wpm: number;
  accuracy: number;
  dateKey: string;
}

/** Oldest to newest, which is the direction a progress line is read in. */
export const getSkillSeries = (progress: PlayerProgress, language?: Language): SkillPoint[] => (
  [...getComparableRuns(progress, language)]
    .filter((run) => run.wpm > 0)
    .reverse()
    .map((run) => ({ wpm: run.wpm, accuracy: run.accuracy, dateKey: run.dateKey }))
);

export interface SkillHeadline {
  currentWpm: number;
  baselineWpm: number;
  deltaWpm: number;
  currentAccuracy: number;
  baselineAccuracy: number;
  deltaAccuracy: number;
  sessions: number;
  spanDays: number;
  /** False until there is enough history for the comparison to mean anything. */
  hasEnoughHistory: boolean;
}

const average = (values: number[]): number => (
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
);

const daysBetween = (fromIso: string, toIso: string): number => {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86_400_000));
};

/**
 * "You are N words a minute faster than when you started." Averaged over a
 * window at each end rather than comparing single runs, because one good day
 * is not progress and one bad day is not decline.
 */
export const getSkillHeadline = (progress: PlayerProgress, language?: Language): SkillHeadline => {
  const runs = getComparableRuns(progress, language);
  const newestFirst = [...runs];
  const oldestFirst = [...runs].reverse();

  const recent = newestFirst.slice(0, COMPARISON_WINDOW);
  const saved = language && runs[0] ? progress.baselines?.find(b => b.condition === runCondition(runs[0]))?.runs : undefined;
  const earliest = saved?.length ? saved : oldestFirst.slice(0, COMPARISON_WINDOW);

  const currentWpm = Math.round(average(recent.map((run) => run.wpm)));
  const baselineWpm = Math.round(average(earliest.map((run) => run.wpm)));
  const currentAccuracy = Math.round(average(recent.map((run) => run.accuracy)));
  const baselineAccuracy = Math.round(average(earliest.map((run) => run.accuracy)));

  return {
    currentWpm,
    baselineWpm,
    deltaWpm: currentWpm - baselineWpm,
    currentAccuracy,
    baselineAccuracy,
    deltaAccuracy: currentAccuracy - baselineAccuracy,
    sessions: runs.length,
    spanDays: runs.length > 1 ? daysBetween(earliest[0].endedAt, newestFirst[0].endedAt) : 0,
    // Two windows that overlap heavily would compare a player against themselves.
    hasEnoughHistory: runs.length >= COMPARISON_WINDOW * 2
  };
};

export interface PatternDiagnostic {
  token: string;
  attempts: number;
  errorRate: number;
  /** Average milliseconds before this key or pair is struck. */
  avgLatencyMs: number | null;
  /** Higher means this pattern costs the player more overall. */
  cost: number;
}

const toDiagnostic = (stat: PatternStat): PatternDiagnostic => {
  const attempts = Math.max(1, stat.attempts);
  const timed = Math.max(1, stat.timedAttempts || 0);
  const errorRate = (stat.errors / attempts) * 100;
  const avgLatencyMs = stat.timedAttempts ? Math.round(stat.totalLatencyMs / timed) : null;
  return {
    token: stat.token,
    attempts: stat.attempts,
    errorRate,
    avgLatencyMs,
    // Hesitation and misses both cost time; weight misses higher because a typo
    // also costs the branch.
    cost: (errorRate * 0.75) + (Math.min(600, avgLatencyMs ?? 0) / 600) * 25
  };
};

/**
 * Per-key and per-pair diagnostics, worst first. Latency is included because it
 * is the half of the picture the game has always recorded and never shown: a key
 * you never miss but always hesitate on is still costing you the run.
 */
export const getPatternDiagnostics = (
  training: TypingTrainingProfile,
  limit = 8,
  minAttempts = 4, language?: Language
): PatternDiagnostic[] => (
  [...training.keys, ...training.bigrams]
    .map(stat => recentPattern(stat))
    .filter((stat) => stat.attempts >= minAttempts && (!language || (language === 'ru' ? /^[^a-z]*$/i : /^[^а-яё]*$/i).test(stat.token)))
    .map(toDiagnostic)
    .sort((a, b) => b.cost - a.cost || b.attempts - a.attempts)
    .slice(0, limit)
);

/**
 * The steadiest patterns, for the other half of the readout. A diagnostic that
 * only ever lists failures reads as a scolding rather than a measurement.
 */
export const getSteadiestPatterns = (
  training: TypingTrainingProfile,
  limit = 5,
  minAttempts = 6, language?: Language
): PatternDiagnostic[] => (
  [...training.keys, ...training.bigrams]
    .map(stat => recentPattern(stat))
    .filter((stat) => stat.attempts >= minAttempts && (!language || (language === 'ru' ? /^[^a-z]*$/i : /^[^а-яё]*$/i).test(stat.token)))
    .map(toDiagnostic)
    .sort((a, b) => a.cost - b.cost || b.attempts - a.attempts)
    .slice(0, limit)
);

/** Fastest and slowest average reaction across measured patterns, in ms. */
export const getLatencySpread = (training: TypingTrainingProfile, minAttempts = 4, language?: Language) => {
  const measured = [...training.keys, ...training.bigrams]
    .map(stat => recentPattern(stat))
    .filter((stat) => stat.attempts >= minAttempts && (stat.timedAttempts || 0) > 0 && (!language || (language === 'ru' ? /^[^a-z]*$/i : /^[^а-яё]*$/i).test(stat.token)))
    .map(toDiagnostic);
  if (!measured.length) return null;
  const latencies = measured.map((stat) => stat.avgLatencyMs!);
  return {
    fastestMs: Math.min(...latencies),
    slowestMs: Math.max(...latencies),
    medianMs: [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length / 2)],
    measured: measured.length
  };
};
