/**
 * MISSION LOG — the narrative memory of a run.
 *
 * This log has two readers and both need the same thing: story facts. The story
 * generator gets it as "recent consequences" so a later beat can echo an earlier
 * failure, and the player gets it as the end-of-run Operation Dossier.
 *
 * It used to hold meter arithmetic — "Clean segment: EVIDENCE +4 · HEAT -3% ·
 * TRUST +2" — which told the generator nothing about what actually happened and
 * gave the player a spreadsheet instead of the story of their run. Meter values
 * are passed to the generator separately and shown in their own UI; they do not
 * belong here.
 */

import type { Language } from '../types.ts';

export type BeatPerformance = 'good' | 'average' | 'bad';

/** Newest first. Entry 0 is the most recent thing that happened. */
export const MAX_CONSEQUENCE_ENTRIES = 7;

const MAX_BEAT_CHARS = 120;

const PERFORMANCE_TAG: Record<BeatPerformance, Record<Language, string>> = {
  good: { en: 'CLEAN', ru: 'ЧИСТО' },
  average: { en: 'MESSY', ru: 'ШУМНО' },
  bad: { en: 'BLOWN', ru: 'ПРОВАЛ' }
};

const DECISION_TAG: Record<Language, string> = { en: 'CHOSE', ru: 'ВЫБОР' };

const condense = (text: string): string => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_BEAT_CHARS) return clean;
  return `${clean.slice(0, MAX_BEAT_CHARS - 1).trimEnd()}…`;
};

/**
 * A beat the player lived through, tagged with how they handled it. The tag is
 * the part the raw story history cannot supply: history says what happened, this
 * says whether the player earned it or survived it.
 */
export const describeSegmentBeat = (
  text: string,
  performance: BeatPerformance,
  language: Language
): string => `${PERFORMANCE_TAG[performance][language]}: ${condense(text)}`;

export const describeDecisionBeat = (choiceText: string, language: Language): string => (
  `${DECISION_TAG[language]}: ${condense(choiceText)}`
);

export const appendConsequence = (log: string[], entry: string): string[] => (
  [entry, ...log].slice(0, MAX_CONSEQUENCE_ENTRIES)
);

/**
 * The most recent entries, oldest-to-newest so they read as a sequence.
 *
 * The log is stored newest-first, which is what the dossier UI wants. The story
 * prompt asked for `.slice(-3)` and so was handed the three *oldest* entries
 * under the label "recent consequences" — the generator was reacting to the
 * start of the sector while the player was living its climax.
 */
export const getRecentConsequences = (log: string[], count: number): string[] => (
  log.slice(0, Math.max(0, count)).reverse()
);
