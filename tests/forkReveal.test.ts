import assert from 'node:assert/strict';
import test from 'node:test';

import { buildForkReveal, describeFork } from '../services/forkReveal.ts';
import { StoryMood, SegmentType } from '../types.ts';
import type { BranchingStory } from '../types.ts';

const segment = (text: string) => ({
  text,
  mood: StoryMood.TENSE,
  type: SegmentType.NARRATIVE
});

const branch = (): BranchingStory => ({
  goodPath: segment('You ghost through the checkpoint, letting the patrol chase a decoy heartbeat.'),
  mediumPath: segment('You slip past the checkpoint, but one camera catches a blurred shoulder.'),
  badPath: segment('The checkpoint blooms red; guards pivot toward the echo of your panic.')
});

test('a player who typed the line clean is not told what they missed', () => {
  // They missed nothing. Showing a "missed" line would be false and deflating.
  const reveal = buildForkReveal(branch(), 'good', 0);
  assert.equal(reveal.missedText, undefined);
  assert.equal(reveal.performance, 'good');
});

test('a player who lost the good branch is shown the line it would have given', () => {
  const reveal = buildForkReveal(branch(), 'average', 3);
  assert.equal(reveal.missedText, 'You ghost through the checkpoint, letting the patrol chase a decoy heartbeat.');
  assert.equal(reveal.errors, 3);

  const blown = buildForkReveal(branch(), 'bad', 7);
  assert.equal(blown.missedText, 'You ghost through the checkpoint, letting the patrol chase a decoy heartbeat.');
});

test('a missing branch degrades to a verdict rather than breaking the transition', () => {
  assert.deepEqual(buildForkReveal(null, 'bad', 6), { performance: 'bad', errors: 6 });
  assert.deepEqual(
    buildForkReveal({ goodPath: segment(''), mediumPath: segment('a'), badPath: segment('b') }, 'bad', 2),
    { performance: 'bad', errors: 2 }
  );
});

test('a long missed line is condensed so the reveal stays one glance', () => {
  const long = { ...branch(), goodPath: segment('word '.repeat(80)) };
  const reveal = buildForkReveal(long, 'bad', 5);
  assert.ok((reveal.missedText || '').length < 130);
  assert.ok((reveal.missedText || '').endsWith('…'));
});

test('a negative error count cannot reach the UI', () => {
  assert.equal(buildForkReveal(branch(), 'good', -4).errors, 0);
});

test('every verdict has copy in both languages', () => {
  for (const performance of ['good', 'average', 'bad'] as const) {
    for (const language of ['en', 'ru'] as const) {
      const copy = describeFork(buildForkReveal(branch(), performance, 1), language);
      assert.ok(copy.verdict.length > 0, `${performance}/${language} verdict`);
      assert.ok(copy.detail.length > 0, `${performance}/${language} detail`);
      assert.ok(copy.missedLabel.length > 0, `${performance}/${language} missed label`);
    }
  }
});
