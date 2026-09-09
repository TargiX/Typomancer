import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ANALYTICS_STORAGE_KEY,
  buildPostHogPayload,
  captureProductEvent,
  getAccuracyBucket,
  getAnalyticsIdentity,
  getDeviceClass,
  getDurationBucket,
  getMetricBucket,
  parseCampaignAttribution,
  sanitizeEventProperties
} from '../services/productAnalytics.ts';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test('campaign attribution keeps only short non-sensitive tokens', () => {
  assert.deepEqual(parseCampaignAttribution(
    '?utm_source=Reddit%20Typing&utm_medium=Community&utm_campaign=First%20100&email=private@example.com'
  ), {
    source: 'reddit-typing',
    medium: 'community',
    campaign: 'first-100',
    challenge: false
  });
  assert.deepEqual(parseCampaignAttribution('?challenge=SECTOR-20260823'), {
    source: 'player-challenge',
    medium: 'share',
    campaign: 'daily-challenge',
    challenge: true
  });
});

test('anonymous identity persists without cookies and keeps first-touch attribution', () => {
  const storage = new MemoryStorage();
  const first = getAnalyticsIdentity({
    storage,
    search: '?utm_source=itch',
    randomId: () => 'anonymous-1',
    now: () => new Date('2026-08-23T00:00:00.000Z')
  });
  const second = getAnalyticsIdentity({
    storage,
    search: '?utm_source=show-hn',
    randomId: () => 'anonymous-2'
  });

  assert.equal(storage.getItem(ANALYTICS_STORAGE_KEY) !== null, true);
  assert.equal(first.anonymousId, 'anonymous-1');
  assert.deepEqual(second, first);
});

test('event sanitizer drops raw text and unknown properties', () => {
  const safe = sanitizeEventProperties('typomancer_run_completed', {
    language: 'ru',
    outcome: 'victory',
    wpm_bucket: '50-59',
    raw_text: 'never send this',
    prompt: 'nor this',
    score: 9001
  });

  assert.deepEqual(safe, {
    source: 'direct',
    medium: 'none',
    campaign: 'none',
    challenge: false,
    language: 'ru',
    outcome: 'victory',
    wpm_bucket: '50-59'
  });
});

test('PostHog payload is anonymous and does not create a person profile', () => {
  const identity = getAnalyticsIdentity({
    storage: new MemoryStorage(),
    randomId: () => 'anonymous-1',
    now: () => new Date('2026-08-23T00:00:00.000Z')
  });
  const payload = buildPostHogPayload('phc_public', 'typomancer_landing_viewed', identity, {
    language: 'en',
    device_class: 'desktop'
  });

  assert.equal(payload.api_key, 'phc_public');
  assert.equal(payload.distinct_id, 'anonymous-1');
  assert.equal(payload.properties.$process_person_profile, false);
  assert.equal('raw_text' in payload.properties, false);
});

test('measurement buckets are stable and bounded', () => {
  assert.equal(getDeviceClass(390), 'mobile');
  assert.equal(getDeviceClass(800), 'tablet');
  assert.equal(getDeviceClass(1440), 'desktop');
  assert.equal(getMetricBucket(57), '50-59');
  assert.equal(getMetricBucket(999), '200-plus');
  assert.equal(getAccuracyBucket(97.8), '95-97');
  assert.equal(getAccuracyBucket(100), '100');
  assert.equal(getDurationBucket(301), '3-7m');
});

test('capture is provider-gated and posts only the anonymous allowlisted payload', async () => {
  const requests: Array<{ url: string; body: string }> = [];
  const send = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), body: String(init?.body) });
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  captureProductEvent('typomancer_run_completed', { raw_text: 'private' }, { fetch: send });
  assert.equal(requests.length, 0);

  captureProductEvent('typomancer_run_completed', {
    outcome: 'victory',
    raw_text: 'private'
  }, {
    fetch: send,
    projectToken: 'phc_public',
    host: 'https://eu.i.posthog.com/',
    storage: new MemoryStorage(),
    randomId: () => 'anonymous-2'
  });
  await Promise.resolve();

  assert.equal(requests[0].url, 'https://eu.i.posthog.com/i/v0/e/');
  assert.equal(requests[0].body.includes('private'), false);
  assert.equal(requests[0].body.includes('anonymous-2'), true);
});

 test('authored mission attribution survives start and completion sanitization without story text', () => {
  for (const event of ['typomancer_run_started', 'typomancer_run_completed'] as const) {
    const payload = sanitizeEventProperties(event, { mission: 'last_relay', story: 'Mira is trapped', typed_text: 'secret' });
    assert.equal(payload.mission, 'last_relay');
    assert.equal('story' in payload, false);
    assert.equal('typed_text' in payload, false);
  }
});
