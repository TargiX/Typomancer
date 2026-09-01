import assert from 'node:assert/strict';
import test from 'node:test';

import { SECTOR_ROUNDS } from '../services/gameRules.ts';
import { getBeatDirection, getRoundShape } from '../services/sectorRhythm.ts';

const sector = (level = 1) =>
  Array.from({ length: SECTOR_ROUNDS }, (_, index) => getRoundShape(index + 1, SECTOR_ROUNDS, level));

test('a sector opens short and closes long', () => {
  const shapes = sector();
  const first = shapes[0];
  const last = shapes[shapes.length - 1];
  assert.ok(last.maxWords > first.maxWords * 2, `${first.maxWords} -> ${last.maxWords}`);
  assert.equal(last.isClimax, true);
  assert.equal(first.isClimax, false);
});

test('line length and pressure never fall back as the sector runs', () => {
  const shapes = sector();
  for (let i = 1; i < shapes.length; i += 1) {
    assert.ok(shapes[i].minWords >= shapes[i - 1].minWords, `words dipped at round ${i + 1}`);
    assert.ok(shapes[i].pressure >= shapes[i - 1].pressure, `pressure dipped at round ${i + 1}`);
  }
});

test('the closing round is the sector maximum on both axes', () => {
  const shapes = sector();
  const last = shapes[shapes.length - 1];
  assert.equal(last.pressure, Math.max(...shapes.map((s) => s.pressure)));
  assert.equal(last.maxWords, Math.max(...shapes.map((s) => s.maxWords)));
  assert.equal(last.beat, 'climax');
});

test('escalation is authored, so a clean run still feels the sector tighten', () => {
  // The old pressure came from Heat, which a clean player keeps low — so the
  // better you played, the flatter the sector got.
  const shapes = sector();
  assert.ok(shapes[shapes.length - 1].pressure > shapes[0].pressure);
});

test('later sectors open tighter rather than resetting flat', () => {
  assert.ok(getRoundShape(1, SECTOR_ROUNDS, 4).pressure > getRoundShape(1, SECTOR_ROUNDS, 1).pressure);
  // But pressure is still bounded, so sector four is not unplayable.
  assert.ok(getRoundShape(SECTOR_ROUNDS, SECTOR_ROUNDS, 4).pressure <= 5);
});

test('the curve survives a different sector length instead of losing its climax', () => {
  for (const rounds of [3, 5, 7, 12]) {
    const last = getRoundShape(rounds, rounds);
    assert.equal(last.isClimax, true, `rounds=${rounds}`);
    assert.equal(last.beat, 'climax', `rounds=${rounds}`);
    assert.equal(getRoundShape(1, rounds).beat, 'establish', `rounds=${rounds}`);
  }
});

test('out-of-range rounds are clamped rather than producing a broken shape', () => {
  assert.deepEqual(getRoundShape(0, SECTOR_ROUNDS), getRoundShape(1, SECTOR_ROUNDS));
  assert.deepEqual(getRoundShape(99, SECTOR_ROUNDS), getRoundShape(SECTOR_ROUNDS, SECTOR_ROUNDS));
  assert.equal(getRoundShape(1, 0).isClimax, true);
});

test('every beat has direction copy for the generator', () => {
  const beats = new Set(sector().map((shape) => shape.beat));
  for (const beat of beats) {
    assert.ok(getBeatDirection(beat).length > 20, beat);
  }
});

test('a sector is a meaningful amount of typing, not a flat sprint', () => {
  const shapes = sector();
  const midWords = shapes.reduce((sum, shape) => sum + (shape.minWords + shape.maxWords) / 2, 0);
  // Roughly six characters per word including the space.
  const characters = midWords * 6;
  assert.ok(characters > 700, `sector is only ~${Math.round(characters)} characters`);
});

test('a one-round sector is its own climax, not just its opening', () => {
  // Round one was checked before the final-round case, so a single-round sector
  // reported the gentlest beat while also claiming to be the climax.
  const only = getRoundShape(1, 1);
  assert.equal(only.beat, 'climax');
  assert.equal(only.isClimax, true);
  // A clamped sectorRounds of 0 lands in the same place.
  assert.equal(getRoundShape(1, 0).beat, 'climax');
});
