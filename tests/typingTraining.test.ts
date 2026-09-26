import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY_TYPING_TRAINING,
  buildTargetedDrill,
  getBenchmarkDelta,
  getWeakPatterns,
  normalizeTypingTraining,
  recordTypingSession,
  getTrainingFocusTokens,
  snapshotTypingObservations
} from '../services/typingTraining.ts';

test('training profile aggregates keys and bigrams without storing typed text', () => {
  const profile = recordTypingSession(EMPTY_TYPING_TRAINING, [
    { expected: 't', correct: true, latencyMs: 120 },
    { expected: 'r', previousExpected: 't', correct: false, latencyMs: 500 },
    { expected: 'a', previousExpected: 'r', correct: true, latencyMs: 180 }
  ]);

  assert.equal(profile.samples, 3);
  const { recent, ...historical } = profile.keys.find((item) => item.token === 'r')!;
  assert.equal(recent?.[0].errors, 1);
  assert.deepEqual(historical, {
    token: 'r', attempts: 1, errors: 1, totalLatencyMs: 500, timedAttempts: 1
  });
  assert.equal(profile.bigrams.find((item) => item.token === 'tr')?.errors, 1);
  assert.equal(JSON.stringify(profile).includes('typed'), false);
});

test('weak patterns prioritize repeated errors and shape a deterministic drill', () => {
  const profile = recordTypingSession(EMPTY_TYPING_TRAINING, [
    { expected: 'с', correct: false, latencyMs: 700 },
    { expected: 'в', previousExpected: 'с', correct: false, latencyMs: 800 },
    { expected: 'я', previousExpected: 'в', correct: true, latencyMs: 140 }
  ]);

  assert.equal(getWeakPatterns(profile, 1)[0].token, 'св');
  const drill = buildTargetedDrill('ru', profile);
  assert.equal(drill.includes('связь'), true);
  assert.equal(drill, buildTargetedDrill('ru', profile));
});

test('benchmark delta refuses to compare a calibration with a different drill', () => {
  let profile = recordTypingSession(EMPTY_TYPING_TRAINING, [], {
    kind: 'calibration', wpm: 42, accuracy: 94, completedAt: '2026-08-20T00:00:00.000Z'
  });
  profile = recordTypingSession(profile, [], {
    kind: 'drill', wpm: 50, accuracy: 97, completedAt: '2026-08-23T00:00:00.000Z'
  });
  assert.equal(getBenchmarkDelta(profile), null);
});

test('malformed training storage is normalized and bounded', () => {
  const normalized = normalizeTypingTraining({
    samples: -1,
    keys: [{ token: 'abc', attempts: 2, errors: 99, totalLatencyMs: -5 }, { token: '', attempts: 4 }],
    bigrams: 'private text',
    benchmarks: [{ kind: 'unknown', wpm: 99 }]
  });
  assert.equal(normalized.samples, 0);
  assert.equal(normalized.keys[0].token, 'a');
  assert.equal(normalized.keys[0].errors, 2);
  assert.equal(normalized.benchmarks.length, 0);
});

test('targeted drill guarantees every selected weak symbol and bigram appears repeatedly', () => {
  const profile = normalizeTypingTraining({
    samples: 20,
    keys: [
      { token: '#', attempts: 5, errors: 5, totalLatencyMs: 2_000 },
      { token: '7', attempts: 5, errors: 4, totalLatencyMs: 1_800 }
    ],
    bigrams: [
      { token: '42', attempts: 5, errors: 5, totalLatencyMs: 2_100 },
      { token: '!?', attempts: 5, errors: 4, totalLatencyMs: 1_900 }
    ]
  });

  const drill = buildTargetedDrill('en', profile);
  for (const token of ['#', '7', '42', '!?']) {
    assert.equal(drill.split(token).length - 1 >= 3, true, `${token} must be deliberately practiced`);
  }
});

test('run observation snapshot cannot be emptied or mutated through the live ref array', () => {
  const live = [{ expected: 'a', correct: true, latencyMs: 120 }];
  const snapshot = snapshotTypingObservations(live);
  live[0].expected = 'z';
  live.length = 0;

  assert.deepEqual(snapshot, [{ expected: 'a', correct: true, latencyMs: 120 }]);
});

test('training focus tokens keep only letter patterns with real evidence behind them', () => {
  const profile = {
    ...EMPTY_TYPING_TRAINING,
    samples: 200,
    keys: [
      { token: 'q', attempts: 20, errors: 9, totalLatencyMs: 6000, timedAttempts: 20 },
      { token: '7', attempts: 30, errors: 20, totalLatencyMs: 9000, timedAttempts: 30 },
      { token: ',', attempts: 30, errors: 22, totalLatencyMs: 9000, timedAttempts: 30 },
      { token: 'k', attempts: 2, errors: 2, totalLatencyMs: 900, timedAttempts: 2 }
    ],
    bigrams: [
      { token: 'th', attempts: 40, errors: 14, totalLatencyMs: 12000, timedAttempts: 40 },
      { token: 'br', attempts: 12, errors: 5, totalLatencyMs: 4000, timedAttempts: 12 }
    ]
  };

  const tokens = getTrainingFocusTokens(profile);

  // Digits and punctuation are excluded: bending prose around them distorts the
  // sentence far more than it trains anything.
  assert.ok(!tokens.includes('7'));
  assert.ok(!tokens.includes(','));
  // Two unlucky keystrokes must not reshape the campaign.
  assert.ok(!tokens.includes('k'));
  assert.ok(tokens.includes('th'));
  assert.ok(tokens.includes('q'));
});

test('training focus is bounded, deduplicated and lowercase', () => {
  const profile = {
    ...EMPTY_TYPING_TRAINING,
    samples: 300,
    keys: Array.from({ length: 12 }, (_, index) => ({
      token: String.fromCharCode(97 + index).toUpperCase(),
      attempts: 30,
      errors: 20 - index,
      totalLatencyMs: 9000,
      timedAttempts: 30
    })),
    bigrams: []
  };

  const tokens = getTrainingFocusTokens(profile, 4);
  assert.equal(tokens.length, 4);
  assert.deepEqual(tokens, [...new Set(tokens)]);
  tokens.forEach((token) => assert.equal(token, token.toLowerCase()));
});

test('an untrained player produces no focus tokens at all', () => {
  assert.deepEqual(getTrainingFocusTokens(EMPTY_TYPING_TRAINING), []);
});

test('low-sample noise cannot crowd out the real weak patterns', () => {
  // Twelve one-attempt misses used to fill every candidate slot before the
  // evidence filter ran, leaving no qualifying token at all.
  const noise = Array.from({ length: 12 }, (_, i) => ({
    token: String.fromCharCode(945 + i),
    attempts: 1,
    errors: 1,
    totalLatencyMs: 900,
    timedAttempts: 1
  }));
  const profile = {
    ...EMPTY_TYPING_TRAINING,
    samples: 400,
    keys: [...noise, { token: 'q', attempts: 40, errors: 18, totalLatencyMs: 16000, timedAttempts: 40 }],
    bigrams: [{ token: 'br', attempts: 50, errors: 20, totalLatencyMs: 18000, timedAttempts: 50 }]
  };

  const tokens = getTrainingFocusTokens(profile);
  assert.ok(tokens.includes('q'), `expected q among ${JSON.stringify(tokens)}`);
  assert.ok(tokens.includes('br'), `expected br among ${JSON.stringify(tokens)}`);
});
