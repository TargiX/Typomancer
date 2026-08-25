/**
 * SECTOR RHYTHM — the shape of a sector, as a curve rather than a flat line.
 *
 * A sector was seven interchangeable beats: read a line of roughly the same
 * length, type it, watch a meter twitch, repeat. Pressure drifted upward a
 * little because it was derived from Heat, but nothing about the last round felt
 * different from the first, and the round that was supposed to be a climax was
 * just another sentence.
 *
 * This gives every round an authored role. Lines start short while the player
 * settles, lengthen as the scene builds, and the closing round is a long line
 * under maximum pressure — the "hold your nerve" moment the sector never had.
 * Because the curve is deterministic it escalates whether or not the generator
 * cooperates, which the old Heat-derived pressure could not promise: a player
 * running clean kept Heat low and so never felt the sector tighten at all.
 */

export type SectorBeat = 'establish' | 'build' | 'turn' | 'escalate' | 'climax';

export interface RoundShape {
  beat: SectorBeat;
  /** Word budget handed to the story generator for this round's line. */
  minWords: number;
  maxWords: number;
  /** Authored pressure, 1-5. Feeds trace speed, tracer speed and Heat deltas. */
  pressure: number;
  /** True for the closing round, which is the sector's test of nerve. */
  isClimax: boolean;
}

interface BeatTemplate {
  beat: SectorBeat;
  minWords: number;
  maxWords: number;
  pressure: number;
}

/**
 * Positions are expressed as a fraction of the sector so the curve survives a
 * change to SECTOR_ROUNDS instead of silently losing its climax.
 */
const CURVE: Array<{ upTo: number } & BeatTemplate> = [
  { upTo: 0.30, beat: 'establish', minWords: 9, maxWords: 13, pressure: 1 },
  { upTo: 0.45, beat: 'build', minWords: 13, maxWords: 18, pressure: 2 },
  { upTo: 0.60, beat: 'turn', minWords: 15, maxWords: 20, pressure: 2 },
  { upTo: 0.80, beat: 'build', minWords: 18, maxWords: 24, pressure: 3 },
  { upTo: 0.95, beat: 'escalate', minWords: 22, maxWords: 30, pressure: 4 },
  { upTo: Infinity, beat: 'climax', minWords: 28, maxWords: 38, pressure: 5 }
];

const clampPressure = (value: number) => Math.max(1, Math.min(5, Math.round(value)));

/**
 * @param level Campaign sector, 1-based. Later sectors open tighter than earlier
 *              ones, so the curve restarts higher rather than resetting flat.
 */
export const getRoundShape = (round: number, sectorRounds: number, level = 1): RoundShape => {
  const totalRounds = Math.max(1, sectorRounds);
  const safeRound = Math.max(1, Math.min(totalRounds, Math.round(round)));
  // The opening round is always the gentlest, whatever the sector length. Its job
  // — let the player find the rhythm before anything closes in — does not go away
  // just because there are fewer rounds to spread the curve across.
  const position = safeRound === 1 ? 0 : safeRound / totalRounds;
  const template = CURVE.find((entry) => position <= entry.upTo) ?? CURVE[CURVE.length - 1];

  return {
    beat: template.beat,
    minWords: template.minWords,
    maxWords: template.maxWords,
    pressure: clampPressure(template.pressure + Math.floor(Math.max(0, level - 1) / 2)),
    isClimax: safeRound === totalRounds
  };
};

const BEAT_DIRECTION: Record<SectorBeat, string> = {
  establish: 'Open the scene. Let the player settle into the rhythm before anything closes in.',
  build: 'Tighten the scene. Something is moving that was not moving before.',
  turn: 'The scene pivots on what the player just committed to.',
  escalate: 'Raise the stakes hard. The way out is narrowing.',
  climax: 'This is the closing beat of the sector: the hardest moment, and the longest line. Make it the one they will remember.'
};

export const getBeatDirection = (beat: SectorBeat): string => BEAT_DIRECTION[beat];
