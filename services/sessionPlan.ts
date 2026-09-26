import type { StoryGenreId } from '../types.ts';
import type { PerkGroupId } from './genreSkin.ts';
import { GENRE_ORDER } from './genreConfig.ts';
import type { TypingFocus } from './gameRules.ts';
import type { PlayerProgress, RunRecord } from './playerProgress.ts';

// "Play" builds the session for the player instead of asking them to: a world
// by rotation, a starter perk that rewards the thing they are training, and the
// focus their last debrief named, measured again at the end.

export type SessionGoalMetric = 'accuracy' | 'consistency' | 'wpm';

export interface SessionGoal {
  focus: TypingFocus;
  metric: SessionGoalMetric;
  /** Mean of the metric over recent runs; null when there is no history yet. */
  before: number | null;
}

export type SessionPlan =
  | { kind: 'prologue' }
  | {
      kind: 'campaign';
      genre: StoryGenreId;
      perk: PerkGroupId;
      goal: SessionGoal;
      weakPairs: string[];
      paceWpm: number | null;
    };

const RECENT_RUNS = 3;

const FOCUS_METRIC: Record<TypingFocus, SessionGoalMetric> = {
  accuracy: 'accuracy',
  consistency: 'consistency',
  speed: 'wpm',
  mastery: 'wpm'
};

// Each focus gets the starter perk that pays out for doing that thing well.
export const FOCUS_PERK: Record<TypingFocus, PerkGroupId> = {
  accuracy: 'titanium_firewall',
  consistency: 'critical_override',
  speed: 'adrenaline_spike',
  mastery: 'ghost_protocol'
};

const isCampaignRun = (run: RunRecord) => !run.daily && run.mission !== 'last_relay';

/** The world the player has gone longest without: never-played first, in menu order. */
export const pickRotationGenre = (runs: RunRecord[]): StoryGenreId => {
  const lastPlayed = new Map<StoryGenreId, string>();
  for (const run of runs) {
    if (!isCampaignRun(run)) continue;
    const seen = lastPlayed.get(run.genre);
    if (!seen || run.endedAt > seen) lastPlayed.set(run.genre, run.endedAt);
  }
  let best: StoryGenreId = GENRE_ORDER[0];
  let bestSeen: string | undefined = lastPlayed.get(best);
  for (const genre of GENRE_ORDER) {
    const seen = lastPlayed.get(genre);
    if (seen === undefined) return genre;
    if (bestSeen !== undefined && seen < bestSeen) {
      best = genre;
      bestSeen = seen;
    }
  }
  return best;
};

const metricOf = (run: RunRecord, metric: SessionGoalMetric): number => (
  metric === 'wpm' ? run.wpm : metric === 'accuracy' ? run.accuracy : run.consistency
);

/** `runs` should be comparable runs (same language and conditions), newest first. */
export const buildSessionGoal = (runs: RunRecord[]): SessionGoal => {
  // The latest debrief named the focus.
  const focus: TypingFocus = runs[0]?.focus ?? 'accuracy';
  const metric = FOCUS_METRIC[focus];
  const recent = runs.slice(0, RECENT_RUNS);
  const before = recent.length
    ? recent.reduce((sum, run) => sum + metricOf(run, metric), 0) / recent.length
    : null;
  return { focus, metric, before };
};

// Pairs due for spaced review come before merely weak ones.
export const pickSessionPairs = (due: string[], weak: string[]): string[] => (
  [...new Set([...due, ...weak])].slice(0, 2)
);

export const planSession = ({
  progress,
  comparableRuns,
  leadWithPrologue,
  weakPairs,
  paceWpm
}: {
  progress: PlayerProgress;
  comparableRuns: RunRecord[];
  leadWithPrologue: boolean;
  weakPairs: string[];
  paceWpm: number | null;
}): SessionPlan => {
  if (leadWithPrologue) return { kind: 'prologue' };
  const goal = buildSessionGoal(comparableRuns);
  return {
    kind: 'campaign',
    genre: pickRotationGenre(progress.runs),
    perk: FOCUS_PERK[goal.focus],
    goal,
    weakPairs: weakPairs.slice(0, 2),
    paceWpm: comparableRuns.length && paceWpm && paceWpm > 0 ? Math.round(paceWpm) : null
  };
};

/** How this session moved the goal metric. `better` is true when it improved or held a strong mark. */
export const scoreSessionGoal = (goal: SessionGoal, after: number): { before: number | null; after: number; better: boolean } => {
  const rounded = Math.round(after);
  if (goal.before === null) return { before: null, after: rounded, better: true };
  const before = Math.round(goal.before);
  return { before, after: rounded, better: rounded >= before };
};
