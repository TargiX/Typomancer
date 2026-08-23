import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('proxies the BotID browser challenge through the application origin', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const rewrites = config.rewrites || [];

  assert.ok(rewrites.some((rewrite: { source?: string; destination?: string }) =>
    rewrite.source?.endsWith('/a-4-a/c.js') &&
    rewrite.destination === 'https://api.vercel.com/bot-protection/v1/challenge'
  ));
  assert.ok(rewrites.some((rewrite: { source?: string; destination?: string }) =>
    rewrite.source?.endsWith('/:path*') &&
    rewrite.destination === 'https://api.vercel.com/bot-protection/v1/proxy/:path*'
  ));
});
