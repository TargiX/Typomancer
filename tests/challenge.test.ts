import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChallengeShareUrl, buildChallengeUrl, getChallengeVerdict, parseChallenge } from '../services/challenge.ts';
import challengeHandler from '../api/challenge.ts';

test('challenge links preserve only a validated daily sector and score target', () => {
  const url = buildChallengeUrl('https://typomancer.xyz/path?old=1#hash', 'SECTOR-20260823', 4123.9);
  assert.equal(url, 'https://typomancer.xyz/path?challenge=SECTOR-20260823&target=4123&utm_source=player-challenge&utm_medium=share&utm_campaign=daily-challenge');
  assert.deepEqual(parseChallenge(new URL(url!).search), {
    dailyId: 'SECTOR-20260823',
    targetScore: 4123
  });
});

test('challenge parser rejects malformed or missing targets', () => {
  assert.equal(parseChallenge('?challenge=../../private&target=10'), null);
  assert.equal(parseChallenge('?challenge=SECTOR-20260823&target=nope'), null);
  assert.equal(buildChallengeUrl('javascript:alert(1)', 'SECTOR-20260823', 10), null);
});

test('share urls route through the og wrapper and keep the validated params', () => {
  const url = buildChallengeShareUrl('https://typomancer.xyz', 'SECTOR-20260823', 4123.9, 'ru');
  assert.equal(url, 'https://typomancer.xyz/api/challenge?d=SECTOR-20260823&s=4123&l=ru&r=daily-v2');
  assert.equal(buildChallengeShareUrl('javascript:alert(1)', 'SECTOR-20260823', 10), null);
  assert.equal(buildChallengeShareUrl('https://typomancer.xyz', 'nope', 10), null);
});

const fakeRes = () => {
  const headers: Record<string, string> = {};
  let body = '';
  return {
    statusCode: 0,
    setHeader(name: string, value: string) { headers[name.toLowerCase()] = value; },
    end(chunk?: string) { body = chunk || ''; },
    headers,
    get body() { return body; }
  };
};

test('challenge wrapper gives crawlers og meta and humans a redirect into the app', () => {
  const res = fakeRes();
  challengeHandler(
    { url: '/api/challenge?d=SECTOR-20260823&s=4123', headers: { host: 'typomancer.xyz', 'x-forwarded-proto': 'https' } },
    res as any
  );

  assert.equal(res.statusCode, 200);
  assert.match(res.body, /og:image.*api\/og\?d=SECTOR-20260823&s=4123/);
  assert.match(res.body, /challenge=SECTOR-20260823&target=4123/);
  assert.match(res.body, /utm_source=player-challenge/);
});

test('challenge wrapper rejects malformed daily ids', () => {
  const res = fakeRes();
  challengeHandler(
    { url: '/api/challenge?d=../../private&s=1', headers: { host: 'typomancer.xyz' } },
    res as any
  );

  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, '/');
});

test('challenge verdict reports whether the player beat the exact incoming target', () => {
  const challenge = { dailyId: 'SECTOR-20260823' as const, targetScore: 4200 };
  assert.deepEqual(getChallengeVerdict(challenge, 'SECTOR-20260823', 4380), { outcome: 'beaten', delta: 180 });
  assert.deepEqual(getChallengeVerdict(challenge, 'SECTOR-20260823', 4100), { outcome: 'missed', delta: -100 });
  assert.deepEqual(getChallengeVerdict(challenge, 'SECTOR-20260823', 4200), { outcome: 'tied', delta: 0 });
  assert.equal(getChallengeVerdict(challenge, 'SECTOR-20260824', 9999), null);
});
