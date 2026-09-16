import { z } from 'zod';

const count = z.number().int().min(0).max(1e12);
const percent = z.number().min(0).max(100);
const speed = z.number().min(0).max(10000);
const genre = z.enum(['cyberpunk', 'space_horror', 'noir', 'dark_fable']);
const pact = z.array(z.enum(['strict_case', 'no_grace', 'hunted', 'exacting', 'hot_start'])).max(5);
const date = z.string().datetime();
const calibration = z.object({
  wpm: speed, accuracy: percent, durationMs: count, completedAt: date,
  preset: z.enum(['guided', 'balanced', 'intense'])
});
export const runSchema = z.object({
  id: z.string().min(1).max(120), endedAt: date, dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  outcome: z.enum(['victory', 'defeat', 'banked']), daily: z.boolean(), genre,
  level: z.number().int().min(1).max(100), score: count, wpm: speed, bestWpm: speed,
  accuracy: percent, consistency: percent, mistakes: count, characters: count, durationSeconds: count,
  focus: z.enum(['accuracy', 'consistency', 'speed', 'mastery']), pact
});
const pattern = z.object({
  token: z.string().min(1).max(2), attempts: count, errors: count,
  totalLatencyMs: count, timedAttempts: count.optional()
});
const upgrade = z.number().int().min(0).max(100);
export const snapshotSchema = z.object({
  version: z.literal(1),
  profile: z.object({
    totalXp: count, stealthLevel: count, credits: count,
    unlockedPerks: z.array(z.string().max(100)).max(100),
    upgrades: z.object({ synapticWeave: upgrade, cryptoMiner: upgrade, signalDampener: upgrade,
      bufferExpansion: upgrade, focusLens: upgrade, patternScanner: upgrade }),
    language: z.enum(['en', 'ru']), strictCase: z.boolean(), pact,
    lastGenre: genre.optional()
  }),
  progress: z.object({ version: z.literal(1), calibration: calibration.nullable(), runs: z.array(runSchema).max(60) }),
  training: z.object({ version: z.literal(1), samples: count,
    keys: z.array(pattern).max(64), bigrams: z.array(pattern).max(64),
    benchmarks: z.array(z.object({ kind: z.enum(['calibration', 'drill', 'run']),
      wpm: speed, accuracy: percent, completedAt: date })).max(12) }),
  daily: z.record(z.string().regex(/^nfDaily:[a-zA-Z0-9_-]{1,80}$/), z.object({
    attemptsUsed: count, bestScore: count, bestEnding: z.string().max(500).nullable()
  })).refine(value => Object.keys(value).length <= 31)
});
export type ProgressSnapshot = z.infer<typeof snapshotSchema>;
export const saveRequestSchema = z.object({
  userId: z.string().min(1).max(128), revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1),
  mutationId: z.string().uuid(), snapshot: snapshotSchema
});
