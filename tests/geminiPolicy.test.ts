import assert from 'node:assert/strict';
import test from 'node:test';

import { GEMINI_IMAGE_SIZE, isAllowedRequestSourceHeaders } from '../services/geminiPolicy.ts';

test('allows Gemini requests from the production custom domains', () => {
  for (const hostname of ['typomancer.xyz', 'www.typomancer.xyz']) {
    const source = `https://${hostname}/play`;
    assert.equal(isAllowedRequestSourceHeaders(source, source), true);
  }
});

test('rejects Gemini requests when either browser source header is untrusted', () => {
  assert.equal(
    isAllowedRequestSourceHeaders('https://typomancer.xyz', 'https://example.com'),
    false
  );
});

test('requests the resolution supported by Gemini 3.1 Flash Lite Image', () => {
  assert.equal(GEMINI_IMAGE_SIZE, '1K');
});
