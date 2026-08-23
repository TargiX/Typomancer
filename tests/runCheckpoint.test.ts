import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeRunCheckpoint } from '../services/runCheckpoint.ts';

test('accepts a checkpoint at the start of the next sector', () => {
  const checkpoint = normalizeRunCheckpoint({
    version: 1,
    nextLevel: 2,
    health: 17,
    genre: 'noir',
    narrativeContext: 'The witness escaped.',
    totalScore: 90,
    perks: [{ groupId: 'ghost_protocol', tier: 1 }],
    mission: {
      heat: 20,
      trust: 50,
      evidence: 12,
      corruption: 1,
      signal: 60,
      route: 'silent',
      flags: [],
      consequenceLog: []
    }
  });

  assert.equal(checkpoint?.nextLevel, 2);
  assert.equal(checkpoint?.genre, 'noir');
  assert.equal(checkpoint?.perks[0]?.groupId, 'ghost_protocol');
});

test('rejects stale, completed, and malformed checkpoints', () => {
  assert.equal(normalizeRunCheckpoint({ version: 0, nextLevel: 2 }), null);
  assert.equal(normalizeRunCheckpoint({ version: 1, nextLevel: 1 }), null);
  assert.equal(normalizeRunCheckpoint({ version: 1, nextLevel: 5 }), null);
  assert.equal(normalizeRunCheckpoint({ version: 1, nextLevel: 2, genre: 'western' }), null);
});
