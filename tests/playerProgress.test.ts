import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY_PLAYER_PROGRESS,
  MAX_RUN_HISTORY,
  createCalibrationResult,
  getAdaptiveDifficulty,
  getDifficultyPreset,
  normalizePlayerProgress,
  recordRun,
  shouldLeadWithPrologue,
  summarizeProgress,
  getEffectiveBaseline,
  type PlayerProgress,
  type RunRecord
} from '../services/playerProgress.ts';
import { runSchema } from '../services/progressSchema.ts';

const makeRun = (overrides: Partial<RunRecord> = {}): RunRecord => ({
  id: 'run-1',
  endedAt: '2026-08-23T12:00:00.000Z',
  dateKey: '2026-08-23',
  outcome: 'defeat',
  daily: false,
  genre: 'cyberpunk',
  level: 1,
  score: 100,
  wpm: 50,
  bestWpm: 62,
  accuracy: 96,
  consistency: 88,
  mistakes: 4,
  characters: 400,
  durationSeconds: 300,
  focus: 'speed',
  pact: [],
  ...overrides
});

test('calibration selects a fair adaptive preset', () => {
  assert.equal(getDifficultyPreset(32, 99), 'guided');
  assert.equal(getDifficultyPreset(70, 92), 'guided');
  assert.equal(getDifficultyPreset(48, 98), 'balanced');
  assert.equal(getDifficultyPreset(72, 98), 'intense');

  assert.deepEqual(getAdaptiveDifficulty(createCalibrationResult(32, 99, 20_000)), {
    preset: 'guided',
    traceSpeedMultiplier: 0.72,
    mistakeGraceCount: 2
  });
});

test('progress normalization drops malformed records', () => {
  const normalized = normalizePlayerProgress({
    version: 99,
    calibration: { wpm: 48, accuracy: 97, durationMs: 20_000, completedAt: '2026-08-23T00:00:00.000Z' },
    runs: [makeRun(), { id: 3, outcome: 'lost' }]
  });

  assert.equal(normalized.version, 1);
  assert.equal(normalized.calibration?.preset, 'balanced');
  assert.equal(normalized.runs.length, 1);
});

test('run history is newest first, deduplicated, and bounded', () => {
  let progress = { ...EMPTY_PLAYER_PROGRESS, runs: [] };
  for (let index = 0; index < MAX_RUN_HISTORY + 4; index += 1) {
    progress = recordRun(progress, makeRun({ id: `run-${index}`, wpm: 40 + index }));
  }
  progress = recordRun(progress, makeRun({ id: 'run-10', wpm: 99 }));

  assert.equal(progress.runs.length, MAX_RUN_HISTORY);
  assert.equal(progress.runs[0].id, 'run-10');
  assert.equal(progress.runs[0].wpm, 99);
  assert.equal(progress.runs.filter((run) => run.id === 'run-10').length, 1);
});

test('progress summary calculates trend and a current streak', () => {
  const progress = normalizePlayerProgress({
    version: 1,
    runs: [
      makeRun({ id: 'today', dateKey: '2026-08-23', wpm: 60, bestWpm: 68, accuracy: 98, focus: 'mastery' }),
      makeRun({ id: 'yesterday', dateKey: '2026-08-22', wpm: 54, bestWpm: 61 }),
      makeRun({ id: 'two-days', dateKey: '2026-08-21', wpm: 51 }),
      makeRun({ id: 'old-1', dateKey: '2026-08-17', wpm: 42 }),
      makeRun({ id: 'old-2', dateKey: '2026-08-16', wpm: 45 }),
      makeRun({ id: 'old-3', dateKey: '2026-08-15', wpm: 48 })
    ]
  });
  const summary = summarizeProgress(progress, new Date('2026-08-23T15:00:00'));

  assert.equal(summary.currentStreak, 3);
  assert.equal(summary.hasRunToday, true);
  assert.equal(summary.bestWpm, 68);
  assert.equal(summary.latestFocus, 'mastery');
  assert.equal(summary.wpmDelta, 10);
});

test('progress summary reports an early trend after the second run', () => {
  const summary = summarizeProgress(normalizePlayerProgress({
    version: 1,
    runs: [
      makeRun({ id: 'second', wpm: 55 }),
      makeRun({ id: 'first', wpm: 43 })
    ]
  }), new Date('2026-08-23T15:00:00'));

  assert.equal(summary.wpmDelta, 12);
});

const runAt = (id: string, wpm: number, accuracy = 97): RunRecord => ({
  id,
  endedAt: `2026-08-2${id}T00:00:00.000Z`,
  dateKey: `2026-08-2${id}`,
  outcome: 'banked',
  daily: false,
  genre: 'cyberpunk',
  level: 1,
  score: 100,
  wpm,
  bestWpm: wpm,
  accuracy,
  consistency: 90,
  mistakes: 3,
  characters: 800,
  durationSeconds: 300,
  focus: 'mastery',
  pact: []
});

const progressWith = (calibrationWpm: number, runs: RunRecord[]): PlayerProgress => ({
  version: 1,
  calibration: createCalibrationResult(calibrationWpm, 97, 30_000, '2026-08-20T00:00:00.000Z'),
  runs
});

test('a player who improves is measured at their new pace, not their first 30 seconds', () => {
  // The tracer chases at a fraction of this, so a frozen baseline meant the game
  // got easier purely because the player got better.
  const progress = progressWith(40, [1, 2, 3, 4, 5].map((i) => runAt(String(i), 70)));
  assert.equal(getEffectiveBaseline(progress).wpm, 70);
});

test('one bad session cannot swing the baseline', () => {
  const runs = [runAt('1', 12), runAt('2', 68), runAt('3', 70), runAt('4', 72), runAt('5', 69)];
  assert.equal(getEffectiveBaseline(progressWith(40, runs)).wpm, 69);
});

test('the baseline ratchets up and never quietly lowers the bar', () => {
  // Run speed is measured under chase pressure, so a rough patch must not drag
  // the bar down. Recalibrating is the deliberate way back.
  const progress = progressWith(80, [1, 2, 3, 4, 5].map((i) => runAt(String(i), 30)));
  assert.equal(getEffectiveBaseline(progress).wpm, 80);
});

test('with no runs yet the baseline is exactly the calibration', () => {
  const progress = progressWith(52, []);
  assert.equal(getEffectiveBaseline(progress).wpm, 52);
  assert.equal(getEffectiveBaseline({ version: 1, calibration: null, runs: [] }).wpm, 0);
});

test('only the recent window counts, so old runs stop holding the bar up', () => {
  const recent = [1, 2, 3, 4, 5].map((i) => runAt(String(i), 50));
  const ancient = [6, 7, 8].map((i) => runAt(String(i), 95));
  assert.equal(getEffectiveBaseline(progressWith(40, [...recent, ...ancient])).wpm, 50);
});

test('a player graduates out of the guided preset by improving, not by remembering to recalibrate', () => {
  const progress = progressWith(30, [1, 2, 3, 4, 5].map((i) => runAt(String(i), 72, 98)));
  assert.equal(progress.calibration?.preset, 'guided');
  assert.equal(getAdaptiveDifficulty(progress.calibration, progress).preset, 'intense');
  // Without the run history the old frozen answer stands.
  assert.equal(getAdaptiveDifficulty(progress.calibration).preset, 'guided');
});

test('the prologue leads the menu until it is finished or anything else is played', () => {
  const progress = (runs: RunRecord[]): PlayerProgress => ({ ...EMPTY_PLAYER_PROGRESS, runs });
  assert.equal(shouldLeadWithPrologue(progress([])), true);
  assert.equal(shouldLeadWithPrologue(progress([makeRun({ mission: 'last_relay', outcome: 'defeat' })])), true);
  assert.equal(shouldLeadWithPrologue(progress([makeRun({ mission: 'last_relay', outcome: 'victory' })])), false);
  // A run recorded before the tag existed means the player has played before.
  assert.equal(shouldLeadWithPrologue(progress([makeRun({ outcome: 'defeat' })])), false);
});

test('the prologue tag survives normalisation and the cloud run schema', () => {
  const tagged = normalizePlayerProgress({ ...EMPTY_PLAYER_PROGRESS, runs: [makeRun({ mission: 'last_relay' })] });
  assert.equal(tagged.runs[0].mission, 'last_relay');
  const forged = normalizePlayerProgress({ ...EMPTY_PLAYER_PROGRESS, runs: [{ ...makeRun(), mission: 'other' }] });
  assert.equal('mission' in forged.runs[0], false);
  assert.equal(runSchema.safeParse(makeRun({ mission: 'last_relay' })).success, true);
  assert.equal(runSchema.safeParse({ ...makeRun(), mission: 'other' }).success, false);
});
