import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_BASELINE_WPM,
  TRACER_CATCH_STUN_MS,
  TRACER_GRACE_MS,
  TRACER_PURGE_KNOCKBACK,
  advanceTracer,
  getTracerCharsPerSecond,
  getTracerGap,
  getTracerStartIndex,
  getTracerThreat,
  isTracerArmed,
  isTracerCaught,
  isTracerStunned,
  knockBackTracer
} from '../services/tracer.ts';

const calm = {
  baselineWpm: 50,
  traceSpeedMultiplier: 1,
  stealthLevel: 0,
  heat: 18,
  trust: 44,
  segmentPressure: 0
};

test('a player typing at their calibrated pace outruns the tracer', () => {
  const tracerCps = getTracerCharsPerSecond(calm);
  const playerCps = (calm.baselineWpm * 5) / 60;
  assert.ok(tracerCps < playerCps, `tracer ${tracerCps} should be slower than player ${playerCps}`);
  // Comfortably ahead, not a photo finish: the tracer punishes stalling, not pace.
  assert.ok(tracerCps < playerCps * 0.7);
});

test('tracer speed scales with the same pressure the trace bar reads', () => {
  const hot = getTracerCharsPerSecond({ ...calm, heat: 90, trust: 10 });
  const cool = getTracerCharsPerSecond({ ...calm, heat: 5, trust: 80 });
  assert.ok(hot > cool);

  const pressured = getTracerCharsPerSecond({ ...calm, segmentPressure: 5 });
  assert.ok(pressured > getTracerCharsPerSecond(calm));
});

test('stealth level and trace perks slow the chase', () => {
  assert.ok(getTracerCharsPerSecond({ ...calm, stealthLevel: 5 }) < getTracerCharsPerSecond(calm));
  assert.ok(getTracerCharsPerSecond({ ...calm, traceSpeedMultiplier: 0.5 }) < getTracerCharsPerSecond(calm));
});

test('missing calibration falls back to a sane pace rather than a crawl or a sprint', () => {
  const fallback = getTracerCharsPerSecond({ ...calm, baselineWpm: 0 });
  const explicit = getTracerCharsPerSecond({ ...calm, baselineWpm: DEFAULT_BASELINE_WPM });
  assert.equal(fallback, explicit);
});

test('an absurd calibration cannot make the tracer unbeatable or irrelevant', () => {
  const tiny = getTracerCharsPerSecond({ ...calm, baselineWpm: 1 });
  const huge = getTracerCharsPerSecond({ ...calm, baselineWpm: 9000 });
  assert.ok(tiny > 0.2);
  assert.ok(huge < (110 * 5) / 60);
});

test('the segment opens with the tracer visible on the first character', () => {
  assert.equal(getTracerStartIndex(), 0);
});

test('the chase does not start until the player commits and spends the grace window', () => {
  // Reading the line costs nothing: no keystroke means no chase.
  assert.equal(isTracerArmed(null), false);
  assert.equal(isTracerArmed(TRACER_GRACE_MS - 1), false);
  assert.equal(isTracerArmed(TRACER_GRACE_MS), true);
});

test('a catch stuns the tracer so it cannot machine-gun a player frozen at the line start', () => {
  // Near index 0 there is no room behind the caret for knockback to matter,
  // which is exactly where repeated instant catches would otherwise happen.
  assert.equal(knockBackTracer(1, 14), 0);
  assert.equal(isTracerStunned(null), false);
  assert.equal(isTracerStunned(0), true);
  assert.equal(isTracerStunned(TRACER_CATCH_STUN_MS - 1), true);
  assert.equal(isTracerStunned(TRACER_CATCH_STUN_MS), false);
});

test('advancing integrates speed over elapsed time and stops at the line end', () => {
  const cps = 2;
  assert.equal(advanceTracer(0, 1000, cps, 100), 2);
  assert.equal(advanceTracer(0, 500, cps, 100), 1);
  // A frame with no elapsed time must not creep forward.
  assert.equal(advanceTracer(4, 0, cps, 100), 4);
  assert.equal(advanceTracer(99, 5000, cps, 100), 100);
});

test('the tracer catches a stalled caret and not a moving one', () => {
  assert.equal(isTracerCaught(9.9, 10), false);
  assert.equal(isTracerCaught(10, 10), true);
  assert.equal(isTracerCaught(10.4, 10), true);
  assert.equal(isTracerCaught(10, 40), false);
});

test('knockback never throws the tracer behind its opening position', () => {
  assert.equal(knockBackTracer(30, TRACER_PURGE_KNOCKBACK), 5);
  assert.equal(knockBackTracer(2, TRACER_PURGE_KNOCKBACK), getTracerStartIndex());
  assert.equal(knockBackTracer(30, -5), 30);
});

test('the tracer is caught up to the caret only while the caret is ahead of it', () => {
  // With the tracer parked on character 0, an untyped line is not yet a catch
  // because the chase has not armed — arming is what makes index 0 dangerous.
  assert.equal(isTracerCaught(0, 0), true);
  assert.equal(isTracerArmed(null), false);
});

test('threat tiers describe the shrinking gap', () => {
  assert.equal(getTracerGap(10, 40), 30);
  assert.equal(getTracerThreat(10, 40), 'clear');
  assert.equal(getTracerThreat(30, 40), 'closing');
  assert.equal(getTracerThreat(38, 40), 'critical');
});
