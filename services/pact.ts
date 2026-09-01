/**
 * THE PACT — the difficulty the player asks for.
 *
 * Every other progression system in this game moves in one direction: perks,
 * upgrades and a rising skill level all make a fixed challenge easier to meet.
 * That is fine while a player is learning and fatal once they have learned,
 * because the game quietly retires itself at exactly the moment it finally has a
 * competent typist to work with.
 *
 * The Pact is the way back up. Each clause makes the run genuinely harder — not
 * noisier — and pays for itself in credits and XP. Nothing here is required, and
 * nothing here is a stat tweak the player cannot feel: a clause either demands
 * more of their hands or takes away a tool they were leaning on.
 */

export type PactClauseId =
  | 'strict_case'
  | 'no_grace'
  | 'hunted'
  | 'exacting'
  | 'hot_start';

export interface PactClause {
  id: PactClauseId;
  /** Added to the reward multiplier when the clause is active. */
  reward: number;
}

/**
 * Ordered from the gentlest step up to the harshest, so the list itself reads as
 * a ladder a player climbs rather than a menu they graze.
 */
export const PACT_CLAUSES: PactClause[] = [
  { id: 'hot_start', reward: 0.15 },
  { id: 'no_grace', reward: 0.20 },
  { id: 'exacting', reward: 0.25 },
  { id: 'strict_case', reward: 0.30 },
  { id: 'hunted', reward: 0.35 }
];

const CLAUSE_IDS = new Set<string>(PACT_CLAUSES.map((clause) => clause.id));

/** Drops anything unknown, so an old or hand-edited profile cannot inject clauses. */
export const normalizePact = (value: unknown): PactClauseId[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<PactClauseId>();
  value.forEach((entry) => {
    if (typeof entry === 'string' && CLAUSE_IDS.has(entry)) seen.add(entry as PactClauseId);
  });
  return PACT_CLAUSES.filter((clause) => seen.has(clause.id)).map((clause) => clause.id);
};

export const isPactClauseActive = (pact: PactClauseId[], id: PactClauseId): boolean => pact.includes(id);

export const togglePactClause = (pact: PactClauseId[], id: PactClauseId): PactClauseId[] => {
  const next = new Set(normalizePact(pact));
  if (next.has(id)) next.delete(id);
  else if (CLAUSE_IDS.has(id)) next.add(id);
  return PACT_CLAUSES.filter((clause) => next.has(clause.id)).map((clause) => clause.id);
};

/**
 * Credits and XP are both scaled by this. A full Pact more than doubles a run's
 * payout, which is what makes taking the hard road the efficient road for a
 * player who can actually hold it.
 */
export const getPactRewardMultiplier = (pact: PactClauseId[]): number => (
  normalizePact(pact).reduce(
    (total, id) => total + (PACT_CLAUSES.find((clause) => clause.id === id)?.reward ?? 0),
    1
  )
);

/** Trace speed multiplier applied on top of everything else by the Hunted clause. */
export const HUNTED_TRACE_MULTIPLIER = 1.35;

/** Heat the Hot Start clause opens a run at, against a default of 18. */
export const HOT_START_HEAT = 45;

/**
 * Accuracy the Exacting clause demands for the good and average branches, against
 * the ordinary 98.5 and 96.
 */
export const EXACTING_GOOD_ACCURACY = 99.5;
export const EXACTING_AVERAGE_ACCURACY = 98;
