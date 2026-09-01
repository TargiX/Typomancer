import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMPARISON_WINDOW,
  getLatencySpread,
  getPatternDiagnostics,
  getSkillHeadline,
  getSkillSeries,
  getSteadiestPatterns
} from '../services/progressAnalytics.ts';
import { EMPTY_TYPING_TRAINING, type PatternStat } from '../services/typingTraining.ts';
import type { PlayerProgress, RunRecord } from '../services/playerProgress.ts';

const run = (index: number, wpm: number, accuracy = 96): RunRecord => ({
  id: `run-${index}`,
  // Newest first in storage, so a higher index is an older run.
  endedAt: new Date(Date.UTC(2026, 6, 30 - index)).toISOString(),
  dateKey: `2026-07-${String(30 - index).padStart(2, '0')}`,
  outcome: 'banked',
  daily: false,
  genre: 'cyberpunk',
  level: 1,
  score: 100,
  wpm,
  bestWpm: wpm,
  accuracy,
  consistency: 90,
  mistakes: 2,
  characters: 900,
  durationSeconds: 300,
  focus: 'mastery',
  pact: []
});

const progressOf = (runs: RunRecord[]): PlayerProgress => ({ version: 1, calibration: null, runs });

const stat = (token: string, attempts: number, errors: number, latencyMs: number): PatternStat => ({
  token,
  attempts,
  errors,
  totalLatencyMs: latencyMs * attempts,
  timedAttempts: attempts
});

test('the series reads oldest to newest, which is the direction a trend is read in', () => {
  const progress = progressOf([run(0, 70), run(1, 60), run(2, 50)]);
  assert.deepEqual(getSkillSeries(progress).map((point) => point.wpm), [50, 60, 70]);
});

test('runs with no measured speed are left out of the series', () => {
  const progress = progressOf([run(0, 70), run(1, 0), run(2, 50)]);
  assert.deepEqual(getSkillSeries(progress).map((point) => point.wpm), [50, 70]);
});

test('the headline compares windows, so one good day is not progress', () => {
  // Ten runs climbing from 40 to 76; newest first in storage.
  const runs = [76, 74, 72, 70, 68, 50, 48, 46, 44, 40].map((wpm, i) => run(i, wpm));
  const headline = getSkillHeadline(progressOf(runs));

  assert.equal(headline.currentWpm, 72);   // mean of the newest five
  assert.equal(headline.baselineWpm, 46);  // mean of the oldest five
  assert.equal(headline.deltaWpm, 26);
  assert.equal(headline.sessions, 10);
  assert.equal(headline.hasEnoughHistory, true);
});

test('a single outlier cannot masquerade as improvement', () => {
  const flat = [50, 50, 50, 50, 50, 50, 50, 50, 50].map((wpm, i) => run(i, wpm));
  const withSpike = [95, ...flat.map((r) => r.wpm)].map((wpm, i) => run(i, wpm));
  const spikeDelta = getSkillHeadline(progressOf(withSpike)).deltaWpm;
  // One exceptional run moves the five-run mean by a fifth of its excess, not all of it.
  assert.ok(spikeDelta < 95 - 50, `a single run moved the headline by ${spikeDelta}`);
  assert.ok(spikeDelta > 0);
});

test('too little history is reported as such rather than compared against itself', () => {
  const few = [60, 58, 55].map((wpm, i) => run(i, wpm));
  const headline = getSkillHeadline(progressOf(few));
  assert.equal(headline.hasEnoughHistory, false);
  assert.equal(headline.sessions, 3);

  const none = getSkillHeadline(progressOf([]));
  assert.equal(none.sessions, 0);
  assert.equal(none.deltaWpm, 0);
  assert.equal(none.hasEnoughHistory, false);
});

test('the headline reports the span of real days behind the numbers', () => {
  const runs = Array.from({ length: COMPARISON_WINDOW * 2 }, (_, i) => run(i, 60));
  assert.equal(getSkillHeadline(progressOf(runs)).spanDays, COMPARISON_WINDOW * 2 - 1);
});

test('diagnostics surface hesitation, not only misses', () => {
  const training = {
    ...EMPTY_TYPING_TRAINING,
    keys: [
      stat('q', 40, 0, 900),   // never missed, always hesitated
      stat('a', 40, 0, 90)     // never missed, instant
    ],
    bigrams: []
  };
  const [worst] = getPatternDiagnostics(training);
  assert.equal(worst.token, 'q');
  assert.equal(worst.errorRate, 0);
  assert.equal(worst.avgLatencyMs, 900);
});

test('a miss costs more than a pause, because it also costs the branch', () => {
  const training = {
    ...EMPTY_TYPING_TRAINING,
    keys: [stat('z', 40, 16, 120), stat('q', 40, 0, 600)],
    bigrams: []
  };
  assert.equal(getPatternDiagnostics(training)[0].token, 'z');
});

test('patterns with almost no evidence are not diagnosed', () => {
  const training = {
    ...EMPTY_TYPING_TRAINING,
    keys: [stat('k', 2, 2, 800), stat('m', 30, 6, 200)],
    bigrams: []
  };
  assert.deepEqual(getPatternDiagnostics(training).map((d) => d.token), ['m']);
});

test('the readout also names what is steady, so it measures rather than scolds', () => {
  const training = {
    ...EMPTY_TYPING_TRAINING,
    keys: [stat('z', 40, 16, 700), stat('e', 40, 0, 80)],
    bigrams: []
  };
  assert.equal(getSteadiestPatterns(training)[0].token, 'e');
});

test('latency spread degrades to nothing rather than to zeroes', () => {
  assert.equal(getLatencySpread(EMPTY_TYPING_TRAINING), null);

  const training = {
    ...EMPTY_TYPING_TRAINING,
    keys: [stat('a', 20, 0, 120), stat('b', 20, 0, 300), stat('c', 20, 0, 600)],
    bigrams: []
  };
  const spread = getLatencySpread(training);
  assert.equal(spread?.fastestMs, 120);
  assert.equal(spread?.slowestMs, 600);
  assert.equal(spread?.medianMs, 300);
  assert.equal(spread?.measured, 3);
});

test('a profile with no timing data cannot divide by zero', () => {
  const training = {
    ...EMPTY_TYPING_TRAINING,
    keys: [{ token: 'a', attempts: 10, errors: 1, totalLatencyMs: 0, timedAttempts: 0 }],
    bigrams: []
  };
  assert.equal(getPatternDiagnostics(training)[0].avgLatencyMs, 0);
  assert.equal(getLatencySpread(training), null);
});
