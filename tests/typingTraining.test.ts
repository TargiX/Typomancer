import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY_TYPING_TRAINING,
  buildTargetedDrill,
  getBenchmarkDelta,
  getWeakPatterns,
  normalizeTypingTraining,
  recordTypingSession,
  snapshotTypingObservations
} from '../services/typingTraining.ts';

test('training profile aggregates keys and bigrams without storing typed text', () => {
  const profile = recordTypingSession(EMPTY_TYPING_TRAINING, [
    { expected: 't', correct: true, latencyMs: 120 },
    { expected: 'r', previousExpected: 't', correct: false, latencyMs: 500 },
    { expected: 'a', previousExpected: 'r', correct: true, latencyMs: 180 }
  ]);

  assert.equal(profile.samples, 3);
  assert.deepEqual(profile.keys.find((item) => item.token === 'r'), {
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

test('benchmark delta compares the latest drill with the first baseline', () => {
  let profile = recordTypingSession(EMPTY_TYPING_TRAINING, [], {
    kind: 'calibration', wpm: 42, accuracy: 94, completedAt: '2026-08-20T00:00:00.000Z'
  });
  profile = recordTypingSession(profile, [], {
    kind: 'drill', wpm: 50, accuracy: 97, completedAt: '2026-08-23T00:00:00.000Z'
  });
  assert.deepEqual(getBenchmarkDelta(profile), { wpm: 8, accuracy: 3, sessions: 2 });
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
