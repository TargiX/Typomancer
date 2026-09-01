import assert from 'node:assert/strict';
import test from 'node:test';

import { isProseSegmentType, repairProseLine } from '../services/proseRepair.ts';

test('a lowercase opening is capitalised', () => {
  // Observed in 2 of 3 generated lines in a live run: the model opens a beat
  // with a bare "you", and the player types the defect verbatim.
  assert.equal(
    repairProseLine('you slip past the dormant security scanner into the darkened data vault.'),
    'You slip past the dormant security scanner into the darkened data vault.'
  );
});

test('a missing full stop is supplied', () => {
  assert.equal(repairProseLine('Rain hisses on your dermal plating'), 'Rain hisses on your dermal plating.');
  assert.equal(repairProseLine('Did the drone see you?'), 'Did the drone see you?');
  assert.equal(repairProseLine('Move!'), 'Move!');
  assert.equal(repairProseLine('The line trails off…'), 'The line trails off…');
});

test('dialogue keeps its opening mark and gets its stop inside the quote', () => {
  assert.equal(
    repairProseLine('"mira, hold the uplink," you whisper.'),
    '"Mira, hold the uplink," you whisper.'
  );
  assert.equal(repairProseLine('"They see me"'), '"They see me."');
  assert.equal(repairProseLine('«они меня видят»'), '«Они меня видят.»');
});

test('an already-terminated quote is left alone', () => {
  assert.equal(repairProseLine('"I am already inside."'), '"I am already inside."');
  assert.equal(repairProseLine('"Wait!"'), '"Wait!"');
});

test('whole-line shouting is brought back to sentence case', () => {
  assert.equal(
    repairProseLine('THE VAULT DOOR SLAMS SHUT BEHIND YOU.'),
    'The vault door slams shut behind you.'
  );
  // Multi-sentence shouting reopens each sentence rather than running together.
  assert.equal(repairProseLine('RUN NOW. THEY SAW YOU.'), 'Run now. They saw you.');
});

test('acronyms and proper nouns survive, because only whole-line caps count', () => {
  const line = 'Arasaka ICE bites back as Nox forces the lock.';
  assert.equal(repairProseLine(line), line);
  // Too few letters to judge as shouting; left as written.
  assert.equal(repairProseLine('ICE bites.'), 'ICE bites.');
});

test('whitespace and space-before-punctuation are normalised', () => {
  assert.equal(repairProseLine('  You   slip\n past , quietly . '), 'You slip past, quietly.');
});

test('cyrillic prose is handled like any other prose', () => {
  assert.equal(
    repairProseLine('ты проходишь пост, и патруль гонится за эхом'),
    'Ты проходишь пост, и патруль гонится за эхом.'
  );
});

test('empty and punctuation-only input does not produce junk', () => {
  assert.equal(repairProseLine(''), '');
  assert.equal(repairProseLine('   '), '');
  assert.equal(repairProseLine('...'), '...');
});

test('repair is idempotent, so a line cannot drift under repeated passes', () => {
  const once = repairProseLine('you slip past the scanner');
  assert.equal(repairProseLine(once), once);
});

test('only prose segment types are repaired; drills are exact by definition', () => {
  assert.equal(isProseSegmentType('NARRATIVE'), true);
  assert.equal(isProseSegmentType('DIALOG'), true);
  // ">> inject_key --silent 47A9" is correct exactly as written.
  assert.equal(isProseSegmentType('BREACH'), false);
  assert.equal(isProseSegmentType('SIGNAL'), false);
});
