import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChallengeUrl, getChallengeVerdict, parseChallenge } from '../services/challenge.ts';

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

test('challenge verdict reports whether the player beat the exact incoming target', () => {
  const challenge = { dailyId: 'SECTOR-20260823' as const, targetScore: 4200 };
  assert.deepEqual(getChallengeVerdict(challenge, 'SECTOR-20260823', 4380), { outcome: 'beaten', delta: 180 });
  assert.deepEqual(getChallengeVerdict(challenge, 'SECTOR-20260823', 4100), { outcome: 'missed', delta: -100 });
  assert.deepEqual(getChallengeVerdict(challenge, 'SECTOR-20260823', 4200), { outcome: 'tied', delta: 0 });
  assert.equal(getChallengeVerdict(challenge, 'SECTOR-20260824', 9999), null);
});
