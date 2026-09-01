/**
 * THE FORK REVEAL — showing the player the branch they just took.
 *
 * The game's central promise is that the story answers to how you type, and
 * mechanically it always did: your error count on a line picks which of three
 * written continuations you get. But the player never saw the choice happen.
 * They typed, the story continued, and the only feedback was a meter twitching.
 * A consequence nobody can perceive is not a consequence, it is just text.
 *
 * The engine is holding all three continuations in memory at that moment, so it
 * can show the line the player missed. That turns an invisible rule into the
 * most direct argument the game can make for typing accurately.
 */

import type { BranchingStory, Language } from '../types.ts';

export type BeatPerformance = 'good' | 'average' | 'bad';

const MAX_MISSED_CHARS = 110;

export interface ForkReveal {
  performance: BeatPerformance;
  errors: number;
  /** The line clean typing would have earned. Absent when the player earned it. */
  missedText?: string;
}

const condense = (text: string): string => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_MISSED_CHARS) return clean;
  return `${clean.slice(0, MAX_MISSED_CHARS - 1).trimEnd()}…`;
};

/**
 * Only a player who lost something is shown what they lost. Telling someone who
 * typed the line perfectly what they "missed" would be both false and deflating.
 */
export const buildForkReveal = (
  branch: BranchingStory | null,
  performance: BeatPerformance,
  errors: number
): ForkReveal => {
  if (performance === 'good' || !branch?.goodPath?.text) {
    return { performance, errors: Math.max(0, errors) };
  }
  return {
    performance,
    errors: Math.max(0, errors),
    missedText: condense(branch.goodPath.text)
  };
};

interface ForkCopy {
  verdict: string;
  detail: string;
  missedLabel: string;
}

const COPY: Record<BeatPerformance, Record<Language, { verdict: string; detail: string }>> = {
  good: {
    en: { verdict: 'CLEAN LINE', detail: 'The story took the best turn open to it.' },
    ru: { verdict: 'ЧИСТАЯ СТРОКА', detail: 'История свернула в лучшую из возможных сторон.' }
  },
  average: {
    en: { verdict: 'MESSY LINE', detail: 'You got through, but not the way you wanted.' },
    ru: { verdict: 'ШУМНАЯ СТРОКА', detail: 'Ты прошёл, но не так, как хотел.' }
  },
  bad: {
    en: { verdict: 'LINE BLOWN', detail: 'The story turned against you.' },
    ru: { verdict: 'СТРОКА СОРВАНА', detail: 'История повернулась против тебя.' }
  }
};

const MISSED_LABEL: Record<Language, string> = {
  en: 'What a clean line would have given you',
  ru: 'Что дала бы чистая строка'
};

export const describeFork = (reveal: ForkReveal, language: Language): ForkCopy => ({
  verdict: COPY[reveal.performance][language].verdict,
  detail: COPY[reveal.performance][language].detail,
  missedLabel: MISSED_LABEL[language]
});

/** How long the reveal stays up. Long enough to read one line, short enough to stay out of the way. */
export const FORK_REVEAL_MS = 3200;
