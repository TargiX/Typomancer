import assert from 'node:assert/strict';
import test from 'node:test';

import { EMPTY_PLAYER_PROGRESS, type RunRecord } from '../services/playerProgress.ts';
import { buildSessionGoal, pickRotationGenre, pickSessionPairs, planSession, scoreSessionGoal } from '../services/sessionPlan.ts';

const run = (overrides: Partial<RunRecord> = {}): RunRecord => ({
  id: 'run', endedAt: '2026-09-20T10:00:00.000Z', dateKey: '2026-09-20', outcome: 'victory', daily: false,
  genre: 'cyberpunk', level: 2, score: 100, wpm: 60, bestWpm: 70, accuracy: 95, consistency: 85,
  mistakes: 3, characters: 500, durationSeconds: 300, focus: 'accuracy', pact: [], ...overrides
});

test('a newcomer is planned into the prologue', () => {
  assert.deepEqual(planSession({ progress: EMPTY_PLAYER_PROGRESS, comparableRuns: [], leadWithPrologue: true, weakPairs: [], paceWpm: null }), { kind: 'prologue' });
});

test('rotation picks a never-played world first, then the one played longest ago', () => {
  assert.equal(pickRotationGenre([]), 'cyberpunk');
  assert.equal(pickRotationGenre([run({ genre: 'cyberpunk' })]), 'space_horror');
  const allPlayed = (['cyberpunk', 'space_horror', 'noir', 'dark_fable', 'dead_channel'] as const)
    .map((genre, index) => run({ genre, endedAt: `2026-09-2${index}T10:00:00.000Z` }));
  assert.equal(pickRotationGenre(allPlayed), 'cyberpunk');
  // Daily and prologue runs do not count as having visited a campaign world.
  assert.equal(pickRotationGenre([run({ genre: 'cyberpunk', daily: true }), run({ genre: 'cyberpunk', mission: 'last_relay' })]), 'cyberpunk');
});

test('the goal follows the last debrief focus and averages recent runs of its metric', () => {
  const goal = buildSessionGoal([
    run({ focus: 'speed', wpm: 50 }),
    run({ focus: 'accuracy', wpm: 40 }),
    run({ wpm: 60 }),
    run({ wpm: 999 })
  ]);
  assert.equal(goal.focus, 'speed');
  assert.equal(goal.metric, 'wpm');
  assert.equal(goal.before, 50);
});

test('a campaign plan carries the focus perk, two weak pairs and a rounded pace', () => {
  const runs = [run({ focus: 'consistency' })];
  const plan = planSession({
    progress: { ...EMPTY_PLAYER_PROGRESS, hasMovedPastPrologue: true, runs },
    comparableRuns: runs,
    leadWithPrologue: false,
    weakPairs: ['th', 'br', 'qu'],
    paceWpm: 71.6
  });
  assert.equal(plan.kind, 'campaign');
  if (plan.kind !== 'campaign') return;
  assert.equal(plan.perk, 'critical_override');
  assert.deepEqual(plan.weakPairs, ['th', 'br']);
  assert.equal(plan.paceWpm, 72);
});

test('the debrief score compares rounded values and has no baseline on a first campaign', () => {
  assert.deepEqual(scoreSessionGoal({ focus: 'accuracy', metric: 'accuracy', before: 94.4 }, 96.6), { before: 94, after: 97, better: true });
  assert.equal(scoreSessionGoal({ focus: 'accuracy', metric: 'accuracy', before: 97 }, 93).better, false);
  assert.deepEqual(scoreSessionGoal({ focus: 'speed', metric: 'wpm', before: null }, 41.2), { before: null, after: 41, better: true });
});

test('due reviews come before weak pairs, and pace needs comparable history', () => {
  assert.deepEqual(pickSessionPairs(['br'], ['th', 'br', 'qu']), ['br', 'th']);
  const plan = planSession({ progress: { ...EMPTY_PLAYER_PROGRESS, runs: [run()] }, comparableRuns: [], leadWithPrologue: false, weakPairs: [], paceWpm: 70 });
  assert.equal(plan.kind === 'campaign' && plan.paceWpm, null);
});
