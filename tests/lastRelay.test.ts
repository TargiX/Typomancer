import assert from 'node:assert/strict';
import test from 'node:test';
import { LAST_RELAY, getRelayStart, getRelayBranch, getRelayDecision, getRelayBeatImpact, getRelayEnding, isLastRelay } from '../services/lastRelay.ts';
import { normalizeRunCheckpoint } from '../services/runCheckpoint.ts';
import type { DecisionImpact, Language, MissionState } from '../types.ts';

const start = (): MissionState => ({ heat: 18, trust: 44, evidence: 0, route: 'balanced', flags: [LAST_RELAY], consequenceLog: [] });
const commit = (mission: MissionState, impact: DecisionImpact): MissionState => ({
  ...mission, flags: impact.flag ? [...mission.flags, impact.flag] : mission.flags,
  heat: mission.heat + (impact.heat || 0), trust: mission.trust + (impact.trust || 0),
  evidence: mission.evidence + (impact.evidence || 0), route: impact.route || mission.route
});

test('camera performance changes both the next scene and the later escape challenge', () => {
  const mission = start();
  const camera = getRelayBranch(1, 2, 'en', mission).goodPath;
  const clean = commit(mission, getRelayBeatImpact(mission, camera, 'good'));
  const spotted = commit(mission, getRelayBeatImpact(mission, camera, 'average'));
  assert.match(getRelayBranch(1, 3, 'en', spotted).goodPath.text, /lift locks/);
  assert.match(getRelayBranch(1, 3, 'en', clean).goodPath.text, /service lift/);
  const easy = getRelayBranch(1, 6, 'en', clean).goodPath;
  const hard = getRelayBranch(1, 6, 'en', spotted).goodPath;
  assert.ok(hard.text.length > easy.text.length * 1.5);
  assert.ok(hard.pressure! > easy.pressure!);
  assert.deepEqual(getRelayBeatImpact(spotted, camera, 'good'), {});
});

test('saving Mira buys one trace clear and lowers final pressure, without typing the upload for you', () => {
  let mission = start();
  const aloneFinal = getRelayBranch(2, 7, 'en', mission).goodPath;
  mission = commit(mission, getRelayDecision(1, 'en', mission).options[0].impact!);
  const cover = getRelayBranch(2, 5, 'en', mission).goodPath;
  const benefit = getRelayBeatImpact(mission, cover, 'bad');
  assert.equal(benefit.trace, -18);
  mission = commit(mission, benefit);
  assert.deepEqual(getRelayBeatImpact(mission, cover, 'good'), {});
  const final = getRelayBranch(2, 7, 'en', mission).goodPath;
  assert.ok(final.pressure! < aloneFinal.pressure!);
  assert.equal(getRelayBeatImpact(mission, final, 'bad').flag, 'relay:fragment');
  assert.equal(getRelayBeatImpact(mission, final, 'good').flag, 'relay:published');
});

test('redaction trades a longer verification for privacy', () => {
  const mission = start();
  const decision = getRelayDecision(2, 'en', mission);
  const original = commit(mission, decision.options[0].impact!);
  const redacted = commit(mission, decision.options[1].impact!);
  assert.ok(getRelayBranch(2, 6, 'en', redacted).goodPath.text.length > getRelayBranch(2, 6, 'en', original).goodPath.text.length * 1.5);
});

for (const language of ['en', 'ru'] as Language[]) {
  test(`all choices survive a checkpoint and reach consistent endings (${language})`, () => {
    for (const cameraPerformance of ['good', 'bad'] as const) {
      for (const rescue of [true, false]) {
        for (const redact of [true, false]) {
          for (const uploadPerformance of ['good', 'average', 'bad'] as const) {
            let mission = start();
            mission = commit(mission, getRelayBeatImpact(mission, getRelayBranch(1, 2, language, mission).goodPath, cameraPerformance));
            mission = commit(mission, getRelayDecision(1, language, mission).options[rescue ? 0 : 1].impact!);
            const saved = normalizeRunCheckpoint({ version: 1, nextLevel: 2, health: 80, genre: 'cyberpunk', narrativeContext: 'Relay', totalScore: 500, perks: [], mission });
            assert.ok(saved);
            assert.ok(isLastRelay(saved.mission));
            mission = saved.mission;
            assert.match(getRelayStart(2, language, mission).text, rescue ? /Mira reaches|Мира выходит/ : /alone|один/);
            mission = commit(mission, getRelayDecision(2, language, mission).options[redact ? 1 : 0].impact!);
            const cover = getRelayBranch(2, 5, language, mission).goodPath;
            mission = commit(mission, getRelayBeatImpact(mission, cover, 'good'));
            const final = getRelayBranch(2, 7, language, mission).goodPath;
            mission = commit(mission, getRelayBeatImpact(mission, final, uploadPerformance));
            const ending = getRelayEnding(mission, language);
            assert.match(ending.summary, uploadPerformance === 'good' ? /publishes|публикует/ : /unverified|неподтверждённый/);
            assert.match(ending.summary, rescue ? /escapes with you|уходит вместе/ : /remains behind|остаётся за дверью/);
            assert.match(ending.summary, redact ? /address private|адрес скрыт/ : /identity travels|имя уходит/);
            for (const level of [1, 2]) for (const round of [2, 3, 5, 6, 7]) {
              const segment = getRelayBranch(level, round, language, mission).goodPath;
              assert.match(segment.text, /^[\p{Lu}]/u);
              assert.match(segment.text, /[.!?]["»]?$/);
            }
          }
        }
      }
    }
  });
}

test('mission events cannot modify ordinary campaigns or daily missions', () => {
  const ordinary = { ...start(), flags: [] };
  assert.equal(isLastRelay(ordinary), false);
  const camera = getRelayBranch(1, 2, 'en', start()).goodPath;
  assert.deepEqual(getRelayBeatImpact(ordinary, camera, 'bad'), {});
});
