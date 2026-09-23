import { z } from 'zod/mini';

/* zod/mini keeps the whole validator out of the eager bundle: the classic
   build cost ~250KB pre-minification for one schema file. The API differs —
   constraints are `.check(...)` combinators, not chainable methods. */
const count = z.number().check(z.int(), z.minimum(0), z.maximum(1e12));
const percent = z.number().check(z.minimum(0), z.maximum(100));
const speed = z.number().check(z.minimum(0), z.maximum(10000));
const genre = z.enum(['cyberpunk', 'space_horror', 'noir', 'dark_fable', 'dead_channel']);
const pact = z.array(z.enum(['strict_case', 'no_grace', 'hunted', 'exacting', 'hot_start'])).check(z.maxLength(5));
const date = z.iso.datetime();
const calibration = z.object({
  wpm: speed, accuracy: percent, durationMs: count, completedAt: date,
  preset: z.enum(['guided', 'balanced', 'intense'])
});
export const runSchema = z.object({
  id: z.string().check(z.minLength(1), z.maxLength(120)), endedAt: date,
  dateKey: z.string().check(z.regex(/^\d{4}-\d{2}-\d{2}$/)),
  outcome: z.enum(['victory', 'defeat', 'banked']), daily: z.boolean(), genre,
  level: z.number().check(z.int(), z.minimum(1), z.maximum(100)), score: count, wpm: speed, bestWpm: speed,
  accuracy: percent, consistency: percent, mistakes: count, characters: count, durationSeconds: count,
  focus: z.enum(['accuracy', 'consistency', 'speed', 'mastery']), pact
});
const pattern = z.object({
  token: z.string().check(z.minLength(1), z.maxLength(2)), attempts: count, errors: count,
  totalLatencyMs: count, timedAttempts: z.optional(count)
});
const upgrade = z.number().check(z.int(), z.minimum(0), z.maximum(100));
export const snapshotSchema = z.object({
  version: z.literal(1),
  profile: z.object({
    totalXp: count, stealthLevel: count, credits: count,
    unlockedPerks: z.array(z.string().check(z.maxLength(100))).check(z.maxLength(100)),
    upgrades: z.object({ synapticWeave: upgrade, cryptoMiner: upgrade, signalDampener: upgrade,
      bufferExpansion: upgrade, focusLens: upgrade, patternScanner: upgrade }),
    language: z.enum(['en', 'ru']), strictCase: z.boolean(), pact,
    lastGenre: z.optional(genre)
  }),
  progress: z.object({ version: z.literal(1), calibration: z.nullable(calibration), runs: z.array(runSchema).check(z.maxLength(60)) }),
  training: z.object({ version: z.literal(1), samples: count,
    keys: z.array(pattern).check(z.maxLength(64)), bigrams: z.array(pattern).check(z.maxLength(64)),
    benchmarks: z.array(z.object({ kind: z.enum(['calibration', 'drill', 'run']),
      wpm: speed, accuracy: percent, completedAt: date })).check(z.maxLength(12)) }),
  daily: z.record(z.string().check(z.regex(/^nfDaily:[a-zA-Z0-9_-]{1,80}$/)), z.object({
    attemptsUsed: count, bestScore: count, bestEnding: z.nullable(z.string().check(z.maxLength(500)))
  })).check(z.refine(value => Object.keys(value).length <= 31))
});
export type ProgressSnapshot = z.infer<typeof snapshotSchema>;
export const saveRequestSchema = z.object({
  userId: z.string().check(z.minLength(1), z.maxLength(128)),
  revision: z.number().check(z.int(), z.minimum(0), z.maximum(Number.MAX_SAFE_INTEGER - 1)),
  mutationId: z.uuid(), snapshot: snapshotSchema
});
