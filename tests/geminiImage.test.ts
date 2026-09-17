import assert from 'node:assert/strict';
import test from 'node:test';

import { extractInteractionImage } from '../services/geminiImage.ts';

test('reads the SDK output_image convenience field', () => {
  const image = extractInteractionImage({
    output_image: { type: 'image', data: 'abc', mime_type: 'image/png' }
  });
  assert.deepEqual(image, { data: 'abc', mimeType: 'image/png' });
});

test('reads a legacy outputs inlineData payload', () => {
  const image = extractInteractionImage({
    outputs: [{ parts: [{ inlineData: { data: 'old', mimeType: 'image/jpeg' } }] }]
  });
  assert.deepEqual(image, { data: 'old', mimeType: 'image/jpeg' });
});

test('reads a post-June 2026 steps timeline image', () => {
  const image = extractInteractionImage({
    status: 'completed',
    steps: [
      { type: 'user_input', content: [{ type: 'text', text: 'draw this' }] },
      {
        type: 'model_output',
        content: [
          { type: 'text', text: 'here' },
          { type: 'image', data: 'step-png', mime_type: 'image/png' }
        ]
      }
    ]
  });
  assert.deepEqual(image, { data: 'step-png', mimeType: 'image/png' });
});

test('returns null when the interaction has no image', () => {
  assert.equal(extractInteractionImage({ steps: [{ type: 'model_output', content: [{ type: 'text', text: 'nope' }] }] }), null);
  assert.equal(extractInteractionImage(null), null);
});
