import type { CadenceMeasurement } from './typingMetrics.ts';
export const SECTOR_ROUNDS = 7;
export const DECISION_ROUND = 4;
export const CAMPAIGN_SECTORS = 4;

export interface RoundMetric {
  cadence?: CadenceMeasurement;
  wpm: number;
  mistakes: number;
  score: number;
  characters: number;
  attempts?: number;
  durationMs?: number;
}

export interface SectorSummary {
  avgWpm: number;
  totalMistakes: number;
  score: number;
  accuracy: number;
  consistency: number;
}

export type TypingFocus = 'accuracy' | 'consistency' | 'speed' | 'mastery';
export type ActiveTypingSkill = 'firewall' | 'purge' | 'focus';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export const summarizeSector = (rounds: RoundMetric[]): SectorSummary => {
  if (rounds.length === 0) {
    return { avgWpm: 0, totalMistakes: 0, score: 0, accuracy: 100, consistency: 100 };
  }

  // Old saves have no duration. Reconstruct it from characters and speed rather
  // than giving a two-second line the same weight as a two-minute passage.
  const durations = rounds.map((round) => round.durationMs
    ?? (round.wpm > 0 ? round.characters * 12_000 / round.wpm : 0));
  const durationMs = durations.reduce((sum, duration) => sum + duration, 0);
  const characters = rounds.reduce((sum, round) => sum + round.characters, 0);
  const avgWpm = durationMs > 0 ? characters * 12_000 / durationMs : 0;
  const totalMistakes = rounds.reduce((sum, round) => sum + round.mistakes, 0);
  const score = rounds.reduce((sum, round) => sum + round.score, 0);
  const attempts = rounds.reduce((sum, round) => sum + (round.attempts ?? round.characters), 0);
  const variance = durationMs > 0 ? rounds.reduce((sum, round, index) =>
    sum + ((round.wpm - avgWpm) ** 2) * durations[index], 0) / durationMs : 0;
  const deviation = Math.sqrt(variance);
  const cadence = rounds.reduce((sum, r) => ({ count: sum.count + (r.cadence?.count || 0), sumMs: sum.sumMs + (r.cadence?.sumMs || 0), sumSquaresMs: sum.sumSquaresMs + (r.cadence?.sumSquaresMs || 0) }), { count: 0, sumMs: 0, sumSquaresMs: 0 });
  const meanInterval = cadence.count ? cadence.sumMs / cadence.count : 0;
  const keyConsistency = meanInterval > 0 ? clamp(100 - Math.sqrt(Math.max(0, cadence.sumSquaresMs / cadence.count - meanInterval ** 2)) / meanInterval * 100) : null;

  return {
    avgWpm,
    totalMistakes,
    score,
    accuracy: attempts > 0 ? clamp(100 - ((totalMistakes / attempts) * 100)) : 100,
    consistency: cadence.count >= 6 && keyConsistency !== null ? keyConsistency : avgWpm > 0 ? clamp(100 - ((deviation / avgWpm) * 100)) : 100
  };
};

export const getTypingFocus = ({ avgWpm, accuracy, consistency }: SectorSummary): TypingFocus => {
  if (accuracy < 96) return 'accuracy';
  if (consistency < 82) return 'consistency';
  if (avgWpm < 55) return 'speed';
  return 'mastery';
};

export type BranchPerformance = 'good' | 'average' | 'bad';

/**
 * Which of the three written continuations the player earned.
 *
 * This used to be an absolute error count — 1 for good, 4 for average — which
 * gave an eight-word line and a twenty-word line the same budget, and put the
 * "bad" branch out of practical reach: 5 typos in a hundred characters is 95%
 * accuracy, so most players ping-ponged between two of the three branches and
 * the third was written for nobody.
 *
 * It is now proportional, which tightens short lines and makes the bad branch
 * reachable, with a flat allowance so a single typo never costs the good branch
 * on any length. The bands sit in the 96-100% range because that is where the
 * skill this game trains actually lives.
 */
export const GOOD_BRANCH_ACCURACY = 98.5;
export const AVERAGE_BRANCH_ACCURACY = 96;
export const FORGIVEN_ERRORS_PER_LINE = 1;

export interface BranchThresholds {
  good: number;
  average: number;
  /** Errors that never cost the good branch. The Exacting clause spends this. */
  forgiven: number;
}

export const DEFAULT_BRANCH_THRESHOLDS: BranchThresholds = {
  good: GOOD_BRANCH_ACCURACY,
  average: AVERAGE_BRANCH_ACCURACY,
  forgiven: FORGIVEN_ERRORS_PER_LINE
};

export const getBranchPerformance = (
  mistakes: number,
  characters: number,
  thresholds: BranchThresholds = DEFAULT_BRANCH_THRESHOLDS
): BranchPerformance => {
  const errors = Math.max(0, mistakes);
  if (errors <= thresholds.forgiven) return 'good';
  // Accuracy is undefined without a line to measure against, and getTypingAccuracy
  // reports a perfect 100 for it — which would turn any error count into a clean
  // branch. Past the flat allowance, the errors are real and the excuse is not.
  if (characters <= 0) return 'bad';
  const accuracy = getTypingAccuracy(errors, characters);
  if (accuracy >= thresholds.good) return 'good';
  if (accuracy >= thresholds.average) return 'average';
  return 'bad';
};

export const getTypingAccuracy = (mistakes: number, characters: number): number => (
  characters > 0 ? clamp(100 - ((Math.max(0, mistakes) / characters) * 100)) : 100
);

export const getReadyActiveSkills = (
  charge: number,
  maxCharge: number,
  focusActive = false
): ActiveTypingSkill[] => {
  if (focusActive || maxCharge <= 0) return [];
  const ready: ActiveTypingSkill[] = [];
  if (charge >= Math.round(maxCharge * 0.4)) ready.push('firewall');
  if (charge >= Math.round(maxCharge * 0.55)) ready.push('purge');
  if (charge >= maxCharge) ready.push('focus');
  return ready;
};

/**
 * Only the skills the player can actually spend Energy on right now. A key you
 * cannot press is noise next to the caret, and the Energy rail already shows
 * what is coming.
 *
 * Rendered top-to-bottom, so this is reversed against the cost order: the
 * cheapest unlock sits nearest the caret and every later unlock stacks above
 * it. Nothing below a new arrival ever moves, which is the layout stability the
 * old permanent Focus anchor was there to provide.
 */
export const getCursorSkillStack = (
  charge: number,
  maxCharge: number,
  focusActive = false
): ActiveTypingSkill[] => {
  if (maxCharge <= 0) return [];
  return [...getReadyActiveSkills(charge, maxCharge, focusActive)].reverse();
};

type SegmentKind = 'NARRATIVE' | 'BREACH' | 'DIALOG' | 'SIGNAL';

interface SegmentRewardInput {
  errors: number;
  type: SegmentKind;
  wpm?: number;
  overclock?: boolean;
  breachMultiplier?: number;
  creditMultiplier?: number;
  comboMultiplier?: number;
}

/**
 * Combo counts unbroken correct keystrokes and survives across segments, so this
 * ladder rewards sustained clean typing rather than one lucky line. It scales
 * score (and through it XP and Stealth Level) but deliberately not credits —
 * the shop economy is already generous and a 3x on top would flatten it.
 */
export const getComboMultiplier = (combo: number): number => {
  if (combo >= 50) return 3;
  if (combo >= 25) return 2;
  if (combo >= 10) return 1.5;
  return 1;
};

export const calculateSegmentScore = ({
  errors,
  type,
  wpm = 0,
  overclock = false,
  breachMultiplier = 1,
  comboMultiplier = 1
}: SegmentRewardInput): number => {
  let score = Math.max(0, 12 - (errors * 2));
  if (type === 'BREACH' && errors <= 2) score += Math.round(5 * breachMultiplier);
  if (type === 'SIGNAL' && errors <= 1) score += 3;
  if (wpm > 70 && errors <= 1) score += 4;
  if (overclock) score *= 2;
  return Math.round(score * Math.max(1, comboMultiplier));
};

export const calculateSegmentCredits = ({
  errors,
  type,
  overclock = false,
  breachMultiplier = 1,
  creditMultiplier = 1
}: SegmentRewardInput): number => {
  const performanceReward = errors <= 1 ? 18 : errors <= 4 ? 12 : 6;
  const typeMultiplier = type === 'BREACH' ? breachMultiplier : 1;
  const focusMultiplier = overclock ? 2 : 1;
  return Math.round(performanceReward * typeMultiplier * focusMultiplier * creditMultiplier);
};

export const isLowHealth = (health: number, maxHealth: number): boolean => (
  maxHealth > 0 && (health / maxHealth) <= 0.3
);

export const getStealthLevel = (totalXp: number): number => (
  Math.max(0, Math.floor(totalXp / 500))
);
