import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PACT_CLAUSES,
  getPactRewardMultiplier,
  isPactClauseActive,
  normalizePact,
  togglePactClause
} from '../services/pact.ts';

test('an empty Pact pays exactly the ordinary rate', () => {
  assert.equal(getPactRewardMultiplier([]), 1);
});

test('taking the hard road is the efficient road', () => {
  const full = PACT_CLAUSES.map((clause) => clause.id);
  assert.ok(getPactRewardMultiplier(full) > 2, `full pact pays ${getPactRewardMultiplier(full)}x`);
});

test('every clause pays more than the one below it on the ladder', () => {
  for (let i = 1; i < PACT_CLAUSES.length; i += 1) {
    assert.ok(
      PACT_CLAUSES[i].reward >= PACT_CLAUSES[i - 1].reward,
      `${PACT_CLAUSES[i].id} pays less than ${PACT_CLAUSES[i - 1].id}`
    );
  }
});

test('reward scales with how much was taken on, one clause at a time', () => {
  let previous = getPactRewardMultiplier([]);
  const running: typeof PACT_CLAUSES[number]['id'][] = [];
  for (const clause of PACT_CLAUSES) {
    running.push(clause.id);
    const current = getPactRewardMultiplier(running);
    assert.ok(current > previous, `adding ${clause.id} did not raise the payout`);
    previous = current;
  }
});

test('toggling is order-independent and idempotent in pairs', () => {
  const once = togglePactClause([], 'hunted');
  assert.deepEqual(once, ['hunted']);
  assert.deepEqual(togglePactClause(once, 'hunted'), []);

  const a = togglePactClause(togglePactClause([], 'hunted'), 'no_grace');
  const b = togglePactClause(togglePactClause([], 'no_grace'), 'hunted');
  assert.deepEqual(a, b);
});

test('a clause cannot be added twice or invented', () => {
  const doubled = togglePactClause(['hunted', 'hunted'] as never, 'no_grace');
  assert.deepEqual(doubled, ['no_grace', 'hunted']);
  assert.deepEqual(togglePactClause([], 'free_credits' as never), []);
});

test('a hand-edited profile cannot inject clauses or duplicate rewards', () => {
  assert.deepEqual(normalizePact(['hunted', 'nonsense', 'hunted']), ['hunted']);
  assert.deepEqual(normalizePact('hunted' as never), []);
  assert.deepEqual(normalizePact(null), []);
  assert.equal(getPactRewardMultiplier(['hunted', 'hunted'] as never), getPactRewardMultiplier(['hunted']));
});

test('normalization keeps the ladder order whatever order they were taken in', () => {
  assert.deepEqual(
    normalizePact(['hunted', 'hot_start', 'exacting']),
    ['hot_start', 'exacting', 'hunted']
  );
});

test('clause membership is readable without knowing the storage shape', () => {
  assert.equal(isPactClauseActive(['hunted'], 'hunted'), true);
  assert.equal(isPactClauseActive(['hunted'], 'no_grace'), false);
  assert.equal(isPactClauseActive([], 'hunted'), false);
});
