export const SECTOR_ROUNDS = 7;
export const DECISION_ROUND = 4;
export const CAMPAIGN_SECTORS = 4;

export interface RoundMetric {
  wpm: number;
  mistakes: number;
  score: number;
  characters: number;
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

  const avgWpm = rounds.reduce((sum, round) => sum + round.wpm, 0) / rounds.length;
  const totalMistakes = rounds.reduce((sum, round) => sum + round.mistakes, 0);
  const score = rounds.reduce((sum, round) => sum + round.score, 0);
  const characters = rounds.reduce((sum, round) => sum + round.characters, 0);
  const variance = rounds.reduce((sum, round) => sum + ((round.wpm - avgWpm) ** 2), 0) / rounds.length;
  const deviation = Math.sqrt(variance);

  return {
    avgWpm,
    totalMistakes,
    score,
    accuracy: characters > 0 ? clamp(100 - ((totalMistakes / characters) * 100)) : 100,
    consistency: avgWpm > 0 ? clamp(100 - ((deviation / avgWpm) * 100)) : 100
  };
};

export const getTypingFocus = ({ avgWpm, accuracy, consistency }: SectorSummary): TypingFocus => {
  if (accuracy < 96) return 'accuracy';
  if (consistency < 82) return 'consistency';
  if (avgWpm < 55) return 'speed';
  return 'mastery';
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

type SegmentKind = 'NARRATIVE' | 'BREACH' | 'DIALOG' | 'SIGNAL';

interface SegmentRewardInput {
  errors: number;
  type: SegmentKind;
  wpm?: number;
  overclock?: boolean;
  breachMultiplier?: number;
  creditMultiplier?: number;
}

export const calculateSegmentScore = ({
  errors,
  type,
  wpm = 0,
  overclock = false,
  breachMultiplier = 1
}: SegmentRewardInput): number => {
  let score = Math.max(0, 12 - (errors * 2));
  if (type === 'BREACH' && errors <= 2) score += Math.round(5 * breachMultiplier);
  if (type === 'SIGNAL' && errors <= 1) score += 3;
  if (wpm > 70 && errors <= 1) score += 4;
  return overclock ? score * 2 : score;
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
