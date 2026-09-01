import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_COMFORT_PENALTY,
  MIN_TRACE_SPEED_MULTIPLIER,
  clampTraceSpeed,
  getComfortCreditMultiplier
} from '../services/riskReward.ts';
import { getTracerCharsPerSecond } from '../services/tracer.ts';

test('the chase can never be shopped away entirely', () => {
  // Maxed Signal Dampener (-0.5), the guided preset (x0.72), and Ghost Protocol
  // III (x0.5) previously stacked down to 0.18.
  assert.equal(clampTraceSpeed((1 - 0.5) * 0.72 * 0.5), MIN_TRACE_SPEED_MULTIPLIER);
  assert.equal(clampTraceSpeed(0.01), MIN_TRACE_SPEED_MULTIPLIER);
  assert.equal(clampTraceSpeed(-4), MIN_TRACE_SPEED_MULTIPLIER);
});

test('the floor does not touch a multiplier that is already fair', () => {
  assert.equal(clampTraceSpeed(1), 1);
  assert.equal(clampTraceSpeed(0.88), 0.88);
  assert.equal(clampTraceSpeed(1.4), 1.4);
});

test('a broken multiplier falls back to full pressure rather than none', () => {
  // Both directions are nonsense input, and both resolve to ordinary pressure:
  // an infinite multiplier would end a run on the first line.
  assert.equal(clampTraceSpeed(Number.NaN), 1);
  assert.equal(clampTraceSpeed(Number.POSITIVE_INFINITY), 1);
});

test('the floored tracer is still a real threat to a stalled player', () => {
  const cps = getTracerCharsPerSecond({
    baselineWpm: 55,
    traceSpeedMultiplier: MIN_TRACE_SPEED_MULTIPLIER,
    stealthLevel: 0,
    heat: 18,
    trust: 44,
    segmentPressure: 0
  });
  // Slow enough to be an advantage, fast enough to still close a gap.
  assert.ok(cps > 1, `floored tracer crawls at ${cps} chars/sec`);
});

test('comfort costs income, in proportion to how much was bought', () => {
  assert.equal(getComfortCreditMultiplier(0, 10), 1);
  assert.equal(getComfortCreditMultiplier(10, 10), 1 - MAX_COMFORT_PENALTY);
  assert.equal(getComfortCreditMultiplier(5, 10), 1 - (MAX_COMFORT_PENALTY / 2));
});

test('the comfort penalty is bounded and never inverts into a bonus', () => {
  assert.equal(getComfortCreditMultiplier(99, 10), 1 - MAX_COMFORT_PENALTY);
  assert.equal(getComfortCreditMultiplier(-3, 10), 1);
  assert.equal(getComfortCreditMultiplier(3, 0), 1);
  assert.ok(getComfortCreditMultiplier(10, 10) > 0.5, 'a full investment must stay playable');
});

test('the calm build is a trade, not a strictly better one', () => {
  const busy = getComfortCreditMultiplier(0, 10);
  const calm = getComfortCreditMultiplier(10, 10);
  assert.ok(calm < busy);
});
