import type { CampaignGoal } from './campaignTraining.ts';
import type { Language, StoryGenreId } from '../types.ts';
import { playerStorage } from './playerStorage.ts';
import type { TypingFocus } from './gameRules.ts';
import { normalizePact, type PactClauseId } from './pact.ts';

export const PLAYER_PROGRESS_STORAGE_KEY = 'typomancerPlayerProgress';
export const PLAYER_PROGRESS_VERSION = 1;
/**
 * Twenty runs is a fortnight of daily play, which is too short a memory for a
 * game whose real reward is watching yourself improve. Sixty costs a few
 * kilobytes of local storage and covers a couple of months.
 */
export const MAX_RUN_HISTORY = 60;

export type DifficultyPreset = 'guided' | 'balanced' | 'intense';

export interface CalibrationResult {
  language?: Language;
  measurementVersion?: 2;
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
  campaignGoal?: CampaignGoal;
  attempts?: number;
  activeDurationMs?: number;
  language?: Language;
  measurementVersion?: 2;
  relaxed?: boolean;
  strictCase?: boolean;
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
  /**
   * Clauses the player took on for this run. Recorded so a hard-won run reads as
   * one afterwards: without it, a full-Pact clear and a default clear are the
   * same row.
   */
  pact: PactClauseId[];
  /** Set for the authored prologue, so the menu knows when to stop leading with it. */
  mission?: 'last_relay';
}

export interface PlayerProgress {
  version: 1;
  calibration: CalibrationResult | null;
  hasMovedPastPrologue: boolean;
  runs: RunRecord[];
  practiceDates?: string[];
  baselines?: Array<{ condition: string; runs: RunRecord[] }>;
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
  hasMovedPastPrologue: false,
  practiceDates: [], baselines: [],
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

/** Runs blended into the live baseline. Enough to be robust, few enough to track. */
export const BASELINE_RUN_WINDOW = 5;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * The pace the game actually measures the player at.
 *
 * Calibration is one 30-second prompt on day one, and it never used to move. The
 * tracer chases at a fraction of it, so a player who improved from 40 to 70 WPM
 * was still being hunted at 40 — the game got permanently easier purely because
 * they got better, which is backwards for a trainer.
 *
 * This tracks real runs instead. Median rather than mean, so one bad session
 * cannot swing it, and it ratchets upward only: run speed is measured under
 * chase pressure and mid-line hesitation counts against it, so letting it drag
 * the baseline down would let a rough patch quietly lower the bar. Coming back
 * down is deliberate — recalibrating from Operator Record resets it.
 */
export const getEffectiveBaseline = (progress: PlayerProgress, language?: Language): { wpm: number; accuracy: number } => {
  const calibration = !language || progress.calibration?.language === language ? progress.calibration : null;
  const base = {
    wpm: calibration?.wpm ?? 0,
    // No calibration means no floor to hold. Defaulting to 100 pinned the ratchet
    // at its maximum and discarded every recorded run's accuracy, so a fast but
    // inaccurate uncalibrated player was graded on speed alone.
    accuracy: calibration?.accuracy ?? 0
  };
  const recent = progress.runs.filter(run => run.wpm > 0
    && (!language || (run.language === language && run.measurementVersion === 2))
    && (!calibration || Date.parse(run.endedAt) > Date.parse(calibration.completedAt)))
    .slice(0, BASELINE_RUN_WINDOW);
  if (!recent.length) return base;

  return {
    wpm: Math.max(base.wpm, Math.round(median(recent.map((run) => run.wpm)))),
    accuracy: Math.max(base.accuracy, Math.round(median(recent.map((run) => run.accuracy))))
  };
};

/**
 * Difficulty follows the live baseline, so a player graduates out of the guided
 * preset by actually improving rather than by remembering to recalibrate.
 */
export const getAdaptiveDifficulty = (
  calibration: CalibrationResult | null,
  progress?: PlayerProgress,
  language?: Language
): AdaptiveDifficulty => {
  const live = progress ? getEffectiveBaseline(progress, language) : null;
  const preset = live && live.wpm > 0
    ? getDifficultyPreset(live.wpm, live.accuracy)
    : (!language || calibration?.language === language ? calibration?.preset : null) || 'balanced';
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
  return { ...createCalibrationResult(
    calibration.wpm,
    calibration.accuracy,
    calibration.durationMs,
    calibration.completedAt
  ), ...(calibration.language === 'en' || calibration.language === 'ru' ? { language: calibration.language } : {}),
    ...(calibration.measurementVersion === 2 ? { measurementVersion: 2 as const } : {}) };
};

const isGenre = (value: unknown): value is StoryGenreId => (
  value === 'cyberpunk' || value === 'space_horror' || value === 'noir' || value === 'dark_fable' || value === 'dead_channel'
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
    ...(run.campaignGoal === 'flow' || run.campaignGoal === 'repair' || run.campaignGoal === 'codes' ? { campaignGoal: run.campaignGoal } : {}),
    ...(run.language === 'en' || run.language === 'ru' ? { language: run.language } : {}),
    ...(run.measurementVersion === 2 ? { measurementVersion: 2 as const } : {}),
    ...(typeof run.relaxed === 'boolean' ? { relaxed: run.relaxed } : {}),
    ...(typeof run.strictCase === 'boolean' ? { strictCase: run.strictCase } : {}),
    ...(typeof run.attempts === 'number' ? { attempts: Math.max(0, Math.round(finite(run.attempts))) } : {}),
    ...(typeof run.activeDurationMs === 'number' ? { activeDurationMs: Math.max(0, Math.round(finite(run.activeDurationMs))) } : {}),
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
    focus: run.focus,
    pact: normalizePact(run.pact),
    ...(run.mission === 'last_relay' ? { mission: 'last_relay' as const } : {})
  };
};

// The flag survives when the run that moved the player past the prologue drops
// out of the bounded history. Runs recorded before tagging count as other modes.
const movesPastPrologue = (run: RunRecord): boolean => (
  run.mission !== 'last_relay' || run.outcome === 'victory'
);

export const shouldLeadWithPrologue = (progress: PlayerProgress): boolean => (
  !progress.hasMovedPastPrologue && progress.runs.every((run) => !movesPastPrologue(run))
);

export const normalizePlayerProgress = (value: unknown): PlayerProgress => {
  if (!value || typeof value !== 'object') return { ...EMPTY_PLAYER_PROGRESS, runs: [] };
  const progress = value as Partial<PlayerProgress>;
  const normalizedRuns = Array.isArray(progress.runs)
    ? progress.runs.flatMap((run) => {
        const normalized = normalizeRun(run);
        return normalized ? [normalized] : [];
      })
    : [];
  return {
    version: PLAYER_PROGRESS_VERSION,
    baselines: Array.isArray(progress.baselines) ? progress.baselines.filter(b => b && typeof b.condition === 'string' && b.condition.length <= 300 && Array.isArray(b.runs)).slice(0, 24).map(b => ({ condition: b.condition, runs: b.runs.flatMap(r => normalizeRun(r) || []).slice(0, 5) })) : [],
    calibration: normalizeCalibration(progress.calibration),
    hasMovedPastPrologue: progress.hasMovedPastPrologue === true || normalizedRuns.some(movesPastPrologue),
    practiceDates: Array.isArray(progress.practiceDates) ? [...new Set(progress.practiceDates.filter(day => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day)))].sort().reverse().slice(0, 90) : [],
    runs: normalizedRuns.slice(0, MAX_RUN_HISTORY)
  };
};

export const loadPlayerProgress = (storage?: Storage): PlayerProgress => {
  const target = storage || playerStorage();
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
  const target = storage || playerStorage();
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
  const baselines = (current.baselines || []).map(b => ({ ...b, runs: [...b.runs] }));
  if (normalized.language && normalized.measurementVersion === 2 && normalized.outcome !== 'banked' && normalized.wpm > 0) {
    const condition = runCondition(normalized);
    let baseline = baselines.find(b => b.condition === condition);
    if (!baseline && baselines.length < 24) {
      baseline = { condition, runs: [...current.runs].reverse().filter(r => r.outcome !== 'banked' && runCondition(r) === condition).slice(0, 5) };
      baselines.push(baseline);
    }
    if (baseline && baseline.runs.length < 5 && !baseline.runs.some(r => r.id === normalized.id)) baseline.runs.push(normalized);
  }
  return {
    ...current, baselines,
    hasMovedPastPrologue: current.hasMovedPastPrologue || movesPastPrologue(normalized),
    runs: [normalized, ...current.runs.filter((existing) => existing.id !== normalized.id)].slice(0, MAX_RUN_HISTORY)
  };
};

const average = (values: number[]): number => (
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
);

export const runCondition = (run: RunRecord) => [run.language, run.measurementVersion, run.campaignGoal || 'flow', run.daily, run.genre, run.mission || '', !!run.strictCase, !!run.relaxed, [...run.pact].sort().join(',')].join('|');

/** Comparisons require the same language and game conditions under the new meter. */
export const getComparableRuns = (progress: PlayerProgress, language?: Language): RunRecord[] => {
  const runs = progress.runs.filter(run => run.wpm > 0 && (!language || (run.language === language && run.measurementVersion === 2)));
  if (!language || !runs.length) return runs;
  const reference = runs[0];
  return runs.filter(run => runCondition(run) === runCondition(reference));
};

export const summarizeProgress = (progress: PlayerProgress, now = new Date(), language?: Language): ProgressSummary => {
  const runs = normalizePlayerProgress(progress).runs;
  const comparable = getComparableRuns(progress, language);
  const recentRuns = comparable.slice(0, 8);
  const latestWindow = comparable.slice(0, 3);
  const priorWindow = comparable.slice(3, 6);
  const shortBaseline = comparable.slice(1, 4);
  const todayKey = getLocalDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const activityDates = [...runs.map(run => run.dateKey), ...(progress.practiceDates || [])];
  const validLatestKey = [...activityDates].sort().reverse()[0];
  const activeStreak = validLatestKey === todayKey || validLatestKey === getLocalDateKey(yesterday);
  const uniqueDates = [...new Set(activityDates)].sort().reverse();
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
        ? comparable[0].wpm - average(shortBaseline.map((run) => run.wpm))
        : 0,
    currentStreak,
    hasRunToday: activityDates.includes(todayKey),
    latestFocus: runs[0]?.focus || null,
    recentRuns: runs.slice(0, 8)
  };
};
