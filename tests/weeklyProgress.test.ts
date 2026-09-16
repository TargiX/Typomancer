import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getWeeklyProgress } from '../services/weeklyProgress.ts';
import type { RunRecord } from '../services/playerProgress.ts';
import { buildTargetedDrill, getDrillPatterns, EMPTY_TYPING_TRAINING } from '../services/typingTraining.ts';

const run = (id: string, endedAt: string, wpm = 50, accuracy = 96) => ({ id, endedAt, wpm, accuracy } as RunRecord);
test('seven calendar days cross months, preserve gaps and average only recorded runs', () => {
  const now = new Date(2026, 8, 3, 18);
  const today = new Date(2026, 8, 3, 10).toISOString();
  const a = run('a', today, 40, 92);
  const days = getWeeklyProgress([a, a, run('b', today, 60, 100), run('bad', 'invalid'),
    run('future', new Date(2026, 8, 4).toISOString()), run('old', new Date(2026, 7, 27).toISOString())], now);
  assert.equal(days.length, 7); assert.equal(days[0].date, '2026-08-28');
  assert.equal(days[0].wpm, null); assert.equal(days[0].accuracy, null);
  assert.deepEqual(days[6], { date: '2026-09-03', count: 2, wpm: 50, accuracy: 96 });
});
test('personal drills select only the requested supported pattern and keep alphabets separate', () => {
  const profile = { ...EMPTY_TYPING_TRAINING, keys: [
    { token: 'q', attempts: 20, errors: 8, totalLatencyMs: 9000 },
    { token: 'я', attempts: 30, errors: 20, totalLatencyMs: 9000 },
    { token: 'z', attempts: 2, errors: 2, totalLatencyMs: 900 }
  ], bigrams: [{ token: 'th', attempts: 20, errors: 9, totalLatencyMs: 9000 }] };
  assert.deepEqual(getDrillPatterns('en', profile).map(p => p.token).sort(), ['q', 'th']);
  assert.deepEqual(getDrillPatterns('ru', profile).map(p => p.token), ['я']);
  assert.ok(buildTargetedDrill('en', profile, ['q']).startsWith('q q q '));
  assert.ok(!buildTargetedDrill('en', profile, ['q']).includes('я'));
  assert.ok(!buildTargetedDrill('ru', profile).includes('th'));
  assert.ok(!buildTargetedDrill('en', profile, ['injected-text']).includes('injected-text'));
});
