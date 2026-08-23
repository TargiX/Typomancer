import assert from 'node:assert/strict';
import test from 'node:test';

import { buildChallengeUrl, getChallengeVerdict, parseChallenge } from '../services/challenge.ts';
import { getDailyBrief } from '../services/dailyMode.ts';
import {
  calculateSegmentScore,
  getTypingFocus,
  summarizeSector
} from '../services/gameRules.ts';
import {
  getDeterministicStoryBranch,
  getDeterministicStrategicDecision
} from '../services/geminiService.ts';
import {
  EMPTY_PLAYER_PROGRESS,
  createCalibrationResult,
  recordRun,
  setCalibration
} from '../services/playerProgress.ts';
import {
  EMPTY_TYPING_TRAINING,
  buildTargetedDrill,
  recordTypingSession
} from '../services/typingTraining.ts';
import type { MissionState } from '../types.ts';

test('player journey connects calibration, Daily play, debrief, targeted practice, and a challenge result', () => {
  const now = new Date('2026-08-23T12:00:00');
  const daily = getDailyBrief(now);
  const calibration = createCalibrationResult(48, 96.5, 24_000, now.toISOString());
  let progress = setCalibration(EMPTY_PLAYER_PROGRESS, calibration);
  assert.equal(progress.calibration?.preset, 'balanced');

  const mission: MissionState = {
    heat: 24,
    trust: 48,
    evidence: 4,
    corruption: 0,
    signal: 68,
    route: 'balanced',
    flags: [],
    consequenceLog: []
  };
  const branch = getDeterministicStoryBranch(daily.genre, 1, 2, 'en', mission);
  const decision = getDeterministicStrategicDecision(daily.genre, 'en', 1, mission);
  assert.equal(branch.goodPath.text.length > 0, true);
  assert.deepEqual(decision.options.map((option) => option.type), ['aggressive', 'stealth']);

  const rounds = Array.from({ length: 7 }, (_, index) => ({
    wpm: 46 + index,
    mistakes: index === 2 ? 2 : 0,
    score: calculateSegmentScore({ errors: index === 2 ? 2 : 0, type: 'NARRATIVE', wpm: 46 + index }),
    characters: 64
  }));
  const debrief = summarizeSector(rounds);
  const focus = getTypingFocus(debrief);
  assert.equal(debrief.accuracy < 100, true);

  progress = recordRun(progress, {
    id: 'daily-journey',
    endedAt: now.toISOString(),
    dateKey: '2026-08-23',
    outcome: 'victory',
    daily: true,
    genre: daily.genre,
    level: 1,
    score: debrief.score,
    wpm: Math.round(debrief.avgWpm),
    bestWpm: 52,
    accuracy: debrief.accuracy,
    consistency: debrief.consistency,
    mistakes: debrief.totalMistakes,
    characters: 448,
    durationSeconds: 330,
    focus
  });
  assert.equal(progress.runs[0].daily, true);

  const training = recordTypingSession(EMPTY_TYPING_TRAINING, [
    { expected: '#', correct: false, latencyMs: 430 },
    { expected: '#', correct: false, latencyMs: 470 },
    { expected: '#', correct: false, latencyMs: 450 }
  ], {
    kind: 'run',
    wpm: Math.round(debrief.avgWpm),
    accuracy: debrief.accuracy,
    completedAt: now.toISOString()
  });
  assert.equal(buildTargetedDrill('en', training).split('#').length - 1 >= 3, true);

  const challengeUrl = buildChallengeUrl('https://typomancer.xyz/', daily.dailyId, debrief.score - 5);
  assert.ok(challengeUrl);
  const challenge = parseChallenge(new URL(challengeUrl).search);
  assert.deepEqual(getChallengeVerdict(challenge, daily.dailyId, debrief.score), {
    outcome: 'beaten',
    delta: 5
  });
});
