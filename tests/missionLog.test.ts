import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_CONSEQUENCE_ENTRIES,
  appendConsequence,
  describeDecisionBeat,
  describeSegmentBeat,
  getRecentConsequences
} from '../services/missionLog.ts';

test('a logged beat carries the story, not the meter arithmetic', () => {
  const entry = describeSegmentBeat(
    'The checkpoint blooms red; guards pivot toward the echo of your panic.',
    'bad',
    'en'
  );
  assert.equal(entry, 'BLOWN: The checkpoint blooms red; guards pivot toward the echo of your panic.');
  assert.ok(!/EVIDENCE|HEAT|TRUST|[+-]\d/.test(entry), `meter noise leaked into the log: ${entry}`);
});

test('the tag records how the player handled the beat, which the story text cannot', () => {
  const text = 'You slip past the checkpoint.';
  assert.match(describeSegmentBeat(text, 'good', 'en'), /^CLEAN: /);
  assert.match(describeSegmentBeat(text, 'average', 'en'), /^MESSY: /);
  assert.match(describeSegmentBeat(text, 'bad', 'en'), /^BLOWN: /);
  assert.match(describeSegmentBeat(text, 'good', 'ru'), /^ЧИСТО: /);
});

test('decisions are logged as the choice the player made', () => {
  assert.equal(
    describeDecisionBeat('Crack the server open and rip out the Black Ledger', 'en'),
    'CHOSE: Crack the server open and rip out the Black Ledger'
  );
});

test('a long beat is condensed so one entry cannot swallow the prompt or the dossier', () => {
  const entry = describeSegmentBeat('word '.repeat(80), 'good', 'en');
  assert.ok(entry.length < 140, `entry was ${entry.length} chars`);
  assert.ok(entry.endsWith('…'));
});

test('whitespace in generated text is normalised before it reaches either reader', () => {
  assert.equal(describeSegmentBeat('  You   slip\n past. ', 'good', 'en'), 'CLEAN: You slip past.');
});

test('the log stays newest-first and bounded', () => {
  let log: string[] = [];
  for (let i = 1; i <= MAX_CONSEQUENCE_ENTRIES + 4; i += 1) log = appendConsequence(log, `beat ${i}`);
  assert.equal(log.length, MAX_CONSEQUENCE_ENTRIES);
  assert.equal(log[0], `beat ${MAX_CONSEQUENCE_ENTRIES + 4}`);
});

test('recent consequences are the newest entries, read oldest to newest', () => {
  // Stored newest-first; the story prompt used to take slice(-3) and so received
  // the three oldest entries under the label "recent".
  const log = ['beat 5', 'beat 4', 'beat 3', 'beat 2', 'beat 1'];
  assert.deepEqual(getRecentConsequences(log, 3), ['beat 3', 'beat 4', 'beat 5']);
  assert.deepEqual(getRecentConsequences(log, 0), []);
  assert.deepEqual(getRecentConsequences([], 3), []);
  assert.deepEqual(getRecentConsequences(log, 99).length, log.length);
});
