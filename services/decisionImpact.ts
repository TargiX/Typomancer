/**
 * DECISION IMPACT — what a tactical choice actually costs, before you commit.
 *
 * The mid-sector decision is the one place the player makes an explicit choice,
 * and it was blind. The card showed `preview`, which is flavour — a terminal
 * command, a whispered line — while the numbers that decide the rest of the run
 * were only described *after* the choice was locked in. A choice whose price you
 * learn afterwards is not a decision, it is a coin toss with narration.
 *
 * This turns an impact into a readable row of chips, each carrying whether it is
 * good or bad news for the player, so the trade is visible at a glance.
 */

import type { DecisionImpact } from '../types.ts';

export type ImpactTone = 'good' | 'bad';

export interface ImpactChip {
  key: string;
  label: string;
  value: number;
  suffix: string;
  tone: ImpactTone;
}

export interface ImpactLabels {
  heat: string;
  trust: string;
  evidence: string;
  trace: string;
  health: string;
  credits: string;
}

/**
 * Which direction is good news, per meter. Heat and Security Trace are the two
 * that read backwards: more of them is worse, so a positive delta is bad news.
 */
const RISING_IS_GOOD: Record<keyof ImpactLabels, boolean> = {
  heat: false,
  trace: false,
  trust: true,
  evidence: true,
  health: true,
  credits: true
};

const SUFFIX: Partial<Record<keyof ImpactLabels, string>> = {
  heat: '%',
  trace: '%'
};

/** Ordered so the cost of a choice reads before its reward. */
const ORDER: Array<keyof ImpactLabels> = ['heat', 'trace', 'trust', 'evidence', 'health', 'credits'];

export const getDecisionImpactChips = (
  impact: DecisionImpact | undefined,
  labels: ImpactLabels
): ImpactChip[] => {
  if (!impact) return [];
  return ORDER
    .map((key) => ({ key, value: Number(impact[key] ?? 0) }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value !== 0)
    .map(({ key, value }) => ({
      key,
      label: labels[key],
      value,
      suffix: SUFFIX[key] ?? '',
      tone: (value > 0) === RISING_IS_GOOD[key] ? 'good' : 'bad' as ImpactTone
    }));
};

export const formatImpactValue = (chip: ImpactChip): string => (
  `${chip.value > 0 ? '+' : ''}${chip.value}${chip.suffix}`
);

/**
 * Bounds for a generated impact.
 *
 * The story generator invents these numbers, and once they are shown on the card
 * a bad one is visible to the player: a live run produced CREDITS +500 for a
 * single choice, against shop upgrades that cost 100-220. Clamping keeps a
 * choice meaningful without letting one roll of the model rewrite the economy or
 * end a run outright.
 */
const IMPACT_BOUNDS: Record<keyof ImpactLabels, { min: number; max: number }> = {
  heat: { min: -20, max: 30 },
  trace: { min: -25, max: 25 },
  trust: { min: -20, max: 20 },
  evidence: { min: -5, max: 20 },
  health: { min: -8, max: 8 },
  credits: { min: 0, max: 120 }
};

export const clampDecisionImpact = (impact: DecisionImpact | undefined): DecisionImpact => {
  if (!impact) return {};
  const clamped: DecisionImpact = { ...impact };
  (Object.keys(IMPACT_BOUNDS) as Array<keyof ImpactLabels>).forEach((key) => {
    const raw = Number(impact[key]);
    if (!Number.isFinite(raw)) {
      delete clamped[key];
      return;
    }
    const { min, max } = IMPACT_BOUNDS[key];
    clamped[key] = Math.max(min, Math.min(max, Math.round(raw)));
  });
  return clamped;
};
