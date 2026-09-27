import assert from 'node:assert/strict';
import test from 'node:test';
import { TypingMeter, measuredAccuracy, measuredWpm } from '../services/typingMetrics.ts';
import { summarizeSector } from '../services/gameRules.ts';
import { EMPTY_PLAYER_PROGRESS, createCalibrationResult, getEffectiveBaseline, getComparableRuns, normalizePlayerProgress, summarizeProgress, type RunRecord } from '../services/playerProgress.ts';
import { EMPTY_TYPING_TRAINING, getBenchmarkDelta, recordTypingSession } from '../services/typingTraining.ts';
import { DEFAULT_PROFILE, DEFAULT_MISSION_STATE } from '../services/profile.ts';
import { DEFAULT_MODIFIERS } from '../services/perks.ts';
import { settleRunReward } from '../services/runRewards.ts';
import { normalizeRunCheckpoint } from '../services/runCheckpoint.ts';
import { type Language, SegmentType, StoryMood } from '../types.ts';
import { practicePrompt, PRACTICE_PHASE_MS, selectPracticeFocus } from '../services/practiceSession.ts';
import { readSnapshot, writeSnapshot } from '../services/cloudProgress.ts';

test('typing meter counts corrected and shielded errors, excludes pauses and post-line waiting', () => {
  const meter = new TypingMeter();
  assert.equal(meter.read(0, 90_000).durationMs, 0);
  meter.key(false, 100_000); // the game may forgive it; the meter never does
  meter.key(true, 101_000); // correction does not erase the attempt
  meter.pause(102_000);
  meter.key(false, 110_000); // paused input ignored
  meter.resume(122_000);
  meter.key(true, 123_000);
  meter.finish(123_000);
  const result = meter.read(2, 180_000);
  assert.deepEqual(result, { characters: 2, mistakes: 1, attempts: 3, durationMs: 3_000 });
  assert.ok(Math.abs(measuredAccuracy(result.mistakes, result.attempts) - 66.6666666667) < 1e-6);
  assert.equal(measuredWpm(result.characters, result.durationMs), 8);
});

test('unequal passages use total characters over total active time, including final errors', () => {
  const result = summarizeSector([
    { wpm: 120, characters: 25, durationMs: 2_500, attempts: 25, mistakes: 0, score: 12 },
    { wpm: 30, characters: 500, durationMs: 200_000, attempts: 505, mistakes: 5, score: 8 }
  ]);
  assert.ok(Math.abs(result.avgWpm - 31.1111111111) < 1e-6);
  assert.equal(result.totalMistakes, 5);
  assert.equal(result.score, 20);
  assert.ok(Math.abs(result.accuracy - 100 * (1 - 5 / 530)) < 1e-9);
});

test('erasing the entire input does not erase mistakes from a failed attempt', () => {
  const meter = new TypingMeter();
  meter.key(false, 1000);
  meter.key(false, 2000);
  const erased = meter.read(0, 3000);
  const result = summarizeSector([{ ...erased, wpm: 0, score: 0 }]);
  assert.equal(result.avgWpm, 0);
  assert.equal(result.totalMistakes, 2);
  assert.equal(result.accuracy, 0);
});

const run = (language: Language, endedAt: string, wpm = 100): RunRecord => ({
  id: endedAt, language, measurementVersion: 2, endedAt, dateKey: endedAt.slice(0, 10),
  wpm, bestWpm: wpm, accuracy: 99, consistency: 90, mistakes: 1, characters: 100,
  daily: false, genre: 'cyberpunk', level: 1, score: 100, durationSeconds: 60,
  focus: 'accuracy', outcome: 'banked', pact: []
});

test('recalibration resets the pace and another language cannot raise it', () => {
  const progress = { ...EMPTY_PLAYER_PROGRESS,
    calibration: { ...createCalibrationResult(40, 97, 60_000, '2026-09-26T10:00:00.000Z'), language: 'en' as const },
    runs: [run('ru', '2026-09-26T11:00:00.000Z', 120), run('en', '2026-09-25T10:00:00.000Z')]
  };
  assert.deepEqual(getEffectiveBaseline(progress, 'en'), { wpm: 40, accuracy: 97 });
  assert.equal(getEffectiveBaseline(progress, 'ru').wpm, 120);
  assert.equal(getComparableRuns(progress, 'en').length, 1);
  assert.equal(getComparableRuns({ ...progress, runs: [{ ...progress.runs[1], language: undefined }] }, 'en').length, 0);
});

test('training benchmarks compare only the same prompt, language and measurement version', () => {
  let profile = recordTypingSession(EMPTY_TYPING_TRAINING, [], { kind: 'drill', language: 'en', promptId: 'v1', measurementVersion: 2, wpm: 40, accuracy: 94, completedAt: '2026-09-24T10:00:00.000Z' });
  profile = recordTypingSession(profile, [], { kind: 'drill', language: 'ru', promptId: 'v1', measurementVersion: 2, wpm: 80, accuracy: 99, completedAt: '2026-09-25T10:00:00.000Z' });
  assert.equal(getBenchmarkDelta(profile, 'en'), null);
  profile = recordTypingSession(profile, [], { kind: 'drill', language: 'en', promptId: 'v1', measurementVersion: 2, wpm: 48, accuracy: 97, completedAt: '2026-09-26T10:00:00.000Z' });
  assert.deepEqual(getBenchmarkDelta(profile, 'en'), { wpm: 8, accuracy: 3, sessions: 2 });
});

test('sector rewards deposit once even after a stale checkpoint is replayed', () => {
  const first = settleRunReward(DEFAULT_PROFILE, 'run:sector:1', 100, 126);
  const replay = settleRunReward(first, 'run:sector:1', 100, 126);
  assert.equal(replay, first);
  const second = settleRunReward(replay, 'run:sector:2', 120, 126);
  assert.equal(second.credits - DEFAULT_PROFILE.credits, 252);
  assert.equal(second.totalXp - DEFAULT_PROFILE.totalXp, 220);
});

test('checkpoint preserves line, accumulated metrics and frozen run settings without typed input', () => {
  const context = { id: 'run-one', language: 'ru', elapsedMs: 12_000, storyLog: [], levelStartIndex: 0,
    characterDescription: 'operator', pact: ['hunted'], strictCase: true, relaxed: false,
    baselineWpm: 42, stealthLevel: 2, modifiers: DEFAULT_MODIFIERS };
  const checkpoint = { version: 1, nextLevel: 1, health: 16, genre: 'cyberpunk', narrativeContext: '',
    totalScore: 50, perks: [], mission: DEFAULT_MISSION_STATE, context,
    engine: { segment: { text: 'Signal.', mood: StoryMood.TENSE, type: SegmentType.NARRATIVE },
      history: [], round: 2, health: 16, credits: 18, combo: 30, charge: 30, trace: 8, firewall: 2, focusRemainingMs: 0,
      inputValue: 'private keystrokes' } };
  const restored = normalizeRunCheckpoint(JSON.parse(JSON.stringify(checkpoint)));
  assert.equal(restored?.engine?.round, 2);
  assert.equal(restored?.engine?.credits, 18);
  assert.equal(restored?.context?.language, 'ru');
  assert.deepEqual(restored?.context?.pact, ['hunted']);
  assert.ok(!JSON.stringify(restored).includes('private keystrokes'));
  assert.equal(normalizeRunCheckpoint({ ...checkpoint, engine: { ...checkpoint.engine, round: 99 } }), null);
});

test('practice uses five active minutes and identical checks; activity survives normalization', () => {
  assert.equal(PRACTICE_PHASE_MS.reduce((sum, n) => sum + n, 0), 300_000);
  for (const language of ['en', 'ru'] as const) {
    assert.equal(practicePrompt(language, 0, 2, ['a']), practicePrompt(language, 2, 2, ['a']));
    assert.deepEqual(selectPracticeFocus(language, EMPTY_TYPING_TRAINING), []);
  }
  const progress = normalizePlayerProgress({ ...EMPTY_PLAYER_PROGRESS, practiceDates: ['2026-09-25', '2026-09-26', '2026-09-26'] });
  const summary = summarizeProgress(progress, new Date('2026-09-26T12:00:00'));
  assert.equal(summary.currentStreak, 2);
  assert.equal(summary.hasRunToday, true);
  assert.equal(progress.practiceDates?.length, 2);
});

test('cloud roundtrip retains measurement metadata and reward receipts', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v),
    clear: () => data.clear(), removeItem: (k: string) => data.delete(k), key: (i: number) => [...data.keys()][i] ?? null, get length() { return data.size; } } as Storage;
  const snapshot = readSnapshot(storage);
  snapshot.progress.runs = [run('ru', '2026-09-26T10:00:00.000Z')];
  snapshot.progress.practiceDates = ['2026-09-26'];
  snapshot.progress.hasMovedPastPrologue = true;
  snapshot.profile.settledRewards = ['run:sector:1'];
  writeSnapshot(storage, snapshot);
  assert.deepEqual(readSnapshot(storage), snapshot);
});
