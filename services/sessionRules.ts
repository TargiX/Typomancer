import { DEFAULT_MODIFIERS } from './perks.ts';
import type { RunContext } from './runCheckpoint.ts';
export const DAILY_RULESET = 'daily-v2';
export type SessionRules = Pick<RunContext, 'campaignGoal' | 'language' | 'pact' | 'strictCase' | 'relaxed' | 'baselineWpm' | 'stealthLevel' | 'modifiers'>;
/** A Daily starts under identical conditions in each language. Earned perks are still player choices. */
export function freezeSessionRules(rules: SessionRules, daily: boolean): SessionRules {
  return daily ? { campaignGoal: 'flow', language: rules.language, pact: [], strictCase: false, relaxed: false, baselineWpm: 50, stealthLevel: 0,
    modifiers: { ...DEFAULT_MODIFIERS, traceSpeedMultiplier: 0.88, mistakeGraceCount: 1 } }
    : { ...rules, pact: [...rules.pact], modifiers: { ...rules.modifiers } };
}
