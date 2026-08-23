import type { StoryGenreId } from '../types.ts';
import type { TypingFocus } from './gameRules.ts';

export const PLAYER_PROGRESS_STORAGE_KEY = 'typomancerPlayerProgress';
export const PLAYER_PROGRESS_VERSION = 1;
export const MAX_RUN_HISTORY = 20;

export type DifficultyPreset = 'guided' | 'balanced' | 'intense';

export interface CalibrationResult {
  wpm: number;
  accuracy: number;
  durationMs: number;
  completedAt: string;
  preset: DifficultyPreset;
}

export interface AdaptiveDifficulty {
  preset: DifficultyPreset;
  traceSpeedMultiplier: number;
  mistakeGraceCount: number;
}

export interface RunRecord {
  id: string;
  endedAt: string;
  dateKey: string;
  outcome: 'victory' | 'defeat' | 'banked';
  daily: boolean;
  genre: StoryGenreId;
  level: number;
  score: number;
  wpm: number;
  bestWpm: number;
  accuracy: number;
  consistency: number;
  mistakes: number;
  characters: number;
  durationSeconds: number;
  focus: TypingFocus;
}

export interface PlayerProgress {
  version: 1;
  calibration: CalibrationResult | null;
  runs: RunRecord[];
}

export interface ProgressSummary {
  totalRuns: number;
  bestWpm: number;
  averageWpm: number;
  averageAccuracy: number;
  wpmDelta: number;
  currentStreak: number;
  hasRunToday: boolean;
  latestFocus: TypingFocus | null;
  recentRuns: RunRecord[];
}

export const EMPTY_PLAYER_PROGRESS: PlayerProgress = {
  version: PLAYER_PROGRESS_VERSION,
  calibration: null,
  runs: []
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const finite = (value: unknown, fallback = 0): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

export const getLocalDateKey = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDifficultyPreset = (wpm: number, accuracy: number): DifficultyPreset => {
  if (wpm < 35 || accuracy < 94) return 'guided';
  if (wpm < 60 || accuracy < 97) return 'balanced';
  return 'intense';
};

export const createCalibrationResult = (
  wpm: number,
  accuracy: number,
  durationMs: number,
  completedAt = new Date().toISOString()
): CalibrationResult => {
  const safeWpm = Math.max(1, Math.round(finite(wpm, 1)));
  const safeAccuracy = clamp(finite(accuracy, 100));
  return {
    wpm: safeWpm,
    accuracy: safeAccuracy,
    durationMs: Math.max(1, Math.round(finite(durationMs, 1))),
    completedAt,
    preset: getDifficultyPreset(safeWpm, safeAccuracy)
  };
};

export const createBalancedCalibration = (completedAt = new Date().toISOString()): CalibrationResult => (
  createCalibrationResult(50, 97, 1, completedAt)
);

export const getAdaptiveDifficulty = (calibration: CalibrationResult | null): AdaptiveDifficulty => {
  const preset = calibration?.preset || 'balanced';
  if (preset === 'guided') {
    return { preset, traceSpeedMultiplier: 0.72, mistakeGraceCount: 2 };
  }
  if (preset === 'intense') {
    return { preset, traceSpeedMultiplier: 1, mistakeGraceCount: 0 };
  }
  return { preset, traceSpeedMultiplier: 0.88, mistakeGraceCount: 1 };
};

const normalizeCalibration = (value: unknown): CalibrationResult | null => {
  if (!value || typeof value !== 'object') return null;
  const calibration = value as Partial<CalibrationResult>;
  if (
    typeof calibration.wpm !== 'number'
    || typeof calibration.accuracy !== 'number'
    || typeof calibration.durationMs !== 'number'
    || typeof calibration.completedAt !== 'string'
  ) return null;
  return createCalibrationResult(
    calibration.wpm,
    calibration.accuracy,
    calibration.durationMs,
    calibration.completedAt
  );
};

const isGenre = (value: unknown): value is StoryGenreId => (
  value === 'cyberpunk' || value === 'space_horror' || value === 'noir' || value === 'dark_fable'
);

const isFocus = (value: unknown): value is TypingFocus => (
  value === 'accuracy' || value === 'consistency' || value === 'speed' || value === 'mastery'
);

const normalizeRun = (value: unknown): RunRecord | null => {
  if (!value || typeof value !== 'object') return null;
  const run = value as Partial<RunRecord>;
  if (
    typeof run.id !== 'string'
    || typeof run.endedAt !== 'string'
    || typeof run.dateKey !== 'string'
    || (run.outcome !== 'victory' && run.outcome !== 'defeat' && run.outcome !== 'banked')
    || typeof run.daily !== 'boolean'
    || !isGenre(run.genre)
    || !isFocus(run.focus)
  ) return null;
  return {
    id: run.id,
    endedAt: run.endedAt,
    dateKey: run.dateKey,
    outcome: run.outcome,
    daily: run.daily,
    genre: run.genre,
    level: Math.max(1, Math.round(finite(run.level, 1))),
    score: Math.max(0, Math.round(finite(run.score))),
    wpm: Math.max(0, Math.round(finite(run.wpm))),
    bestWpm: Math.max(0, Math.round(finite(run.bestWpm))),
    accuracy: clamp(finite(run.accuracy, 100)),
    consistency: clamp(finite(run.consistency, 100)),
    mistakes: Math.max(0, Math.round(finite(run.mistakes))),
    characters: Math.max(0, Math.round(finite(run.characters))),
    durationSeconds: Math.max(0, Math.round(finite(run.durationSeconds))),
    focus: run.focus
  };
};

export const normalizePlayerProgress = (value: unknown): PlayerProgress => {
  if (!value || typeof value !== 'object') return { ...EMPTY_PLAYER_PROGRESS, runs: [] };
  const progress = value as Partial<PlayerProgress>;
  const runs = Array.isArray(progress.runs)
    ? progress.runs.flatMap((run) => {
        const normalized = normalizeRun(run);
        return normalized ? [normalized] : [];
      }).slice(0, MAX_RUN_HISTORY)
    : [];
  return {
    version: PLAYER_PROGRESS_VERSION,
    calibration: normalizeCalibration(progress.calibration),
    runs
  };
};

export const loadPlayerProgress = (storage?: Storage): PlayerProgress => {
  const target = storage || (typeof localStorage !== 'undefined' ? localStorage : undefined);
  if (!target) return { ...EMPTY_PLAYER_PROGRESS, runs: [] };
  try {
    const raw = target.getItem(PLAYER_PROGRESS_STORAGE_KEY);
    return raw ? normalizePlayerProgress(JSON.parse(raw)) : { ...EMPTY_PLAYER_PROGRESS, runs: [] };
  } catch {
    return { ...EMPTY_PLAYER_PROGRESS, runs: [] };
  }
};

export const savePlayerProgress = (progress: PlayerProgress, storage?: Storage): PlayerProgress => {
  const normalized = normalizePlayerProgress(progress);
  const target = storage || (typeof localStorage !== 'undefined' ? localStorage : undefined);
  try {
    target?.setItem(PLAYER_PROGRESS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Restricted storage must not prevent play.
  }
  return normalized;
};

export const setCalibration = (progress: PlayerProgress, calibration: CalibrationResult): PlayerProgress => ({
  ...normalizePlayerProgress(progress),
  calibration: normalizeCalibration(calibration)
});

export const recordRun = (progress: PlayerProgress, run: RunRecord): PlayerProgress => {
  const normalized = normalizeRun(run);
  if (!normalized) return normalizePlayerProgress(progress);
  const current = normalizePlayerProgress(progress);
  return {
    ...current,
    runs: [normalized, ...current.runs.filter((existing) => existing.id !== normalized.id)].slice(0, MAX_RUN_HISTORY)
  };
};

const average = (values: number[]): number => (
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
);

export const summarizeProgress = (progress: PlayerProgress, now = new Date()): ProgressSummary => {
  const runs = normalizePlayerProgress(progress).runs;
  const recentRuns = runs.slice(0, 8);
  const latestWindow = runs.slice(0, 3);
  const priorWindow = runs.slice(3, 6);
  const shortBaseline = runs.slice(1, 4);
  const todayKey = getLocalDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const validLatestKey = runs[0]?.dateKey;
  const activeStreak = validLatestKey === todayKey || validLatestKey === getLocalDateKey(yesterday);
  const uniqueDates = [...new Set(runs.map((run) => run.dateKey))].sort().reverse();
  let currentStreak = 0;
  if (activeStreak && uniqueDates.length > 0) {
    let cursor = new Date(`${uniqueDates[0]}T12:00:00`);
    for (const dateKey of uniqueDates) {
      if (dateKey !== getLocalDateKey(cursor)) break;
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  return {
    totalRuns: runs.length,
    bestWpm: runs.reduce((best, run) => Math.max(best, run.bestWpm, run.wpm), 0),
    averageWpm: average(recentRuns.map((run) => run.wpm)),
    averageAccuracy: runs.length > 0 ? average(recentRuns.map((run) => run.accuracy)) : 100,
    wpmDelta: priorWindow.length > 0
      ? average(latestWindow.map((run) => run.wpm)) - average(priorWindow.map((run) => run.wpm))
      : shortBaseline.length > 0
        ? runs[0].wpm - average(shortBaseline.map((run) => run.wpm))
        : 0,
    currentStreak,
    hasRunToday: runs.some((run) => run.dateKey === todayKey),
    latestFocus: runs[0]?.focus || null,
    recentRuns
  };
};
