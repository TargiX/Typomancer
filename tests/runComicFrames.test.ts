import assert from 'node:assert/strict';
import test from 'node:test';

import { selectRunComicFrames } from '../services/runComicFrames.ts';
import type { ComicFrame } from '../types.ts';

const frame = (image: string | null, caption: string, level = 1): ComicFrame => ({
  image,
  caption,
  level,
  performance: 'good'
});

test('run comic includes each generated image only once', () => {
  const selected = selectRunComicFrames([
    frame('data:image/png;base64,held-shot', 'The relay wakes.'),
    frame('data:image/png;base64,held-shot', 'The same relay flickers.'),
    frame('data:image/png;base64,new-shot', 'The operator escapes.')
  ], 6);

  assert.deepEqual(selected.map((item) => item.caption), [
    'The relay wakes.',
    'The operator escapes.'
  ]);
});

test('run comic spreads its limit across unique visual beats', () => {
  const selected = selectRunComicFrames([
    frame(null, 'Image is still loading.'),
    frame('image-a', 'Beat A'),
    frame('image-a', 'Beat A continued'),
    frame('image-b', 'Beat B'),
    frame('image-c', 'Beat C'),
    frame('image-d', 'Beat D')
  ], 3);

  assert.deepEqual(selected.map((item) => item.image), ['image-a', 'image-c', 'image-d']);
});

test('run comic keeps caption-only beats when no image was available', () => {
  const selected = selectRunComicFrames([
    frame(null, 'Opening'),
    frame(null, 'Escape')
  ], 6);

  assert.deepEqual(selected.map((item) => item.caption), ['Opening', 'Escape']);
});
