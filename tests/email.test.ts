import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendPasswordReset } from '../server/email.ts';

test('password recovery uses Resend, stable hashed idempotency and a bounded timeout', async () => {
  process.env.RESEND_API_KEY = 'test-secret'; process.env.AUTH_EMAIL_FROM = 'Typomancer <no-reply@example.com>';
  const calls: RequestInit[] = [];
  const transport: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails'); calls.push(init!);
    return new Response('{}', { status: 200 });
  };
  await sendPasswordReset('player@example.com', 'https://example.com/reset?token=test-token', 'test-token', transport);
  await sendPasswordReset('player@example.com', 'https://example.com/reset?token=test-token', 'test-token', transport);
  const payload = JSON.parse(calls[0].body as string);
  assert.deepEqual(payload.to, ['player@example.com']);
  assert.match(payload.text, /30 minutes/); assert.match(payload.text, /test-token/);
  assert.ok(calls[0].signal);
  const headers = calls[0].headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer test-secret');
  assert.equal(headers['Idempotency-Key'], (calls[1].headers as Record<string, string>)['Idempotency-Key']);
  assert.ok(!headers['Idempotency-Key'].includes('test-token'));
});

test('provider failure does not expose secret response bodies', async () => {
  process.env.RESEND_API_KEY = 'test-secret'; process.env.AUTH_EMAIL_FROM = 'no-reply@example.com';
  await assert.rejects(sendPasswordReset('player@example.com', 'secret-url', 'secret-token',
    async () => new Response('secret-token test-secret player@example.com', { status: 403 })),
  { message: 'Password recovery email failed (403)' });
  delete process.env.RESEND_API_KEY;
  await assert.rejects(sendPasswordReset('player@example.com', 'url', 'token'), /not configured/);
});
