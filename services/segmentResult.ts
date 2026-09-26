import type { GameModifiers, StorySegment } from '../types.ts';
import { measuredAccuracy, measuredWpm, type TypingMeasurement } from './typingMetrics.ts';
import { calculateSegmentCredits, calculateSegmentScore, getBranchPerformance, type BranchThresholds } from './gameRules.ts';
/** One contract for normal lines, decision lead-ins and sector closing lines. */
export function getSegmentResult(measurement: TypingMeasurement, errors: number, segment: StorySegment,
  modifiers: GameModifiers, thresholds: BranchThresholds, overclock: boolean, comboMultiplier: number) {
  const wpm = Math.round(measuredWpm(measurement.characters, measurement.durationMs));
  const reward = { errors, type: segment.type, wpm, overclock, comboMultiplier,
    breachMultiplier: modifiers.breachRewardMultiplier, creditMultiplier: modifiers.creditMultiplier };
  return { wpm, measurement, performance: getBranchPerformance(errors, segment.text.length, thresholds),
    accuracy: measuredAccuracy(measurement.mistakes, measurement.attempts),
    score: calculateSegmentScore(reward), credits: calculateSegmentCredits(reward),
    healing: (errors === 0 ? 1 + modifiers.perfectLineHealth : 0)
      + (modifiers.healthRegenWpmThreshold > 0 && wpm > modifiers.healthRegenWpmThreshold ? modifiers.healthRegenAmount : 0) };
}
