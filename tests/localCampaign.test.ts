import assert from 'node:assert/strict';
import test from 'node:test';

import { getDeterministicStoryBranch } from '../services/geminiService.ts';
import { CAMPAIGN_SECTORS, SECTOR_ROUNDS } from '../services/gameRules.ts';
import { GENRE_ORDER } from '../services/genreConfig.ts';
import type { Language, MissionState } from '../types.ts';

const LANGUAGES: Language[] = ['en', 'ru'];

const seedMission = (): MissionState => ({
  heat: 18,
  trust: 44,
  evidence: 0,
  route: 'balanced',
  flags: [],
  consequenceLog: []
});

/** A clean run: evidence climbs, heat falls. This is the drift that broke the old seed. */
const afterCleanRound = (mission: MissionState): MissionState => ({
  ...mission,
  evidence: Math.min(100, mission.evidence + 3),
  heat: Math.max(0, mission.heat - 3)
});

const playCampaign = (genre: (typeof GENRE_ORDER)[number], language: Language): string[][] => {
  const sectors: string[][] = [];
  let mission = seedMission();
  for (let level = 1; level <= CAMPAIGN_SECTORS; level += 1) {
    const lines: string[] = [];
    for (let round = 1; round <= SECTOR_ROUNDS; round += 1) {
      lines.push(getDeterministicStoryBranch(genre, level, round, language, mission).goodPath.text);
      mission = afterCleanRound(mission);
    }
    sectors.push(lines);
  }
  return sectors;
};

test('the offline campaign never serves the same line twice in a row', () => {
  for (const genre of GENRE_ORDER) {
    for (const language of LANGUAGES) {
      playCampaign(genre, language).forEach((lines, sectorIndex) => {
        for (let round = 1; round < lines.length; round += 1) {
          assert.notEqual(
            lines[round],
            lines[round - 1],
            `${genre}/${language} sector ${sectorIndex + 1} repeated round ${round + 1}: ${lines[round]}`
          );
        }
      });
    }
  }
});

test('a clean run cannot flatten the rotation, which is what the old seed did', () => {
  // Evidence +3 and heat -3 cancelled out in the old seed, leaving round * 5
  // against a five-template pool: every round of the final sector was identical.
  for (const genre of GENRE_ORDER) {
    const sectors = playCampaign(genre, 'en');
    sectors.forEach((lines, sectorIndex) => {
      assert.ok(
        new Set(lines).size > 1,
        `${genre} sector ${sectorIndex + 1} used a single line for all ${lines.length} rounds`
      );
    });
  }
});

test('template choice ignores mission drift, so two runs of a sector pace identically', () => {
  const calm = getDeterministicStoryBranch('cyberpunk', 2, 3, 'en', seedMission());
  const hostile = getDeterministicStoryBranch('cyberpunk', 2, 3, 'en', {
    ...seedMission(),
    heat: 91,
    evidence: 44,
    trust: 12
  });
  assert.equal(calm.goodPath.text, hostile.goodPath.text);
});
