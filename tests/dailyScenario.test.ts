import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDeterministicStoryBranch,
  getDeterministicStrategicDecision
} from '../services/geminiService.ts';
import { pickDailyItems } from '../services/dailyMode.ts';
import type { MissionState } from '../types.ts';

const mission: MissionState = {
  heat: 34,
  trust: 50,
  evidence: 12,
  route: 'balanced',
  flags: [],
  consequenceLog: []
};

test('Daily Scenario returns identical authored branches for identical public game state', () => {
  const first = getDeterministicStoryBranch('noir', 1, 2, 'en', mission);
  const second = getDeterministicStoryBranch('noir', 1, 2, 'en', { ...mission });
  assert.deepEqual(second, first);
  assert.equal(first.goodPath.text.length > 0, true);
  assert.equal(first.mediumPath.text.length > 0, true);
  assert.equal(first.badPath.text.length > 0, true);
});

test('Daily Scenario decision is deterministic while preserving both strategic routes', () => {
  const decision = getDeterministicStrategicDecision('space_horror', 'ru', 1, mission);
  assert.deepEqual(decision, getDeterministicStrategicDecision('space_horror', 'ru', 1, { ...mission }));
  assert.deepEqual(decision.options.map((option) => option.type), ['aggressive', 'stealth']);
});

test('Daily Scenario offers the same non-random starter loadout for every player', () => {
  const ids = ['buffer', 'ghost', 'siphon', 'lattice', 'lens'];
  const first = pickDailyItems('SECTOR-20260823', ids, 3);
  const second = pickDailyItems('SECTOR-20260823', [...ids].reverse(), 3);

  assert.deepEqual(second, first);
  assert.equal(new Set(first).size, 3);
});
