// Run only against a disposable test database, never a production URL.
// PROGRESS_TEST_URL=http://... pnpm exec tsx --test tests/progress.integration.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSnapshot } from '../services/cloudProgress.ts';

const base = process.env.PROGRESS_TEST_URL;
test('real PostgreSQL: authentication, ownership, retry, CAS race, history and relogin', { skip: !base }, async () => {
  assert.match(new URL(base!).hostname, /^(127\.0\.0\.1|.*\.localhost)$/);
  const origin = new URL(base!).origin;
  const request = async (path: string, method = 'GET', body?: unknown, cookie = '', extra = {}) => {
    const response = await fetch(base + path, { method, headers: {
      origin, 'content-type': 'application/json', cookie, ...extra
    }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json(),
      cookie: response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') };
  };
  assert.equal((await request('/api/progress')).status, 401);
  const suffix = crypto.randomUUID(); const password = crypto.randomUUID();
  const email = `progress-${suffix}@example.invalid`;
  const a = await request('/api/auth/sign-up/email', 'POST', { email, password, name: 'Integration A' });
  assert.equal(a.status, 200, JSON.stringify(a.body)); assert.ok(a.cookie);
  const b = await request('/api/auth/sign-up/email', 'POST', { email: `other-${suffix}@example.invalid`, password, name: 'Integration B' });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  const fresh = await request('/api/progress', 'GET', undefined, a.cookie);
  assert.equal(fresh.body.revision, 0);
  const emptyStorage = { length: 0, getItem: () => null } as unknown as Storage;
  const snapshot = readSnapshot(emptyStorage);
  snapshot.profile.credits = 777;
  snapshot.progress.runs = [{ id: crypto.randomUUID(), endedAt: new Date().toISOString(), dateKey: '2026-09-16',
    outcome: 'victory', daily: false, genre: 'cyberpunk', level: 2, score: 100, wpm: 70, bestWpm: 80,
    accuracy: 98, consistency: 90, mistakes: 2, characters: 200, durationSeconds: 60, focus: 'speed', pact: [] }];
  const input = { userId: a.body.user.id, revision: 0, mutationId: crypto.randomUUID(), snapshot };
  assert.equal((await request('/api/progress', 'PUT', input, a.cookie, { origin: 'https://evil.invalid' })).status, 403);
  assert.equal((await request('/api/progress', 'PUT', input, b.cookie)).status, 409);
  assert.equal((await request('/api/progress', 'PUT', { ...input, snapshot: { version: 99 } }, a.cookie)).status, 400);
  const saved = await request('/api/progress', 'PUT', input, a.cookie);
  assert.equal(saved.status, 200, JSON.stringify(saved.body)); assert.equal(saved.body.revision, 1);
  const retry = await request('/api/progress', 'PUT', input, a.cookie);
  assert.equal(retry.body.revision, 1);
  assert.equal((await request('/api/progress', 'GET', undefined, b.cookie)).body.snapshot, null);
  const race = await Promise.all([1, 2].map(credits => request('/api/progress', 'PUT', {
    ...input, revision: 1, mutationId: crypto.randomUUID(), snapshot: { ...snapshot, profile: { ...snapshot.profile, credits } }
  }, a.cookie)));
  assert.deepEqual(race.map(result => result.status).sort(), [200, 409]);
  const exported = await request('/api/progress/export', 'GET', undefined, a.cookie);
  assert.equal(exported.body.runs.length, 1, 'retries and snapshots must not duplicate run history');
  assert.equal((await request('/api/auth/sign-out', 'POST', {}, a.cookie)).status, 200);
  assert.equal((await request('/api/progress', 'GET', undefined, a.cookie)).status, 401);
  const login = await request('/api/auth/sign-in/email', 'POST', { email, password });
  assert.equal(login.status, 200);
  const restored = await request('/api/progress', 'GET', undefined, login.cookie);
  assert.equal(restored.body.revision, 2); assert.equal(restored.body.snapshot.progress.runs[0].wpm, 70);
});
