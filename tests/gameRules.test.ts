import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DECISION_ROUND,
  SECTOR_ROUNDS,
  calculateSegmentCredits,
  calculateSegmentScore,
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

  assert.equal(summary.avgWpm, 50);
  assert.equal(summary.totalMistakes, 2);
  assert.equal(summary.score, 20);
  assert.equal(summary.accuracy, 99);
  assert.equal(summary.consistency, 80);
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

test('forgiven typos never increase score', () => {
  assert.equal(calculateSegmentScore({ errors: 0, wpm: 45, type: 'NARRATIVE' }), 12);
  assert.equal(calculateSegmentScore({ errors: 1, wpm: 45, type: 'NARRATIVE' }), 10);
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
