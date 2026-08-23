import assert from 'node:assert/strict';
import test from 'node:test';

import { verifyBrowserRequest } from '../services/botProtection.ts';

test('allows a verified browser request', async () => {
  const result = await verifyBrowserRequest({}, 'production', async () => ({ isBot: false }));
  assert.deepEqual(result, { allowed: true });
});

test('rejects BotID-classified automation before an AI call', async () => {
  const result = await verifyBrowserRequest({}, 'production', async () => ({ isBot: true }));
  assert.deepEqual(result, { allowed: false, status: 403, error: 'Automated request blocked' });
});

test('fails closed on BotID errors in Vercel environments', async () => {
  const checker = async () => { throw new Error('verification unavailable'); };
  assert.deepEqual(
    await verifyBrowserRequest({}, 'preview', checker),
    { allowed: false, status: 503, error: 'Request verification unavailable' }
  );
  assert.deepEqual(
    await verifyBrowserRequest({}, 'production', checker),
    { allowed: false, status: 503, error: 'Request verification unavailable' }
  );
});

test('keeps local development usable if BotID is unavailable', async () => {
  const result = await verifyBrowserRequest({}, undefined, async () => {
    throw new Error('not running on Vercel');
  });
  assert.deepEqual(result, { allowed: true });
});
