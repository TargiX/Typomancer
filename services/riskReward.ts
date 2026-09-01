/**
 * RISK AND REWARD — keeping the pressure buyable but not free.
 *
 * Every permanent upgrade in the shop makes the game easier: more health, more
 * Energy, longer Focus, and a slower Security Trace. For a skill trainer that is
 * backwards. The player who has run a hundred sectors — the one who can handle
 * the most pressure — ends up facing the least of it, and the chase the whole
 * game is built around can be shopped away for good.
 *
 * Two rules fix that without taking the upgrade off the shelf:
 *
 * 1. A floor the chase can never drop below, applied last so nothing multiplies
 *    underneath it.
 * 2. Comfort costs income. Buying trace easing lowers the payout, so the calm
 *    build is a genuine choice rather than a strictly better one.
 *
 * The difficulty preset is deliberately exempt from rule 2. It is fitted to a
 * player's measured pace as an accommodation, not bought with credits, and
 * charging a beginner for it would be charging them for being a beginner.
 */

/**
 * The slowest the Security Trace may ever run, as a fraction of its base pace.
 * Below roughly this the tracer stops being a threat and the line is just a
 * transcription exercise.
 */
export const MIN_TRACE_SPEED_MULTIPLIER = 0.5;

/**
 * Applied after perks, not before. The old clamp sat before perk application, so
 * a Ghost Protocol tier multiplied straight through it and the floor bounded
 * nothing at all.
 */
export const clampTraceSpeed = (multiplier: number): number => {
  if (!Number.isFinite(multiplier)) return 1;
  return Math.max(MIN_TRACE_SPEED_MULTIPLIER, multiplier);
};

/** Payout retained when trace easing is fully bought out. */
export const MAX_COMFORT_PENALTY = 0.25;

/**
 * Credit multiplier for how much permanent trace easing the player has bought.
 * A full investment keeps the game calmer for good and pays a quarter less for
 * it, forever.
 */
export const getComfortCreditMultiplier = (dampenerLevel: number, maxLevel: number): number => {
  if (maxLevel <= 0) return 1;
  const owned = Math.max(0, Math.min(maxLevel, dampenerLevel));
  return 1 - (MAX_COMFORT_PENALTY * (owned / maxLevel));
};
