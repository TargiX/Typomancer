/**
 * THE TRACER — the Security Trace made visible on the line you are typing.
 *
 * The trace bar alone is a metronome in the corner: it ticks whether or not you
 * engage with it, and it never produces a moment you can see coming. The tracer
 * spends the same pressure on the same world state, but as a second cursor that
 * eats the line from behind. The gap between the burn front and your caret IS
 * your safety margin, drawn where you are already looking.
 *
 * Everything here is pure so the chase can be reasoned about and tested without
 * a browser, a clock, or a React tree.
 */

/**
 * Tracer speed as a fraction of the player's own calibrated pace. Well below 1
 * so typing at your natural speed keeps you comfortably ahead: the tracer
 * punishes hesitation, not slowness in absolute terms.
 */
export const TRACER_CHASE_FACTOR = 0.55;

/**
 * How long the tracer sits still on the first character after you start typing.
 * The head start is spent as visible hesitation rather than as distance off the
 * left edge of the line: a tracer the player cannot see teaches nothing, and
 * being caught by it reads as an unexplained punishment.
 */
export const TRACER_GRACE_MS = 3000;

/** Characters the tracer is thrown back on a catch. */
export const TRACER_CATCH_KNOCKBACK = 14;

/**
 * How long the tracer is stunned after a catch. Knockback alone cannot space out
 * catches near the start of a line, where there is no room behind the caret to
 * throw it into — without this, a player who freezes on character two takes a
 * penalty every half second.
 */
export const TRACER_CATCH_STUN_MS = 2500;

/** Characters the Purge Trace protocol throws the tracer back. */
export const TRACER_PURGE_KNOCKBACK = 25;

/** Characters the tracer loses each time an unbroken streak reaches a new combo tier. */
export const TRACER_TIER_KNOCKBACK = 6;

/**
 * How much a clean streak slows the chase, by combo tier.
 *
 * This is what makes the game an accuracy trainer rather than a speed one. Speed
 * alone already outruns the tracer, so without this the only way to answer
 * pressure is to type faster — which is the opposite of the skill being taught.
 * Here accuracy is the weapon: an unbroken streak buys time, and a single typo
 * hands all of it back at once.
 */
const COMBO_SPEED_SCALE: Record<number, number> = { 0: 1, 1: 0.85, 2: 0.7, 3: 0.55 };

export const getTracerSpeedScale = (comboTier: number): number => (
  COMBO_SPEED_SCALE[Math.max(0, Math.min(3, Math.floor(comboTier)))] ?? 1
);

/** Security Trace added when the tracer reaches your caret. */
export const TRACER_CATCH_TRACE_PENALTY = 12;

/** Used when the player skipped calibration, so we have no measured pace. */
export const DEFAULT_BASELINE_WPM = 40;

const MIN_BASELINE_WPM = 18;
const MAX_BASELINE_WPM = 110;

export interface TracerPressureInput {
  /** The player's calibrated words per minute. */
  baselineWpm: number;
  /** Combined perk, upgrade and difficulty-preset multiplier. */
  traceSpeedMultiplier: number;
  stealthLevel: number;
  heat: number;
  trust: number;
  /** Per-segment authored pressure, 0 for a calm line. */
  segmentPressure: number;
}

/**
 * Mirrors the pressure math the Security Trace bar already uses, so the bar and
 * the tracer are two readings of one threat rather than two systems that can
 * disagree about how much trouble the player is in.
 */
export const getTracerCharsPerSecond = ({
  baselineWpm,
  traceSpeedMultiplier,
  stealthLevel,
  heat,
  trust,
  segmentPressure
}: TracerPressureInput): number => {
  const safeWpm = Math.min(MAX_BASELINE_WPM, Math.max(MIN_BASELINE_WPM, baselineWpm || DEFAULT_BASELINE_WPM));
  const playerCharsPerSecond = (safeWpm * 5) / 60;

  const missionPressure = Math.max(0.45, 1 + (heat / 160) - (trust / 320));
  const linePressure = 1 + (Math.max(0, segmentPressure) * 0.06);
  const stealthDivisor = 1 + (Math.max(0, stealthLevel) * 0.1);

  const speed = playerCharsPerSecond
    * TRACER_CHASE_FACTOR
    * Math.max(0.1, traceSpeedMultiplier)
    * missionPressure
    * linePressure
    / stealthDivisor;

  return Math.max(0.2, speed);
};

/**
 * Where the tracer sits when a segment opens: on the first character, in plain
 * sight, waiting. Every character you type is lead you can watch yourself build.
 */
export const getTracerStartIndex = (): number => 0;

/**
 * The chase begins only once the player has committed a keystroke and spent the
 * grace window. Before that the tracer is present but stationary, so opening a
 * line and reading it costs nothing.
 */
export const isTracerArmed = (msSinceFirstKeystroke: number | null): boolean => (
  msSinceFirstKeystroke !== null && msSinceFirstKeystroke >= TRACER_GRACE_MS
);

export const isTracerStunned = (msSinceCatch: number | null): boolean => (
  msSinceCatch !== null && msSinceCatch < TRACER_CATCH_STUN_MS
);

export const advanceTracer = (
  currentIndex: number,
  deltaMs: number,
  charsPerSecond: number,
  lineLength: number
): number => {
  if (deltaMs <= 0) return currentIndex;
  const next = currentIndex + ((charsPerSecond * deltaMs) / 1000);
  return Math.min(lineLength, next);
};

/**
 * The tracer has caught the player when it reaches the caret. Comparing against
 * the caret (not the line end) is what makes stalling — rather than being slow —
 * the thing that kills you.
 */
export const isTracerCaught = (tracerIndex: number, typedIndex: number): boolean => (
  Math.floor(tracerIndex) >= typedIndex
);

export const knockBackTracer = (tracerIndex: number, characters: number): number => (
  Math.max(getTracerStartIndex(), tracerIndex - Math.max(0, characters))
);

/**
 * How much line is left between the burn front and the caret, in characters.
 * Drives the "closing in" warning styling.
 */
export const getTracerGap = (tracerIndex: number, typedIndex: number): number => (
  typedIndex - Math.floor(tracerIndex)
);

export type TracerThreat = 'clear' | 'closing' | 'critical';

export const getTracerThreat = (tracerIndex: number, typedIndex: number): TracerThreat => {
  const gap = getTracerGap(tracerIndex, typedIndex);
  if (gap <= 5) return 'critical';
  if (gap <= 14) return 'closing';
  return 'clear';
};
