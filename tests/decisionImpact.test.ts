import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampDecisionImpact,
  formatImpactValue,
  getDecisionImpactChips,
  type ImpactLabels
} from '../services/decisionImpact.ts';

const labels: ImpactLabels = {
  heat: 'HEAT',
  trust: 'TRUST',
  evidence: 'EVIDENCE',
  trace: 'TRACE',
  health: 'HP',
  credits: 'CREDITS'
};

test('Heat and Trace read backwards: more of them is bad news', () => {
  const [heat, trace] = getDecisionImpactChips({ heat: 14, trace: 10 }, labels);
  assert.equal(heat.tone, 'bad');
  assert.equal(trace.tone, 'bad');

  const cooled = getDecisionImpactChips({ heat: -8, trace: -12 }, labels);
  assert.equal(cooled[0].tone, 'good');
  assert.equal(cooled[1].tone, 'good');
});

test('Trust, Evidence, health and credits read forwards', () => {
  const chips = getDecisionImpactChips({ trust: 6, evidence: 8, health: 3, credits: 20 }, labels);
  assert.deepEqual(chips.map((chip) => chip.tone), ['good', 'good', 'good', 'good']);

  const losses = getDecisionImpactChips({ trust: -6, evidence: -2, health: -4, credits: -10 }, labels);
  assert.deepEqual(losses.map((chip) => chip.tone), ['bad', 'bad', 'bad', 'bad']);
});

test('the cost of a choice is listed before its reward', () => {
  const chips = getDecisionImpactChips({ evidence: 8, heat: 14, credits: 18, trace: 10 }, labels);
  assert.deepEqual(chips.map((chip) => chip.key), ['heat', 'trace', 'evidence', 'credits']);
});

test('meters a choice does not touch are not shown', () => {
  const chips = getDecisionImpactChips({ heat: 14, trust: 0, evidence: 8 }, labels);
  assert.deepEqual(chips.map((chip) => chip.key), ['heat', 'evidence']);
  assert.deepEqual(getDecisionImpactChips({}, labels), []);
  assert.deepEqual(getDecisionImpactChips(undefined, labels), []);
});

test('non-meter fields on an impact cannot leak into the chips', () => {
  // route and flag steer the story but are not numbers the player weighs here.
  const chips = getDecisionImpactChips({ heat: 5, route: 'loud', flag: 'loud_level_1' }, labels);
  assert.deepEqual(chips.map((chip) => chip.key), ['heat']);
});

test('a malformed impact from the generator degrades to nothing shown', () => {
  const chips = getDecisionImpactChips({ heat: Number.NaN, evidence: 4 } as never, labels);
  assert.deepEqual(chips.map((chip) => chip.key), ['evidence']);
});

test('values carry an explicit sign and the right unit', () => {
  const [heat, evidence] = getDecisionImpactChips({ heat: 14, evidence: -3 }, labels);
  assert.equal(formatImpactValue(heat), '+14%');
  assert.equal(formatImpactValue(evidence), '-3');
});

test('a generated impact cannot rewrite the economy in one choice', () => {
  // A live run produced CREDITS +500 against shop upgrades costing 100-220.
  const clamped = clampDecisionImpact({ credits: 500, evidence: 99, heat: 400 });
  assert.equal(clamped.credits, 120);
  assert.equal(clamped.evidence, 20);
  assert.equal(clamped.heat, 30);
});

test('a generated impact cannot end a run outright', () => {
  const clamped = clampDecisionImpact({ health: -900, trace: 250, trust: -400 });
  assert.equal(clamped.health, -8);
  assert.equal(clamped.trace, 25);
  assert.equal(clamped.trust, -20);
});

test('clamping keeps ordinary values untouched and drops nonsense', () => {
  assert.deepEqual(clampDecisionImpact({ heat: 14, evidence: 8 }), { heat: 14, evidence: 8 });
  const cleaned = clampDecisionImpact({ heat: Number.NaN, evidence: 4 } as never);
  assert.equal('heat' in cleaned, false);
  assert.equal(cleaned.evidence, 4);
  assert.deepEqual(clampDecisionImpact(undefined), {});
});

test('clamping preserves the narrative fields it does not own', () => {
  const clamped = clampDecisionImpact({ heat: 9, route: 'loud', flag: 'loud_level_2' });
  assert.equal(clamped.route, 'loud');
  assert.equal(clamped.flag, 'loud_level_2');
});
