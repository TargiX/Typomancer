import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runMonitor, probe, targets, type MonitorEnv } from '../infra/uptime/worker.ts';

function harness() {
  let state: string | null = null;
  let failing = false, rejectMail = false, transient = false;
  const messages: { subject: string; key: string }[] = [];
  const env: MonitorEnv = {
    STATE: { get: async <T>() => state ? JSON.parse(state) as T : null, put: async (_key, value) => { state = value; } },
    RESEND_API_KEY: 'test-only', ALERT_FROM: 'monitor@example.invalid', ALERT_TO: 'owner@example.invalid'
  };
  const send: typeof fetch = async (input, options) => {
    const url = String(input);
    if (url === 'https://api.resend.com/emails') {
      messages.push({ subject: JSON.parse(options!.body as string).subject, key: (options!.headers as Record<string, string>)['Idempotency-Key'] });
      return new Response('{}', { status: rejectMail ? 503 : 200 });
    }
    const target = targets.find(item => item.url === url)!;
    if (target.kind === 'health' && (failing || transient)) { transient = false; return new Response('unavailable', { status: 503 }); }
    if (target.kind === 'html') return new Response('<title>Typomancer — game</title>');
    return Response.json(target.kind === 'session' ? null : target.kind === 'health' ? { status: 'ok' } : { error: 'Sign in required' }, { status: target.status });
  };
  return { env, messages, run: () => runMonitor(env, { send, pause: async () => {}, now: () => new Date('2026-09-18T12:00:00Z') }),
    fail: () => { failing = true; }, recover: () => { failing = false; }, transient: () => { transient = true; },
    rejectMail: (value: boolean) => { rejectMail = value; } };
}

test('uptime retries transient failures and sends one alert per incident plus recovery', async () => {
  const h = harness();
  h.transient(); await h.run(); assert.equal(h.messages.length, 0);
  h.fail(); await h.run(); await h.run();
  assert.equal(h.messages.length, 1); assert.match(h.messages[0].subject, /DOWN/);
  h.recover(); await h.run(); await h.run();
  assert.equal(h.messages.length, 2); assert.match(h.messages[1].subject, /RECOVERED/);
});

test('failed down and recovery email delivery is retried with the same idempotency key', async () => {
  const h = harness(); h.fail(); h.rejectMail(true);
  await assert.rejects(h.run(), /email failed \(503\)/);
  h.rejectMail(false); await h.run();
  assert.equal(h.messages[0].key, h.messages[1].key);
  h.recover(); h.rejectMail(true); await assert.rejects(h.run(), /email failed/);
  h.rejectMail(false); await h.run();
  assert.equal(h.messages[2].key, h.messages[3].key);
});

test('uptime rejects login redirects, wrong JSON, HTML error pages and network failures', async () => {
  for (const target of targets) {
    assert.equal(await probe(target, async () => new Response(null, { status: 302 })), false);
    assert.equal(await probe(target, async () => Response.json({ unexpected: true }, { status: target.status })), false);
    assert.equal(await probe(target, async () => { throw new Error('network'); }), false);
  }
});
