import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DECISION_ROUND,
  SECTOR_ROUNDS,
  calculateSegmentCredits,
  calculateSegmentScore,
  getBranchPerformance,
  getComboMultiplier,
  getCursorSkillStack,
  getReadyActiveSkills,
  getTypingAccuracy,
  getTypingFocus,
  getStealthLevel,
  isLowHealth,
  summarizeSector
} from '../services/gameRules.ts';

test('a sector is a short complete session with one midpoint decision', () => {
  assert.equal(SECTOR_ROUNDS, 7);
  assert.equal(DECISION_ROUND, 4);
});

test('sector summary includes every round, including the final one', () => {
  const summary = summarizeSector([
    { wpm: 40, mistakes: 0, score: 12, characters: 100 },
    { wpm: 60, mistakes: 2, score: 8, characters: 100 }
  ]);

  assert.equal(summary.avgWpm, 48);
  assert.equal(summary.totalMistakes, 2);
  assert.equal(summary.score, 20);
  assert.equal(summary.accuracy, 99);
  assert.ok(Math.abs(summary.consistency - 79.58758547680685) < 1e-9);
});

test('typing debrief prioritizes accuracy before speed', () => {
  assert.equal(getTypingFocus({ avgWpm: 90, accuracy: 94, consistency: 95, totalMistakes: 6, score: 80 }), 'accuracy');
  assert.equal(getTypingFocus({ avgWpm: 72, accuracy: 99, consistency: 70, totalMistakes: 1, score: 80 }), 'consistency');
  assert.equal(getTypingFocus({ avgWpm: 48, accuracy: 99, consistency: 94, totalMistakes: 1, score: 80 }), 'speed');
  assert.equal(getTypingFocus({ avgWpm: 68, accuracy: 99, consistency: 91, totalMistakes: 1, score: 80 }), 'mastery');
});

test('typing accuracy counts each recorded mistake once', () => {
  assert.equal(getTypingAccuracy(10, 10), 0);
  assert.equal(getTypingAccuracy(2, 100), 98);
});

test('active typing skills surface as their energy thresholds become ready', () => {
  assert.deepEqual(getReadyActiveSkills(39, 100), []);
  assert.deepEqual(getReadyActiveSkills(40, 100), ['firewall']);
  assert.deepEqual(getReadyActiveSkills(55, 100), ['firewall', 'purge']);
  assert.deepEqual(getReadyActiveSkills(100, 100), ['firewall', 'purge', 'focus']);
  assert.deepEqual(getReadyActiveSkills(100, 100, true), []);
});

test('cursor skill stack shows only what the player can actually cast', () => {
  // A key you cannot press is noise next to the caret; the Energy rail already
  // communicates what is still charging.
  assert.deepEqual(getCursorSkillStack(0, 100), []);
  assert.deepEqual(getCursorSkillStack(39, 100), []);
  assert.deepEqual(getCursorSkillStack(40, 100), ['firewall']);
  assert.deepEqual(getCursorSkillStack(55, 100), ['purge', 'firewall']);
  assert.deepEqual(getCursorSkillStack(100, 100), ['focus', 'purge', 'firewall']);
  // Focus Mode is announced by its own banner, so the stack empties while it runs.
  assert.deepEqual(getCursorSkillStack(100, 100, true), []);
});

test('unlocking a skill never moves the ones already next to the caret', () => {
  // The stack renders top-to-bottom, so the last entry sits nearest the caret.
  // Each new unlock must land above the existing entries, not shove them.
  const steps = [0, 40, 55, 100].map((charge) => getCursorSkillStack(charge, 100));
  for (let i = 1; i < steps.length; i += 1) {
    const previous = steps[i - 1];
    const current = steps[i];
    assert.deepEqual(current.slice(current.length - previous.length), previous);
  }
});

test('forgiven typos never increase score', () => {
  assert.equal(calculateSegmentScore({ errors: 0, wpm: 45, type: 'NARRATIVE' }), 12);
  assert.equal(calculateSegmentScore({ errors: 1, wpm: 45, type: 'NARRATIVE' }), 10);
});

test('combo ladder steps at 10, 25 and 50 unbroken keystrokes', () => {
  assert.equal(getComboMultiplier(0), 1);
  assert.equal(getComboMultiplier(9), 1);
  assert.equal(getComboMultiplier(10), 1.5);
  assert.equal(getComboMultiplier(24), 1.5);
  assert.equal(getComboMultiplier(25), 2);
  assert.equal(getComboMultiplier(49), 2);
  assert.equal(getComboMultiplier(50), 3);
});

test('combo multiplier scales segment score', () => {
  const base = calculateSegmentScore({ errors: 0, wpm: 45, type: 'NARRATIVE' });
  assert.equal(calculateSegmentScore({ errors: 0, wpm: 45, type: 'NARRATIVE', comboMultiplier: 3 }), base * 3);
  // Focus doubling and the combo ladder compound rather than replace each other.
  assert.equal(
    calculateSegmentScore({ errors: 0, wpm: 45, type: 'NARRATIVE', overclock: true, comboMultiplier: 2 }),
    base * 4
  );
});

test('combo multiplier never reduces a segment score', () => {
  const base = calculateSegmentScore({ errors: 2, wpm: 45, type: 'NARRATIVE' });
  assert.equal(calculateSegmentScore({ errors: 2, wpm: 45, type: 'NARRATIVE', comboMultiplier: 0 }), base);
});

test('credits stay outside the combo ladder so the shop economy holds', () => {
  const base = calculateSegmentCredits({ errors: 0, type: 'NARRATIVE' });
  assert.equal(calculateSegmentCredits({ errors: 0, type: 'NARRATIVE', comboMultiplier: 3 }), base);
});

test('segment credits reward performance rather than AI sentence length', () => {
  const cleanShort = calculateSegmentCredits({ errors: 0, type: 'NARRATIVE' });
  const cleanLong = calculateSegmentCredits({ errors: 0, type: 'NARRATIVE' });
  const messy = calculateSegmentCredits({ errors: 4, type: 'NARRATIVE' });

  assert.equal(cleanShort, cleanLong);
  assert.ok(cleanShort > messy);
});

test('low-health styling is based on health percentage', () => {
  assert.equal(isLowHealth(20, 20), false);
  assert.equal(isLowHealth(5, 20), true);
  assert.equal(isLowHealth(20, 75), true);
});

test('XP produces real stealth progression', () => {
  assert.equal(getStealthLevel(0), 0);
  assert.equal(getStealthLevel(499), 0);
  assert.equal(getStealthLevel(500), 1);
  assert.equal(getStealthLevel(2_500), 5);
});

test('one typo never costs the good branch, on any line length', () => {
  // A flat allowance on top of the proportional bands, so a short line does not
  // become a coin flip.
  assert.equal(getBranchPerformance(0, 40), 'good');
  assert.equal(getBranchPerformance(1, 40), 'good');
  assert.equal(getBranchPerformance(1, 200), 'good');
});

test('branch thresholds are proportional, so a short line is not a free pass', () => {
  // Same error rate, different lengths, same verdict.
  assert.equal(getBranchPerformance(2, 45), getBranchPerformance(4, 90));
  assert.equal(getBranchPerformance(4, 45), getBranchPerformance(8, 90));
});

test('the bad branch is reachable on a typical line', () => {
  // The old absolute rule needed 5 typos in ~95 characters, which is 95%
  // accuracy — most players never saw the third branch at all.
  assert.equal(getBranchPerformance(2, 95), 'average');
  assert.equal(getBranchPerformance(3, 95), 'average');
  assert.equal(getBranchPerformance(4, 95), 'bad');
});

test('a clean line is good and a wrecked line is bad regardless of length', () => {
  assert.equal(getBranchPerformance(0, 8), 'good');
  assert.equal(getBranchPerformance(30, 95), 'bad');
});

test('branch verdict tolerates degenerate input rather than throwing', () => {
  assert.equal(getBranchPerformance(-5, 95), 'good');
  assert.equal(getBranchPerformance(0, 0), 'good');
  assert.equal(getBranchPerformance(9, 0), 'bad');
});
