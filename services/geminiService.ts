import {
  StoryMood,
  SegmentType
} from "../types.ts";
import type {
  BranchingStory,
  StorySegment,
  LevelReport,
  DecisionPoint,
  Language,
  MissionState,
  TypingSkill,
  StoryGenreId
} from "../types.ts";
import { getGenrePack, type LocalBranchTemplate } from "./genreConfig.ts";
import { SECTOR_ROUNDS } from "./gameRules.ts";

type Schema = Record<string, unknown>;

const Type = {
  OBJECT: 'OBJECT',
  STRING: 'STRING'
} as const;

type GeminiResponse = {
  text?: string;
  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
};

const callGemini = async (model: string, contents: string, config?: Record<string, unknown>): Promise<GeminiResponse | null> => {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, contents, config })
  });

  if (!response.ok) return null;
  return response.json();
};

const ai = {
  models: {
    generateContent: async ({ model, contents, config }: { model: string; contents: string; config?: Record<string, unknown> }) => {
      const response = await callGemini(model, contents, config);
      if (!response) throw new Error('Gemini proxy unavailable');
      return response;
    }
  }
};

const TEXT_MODEL = "gemini-flash-lite-latest";
const FINAL_LEVEL = 4;
let remoteImageRetryAfter = 0;
let lastImageDataUrl: string | null = null;
let lastGenre: StoryGenreId | null = null;
const sceneImageCache = new Map<string, string>();
const SCENE_IMAGE_CACHE_CAPACITY = 20;

const cheapStringHash = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const getSceneImageCacheKey = (genre: StoryGenreId, sceneDescription: string): string => (
  cheapStringHash(`${genre}\u0000${sceneDescription}`)
);

const cacheSceneImage = (key: string, dataUrl: string) => {
  sceneImageCache.delete(key);
  sceneImageCache.set(key, dataUrl);

  if (sceneImageCache.size > SCENE_IMAGE_CACHE_CAPACITY) {
    const oldestKey = sceneImageCache.keys().next().value;
    if (oldestKey) sceneImageCache.delete(oldestKey);
  }
};

const segmentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "Narrative sentence, dialogue, signal string, or terminal command." },
    mood: { type: Type.STRING, enum: [StoryMood.HOPEFUL, StoryMood.TENSE, StoryMood.NEUTRAL, StoryMood.DARK] },
    type: { type: Type.STRING, enum: [SegmentType.NARRATIVE, SegmentType.BREACH, SegmentType.DIALOG, SegmentType.SIGNAL] },
    skill: { type: Type.STRING, enum: ['flow', 'precision', 'symbols', 'numbers', 'punctuation'] },
    objective: { type: Type.STRING },
    consequenceHint: { type: Type.STRING }
  },
  required: ["text", "mood", "type"]
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    goodPath: segmentSchema,
    mediumPath: segmentSchema,
    badPath: segmentSchema
  },
  required: ["goodPath", "mediumPath", "badPath"]
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const pick = <T,>(items: T[], seed: number): T => items[Math.abs(seed) % items.length];

const cleanAndParseJSON = <T>(text: string): T => {
  try {
    return JSON.parse(text);
  } catch (e) {
    const clean = text.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(clean);
  }
};

const sanitizeSegment = (segment: StorySegment | undefined, fallbackSkill: TypingSkill = 'flow'): StorySegment => {
  if (!segment || !segment.text) {
    return {
      text: "Signal interference corrupts the feed; stabilize the link before moving.",
      mood: StoryMood.TENSE,
      type: SegmentType.NARRATIVE,
      skill: fallbackSkill,
      objective: "Recover signal"
    };
  }
  const type = segment.type || SegmentType.NARRATIVE;
  const defaultSkill: TypingSkill = type === SegmentType.BREACH ? 'symbols' : type === SegmentType.SIGNAL ? 'numbers' : type === SegmentType.DIALOG ? 'punctuation' : fallbackSkill;
  return {
    ...segment,
    text: segment.text.trim().replace(/\s+/g, ' '),
    type,
    skill: segment.skill || defaultSkill,
    objective: segment.objective || getDefaultObjective(type, segment.skill || defaultSkill),
    pressure: typeof segment.pressure === 'number' ? clamp(segment.pressure, 0, 5) : undefined
  };
};

const sanitizeBranch = (branch: BranchingStory): BranchingStory => ({
  goodPath: sanitizeSegment(branch.goodPath, 'precision'),
  mediumPath: sanitizeSegment(branch.mediumPath || branch.goodPath, 'flow'),
  badPath: sanitizeSegment(branch.badPath, 'flow')
});

const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
};

const getDefaultObjective = (type: SegmentType, skill: TypingSkill) => {
  if (type === SegmentType.BREACH) return 'Exact code: symbols matter';
  if (type === SegmentType.SIGNAL) return 'Decode numbers without hesitation';
  if (type === SegmentType.DIALOG) return 'Keep punctuation and quotes clean';
  if (skill === 'precision') return 'Clean typing lowers heat';
  return 'Maintain flow under pressure';
};

const makeSegment = (
  text: string,
  mood: StoryMood,
  type: SegmentType,
  skill: TypingSkill,
  objective: string,
  pressure: number,
  consequenceHint?: string
): StorySegment => sanitizeSegment({ text, mood, type, skill, objective, pressure, consequenceHint }, skill);

const getLocalBranch = (
  genre: StoryGenreId,
  level: number,
  round: number,
  language: Language,
  mission?: MissionState
): BranchingStory => {
  const pack = getGenrePack(genre);
  const allTemplates = pack.branches[language];
  // Pacing: the core loop is typing STORY prose. Code/number drills (BREACH/SIGNAL)
  // are rare spice that only appears from mid-run and peaks at the climax — never in
  // the opening rounds, where the player should just read and type the story.
  const isDrill = (t: LocalBranchTemplate) => t.type === SegmentType.BREACH || t.type === SegmentType.SIGNAL;
  const proseTemplates = allTemplates.filter(t => !isDrill(t));
  const templatesFor = (r: number) => {
    const drillsAllowed = level >= FINAL_LEVEL || r >= SECTOR_ROUNDS - 1 || (r >= 4 && ((level * 7 + r * 3) % 3 === 0));
    return drillsAllowed && proseTemplates.length ? allTemplates : (proseTemplates.length ? proseTemplates : allTemplates);
  };

  // The round must advance the pool by exactly one. The old seed added round * 5
  // to a mission term that drifts by roughly zero on a clean run (evidence up 3,
  // heat down 3), and 5 % 5 === 0 against a five-template pool — so sector four
  // served the identical line all seven rounds.
  // Resolved from round 1 forward, because the step-off below changes what the
  // previous round actually served — comparing against the raw pick would let a
  // corrected round collide with the next one.
  const resolveTemplate = (r: number): LocalBranchTemplate => {
    const pool = templatesFor(r);
    const candidate = pool[Math.abs((level * 3) + r) % pool.length];
    if (r <= 1) return candidate;
    // The pool widens once mid-sector when drills unlock, and the wider pool can
    // land back on the line we just used. Step off it.
    if (candidate !== resolveTemplate(r - 1)) return candidate;
    return pool[(pool.indexOf(candidate) + 1) % pool.length];
  };

  const template = resolveTemplate(round);
  const type = template.type || SegmentType.NARRATIVE;
  const heat = mission?.heat || 0;
  const pressure = clamp(Math.round((heat / 25) + (round / 4)), 1, 5);
  const goodHint = language === 'ru' ? '+улики, -угроза' : '+evidence, -heat';
  const mediumHint = language === 'ru' ? '+след, путь сохранен' : '+trace, route intact';
  const badHint = language === 'ru' ? '+коррупция, мир запоминает ошибку' : '+corruption, world remembers';

  return sanitizeBranch({
    goodPath: makeSegment(template.good, StoryMood.HOPEFUL, type, template.skill, template.objective, pressure, goodHint),
    mediumPath: makeSegment(template.medium, StoryMood.TENSE, type, template.skill, template.objective, pressure + 1, mediumHint),
    badPath: makeSegment(template.bad, StoryMood.DARK, type === SegmentType.BREACH ? SegmentType.SIGNAL : type, template.skill, template.objective, pressure + 2, badHint)
  });
};

const getLocalDecision = (genre: StoryGenreId, language: Language, level: number, mission?: MissionState): DecisionPoint => {
  const pack = getGenrePack(genre);
  const copy = pack.decision[language];
  const heat = mission?.heat || 0;
  const aggressivePreview = language === 'ru' ? '+улики, +угроза, возможный урон' : '+evidence, +heat, possible damage';
  const stealthPreview = language === 'ru' ? '-угроза, +доверие, меньше кредитов' : '-heat, +trust, fewer credits';

  return {
    introText: heat > 55 ? copy.introHot : copy.introCool,
    options: [
      {
        id: 'aggressive',
        text: copy.aggressive,
        type: 'aggressive',
        preview: aggressivePreview,
        impact: { heat: 14, evidence: 8, corruption: 2, route: 'loud', flag: `loud_level_${level}`, trace: 10, credits: 18 },
        outcome: makeSegment(copy.aggressiveOutcome, StoryMood.TENSE, SegmentType.NARRATIVE, 'flow', language === 'ru' ? 'Рискованный длинный набор' : 'Risky long-form typing', 4)
      },
      {
        id: 'stealth',
        text: copy.stealth,
        type: 'stealth',
        preview: stealthPreview,
        impact: { heat: -10, trust: 5, evidence: 3, route: 'silent', flag: `silent_level_${level}`, trace: -12, credits: 6 },
        outcome: makeSegment(copy.stealthOutcome, StoryMood.NEUTRAL, SegmentType.BREACH, 'symbols', language === 'ru' ? 'Короткий скрытный взлом' : 'Short stealth breach', 2)
      }
    ]
  };
};

export const getDeterministicStoryBranch = (
  genre: StoryGenreId,
  level: number,
  round: number,
  language: Language,
  mission?: MissionState
): BranchingStory => getLocalBranch(genre, level, round, language, mission);

export const getDeterministicStrategicDecision = (
  genre: StoryGenreId,
  language: Language,
  level: number,
  mission?: MissionState
): DecisionPoint => getLocalDecision(genre, language, level, mission);

const localSummary = (genre: StoryGenreId, level: number, stats: LevelReport, language: Language): string => {
  const pack = getGenrePack(genre);
  const lines = pack.summary[language];
  const mission = stats.mission;
  const clean = stats.totalMistakes <= 4 && stats.traceLevel < 55;
  const evidence = mission?.evidence || 0;
  const route = mission?.route || 'balanced';

  if (level >= FINAL_LEVEL) {
    if (evidence >= 55 && clean) return lines.finalClean;
    if (evidence >= 55) return lines.finalLoud;
    return lines.finalPartial;
  }
  if (route === 'silent' && clean) return lines.silent(level);
  if (route === 'loud') return lines.loud(level);
  return lines.default(level);
};

const svgToDataUri = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const generateLocalSceneImage = (sceneDescription: string, characterDescription: string, genre: StoryGenreId): string => {
  const pack = getGenrePack(genre);
  const seed = [...sceneDescription].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const hueA = 170 + pack.svgHueOffset + (seed % 70);
  const hueB = 280 + pack.svgHueOffset + (seed % 50);
  const scanLines = Array.from({ length: 12 }).map((_, i) => `<rect x="0" y="${i * 50}" width="960" height="1" fill="rgba(255,255,255,0.08)"/>`).join('');
  const nodes = Array.from({ length: 18 }).map((_, i) => {
    const x = (seed * (i + 3) * 37) % 960;
    const y = (seed * (i + 5) * 53) % 540;
    const r = 2 + ((seed + i) % 5);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="hsla(${i % 2 ? hueA : hueB}, 90%, 70%, .65)"/>`;
  }).join('');
  return svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="hsl(${hueB}, 75%, 12%)"/>
          <stop offset="55%" stop-color="#020617"/>
          <stop offset="100%" stop-color="hsl(${hueA}, 85%, 16%)"/>
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width="960" height="540" fill="url(#g)"/>
      <path d="M0 430 C180 320 280 500 460 380 S780 290 960 360 L960 540 L0 540 Z" fill="rgba(15,23,42,.75)"/>
      <path d="M120 430 L240 120 L360 430 M620 430 L760 80 L880 430" stroke="hsla(${hueA},90%,65%,.25)" stroke-width="3" fill="none"/>
      ${nodes}
      ${scanLines}
      <rect x="42" y="34" width="876" height="468" rx="22" fill="none" stroke="hsla(${hueA}, 95%, 70%, .28)" stroke-width="2"/>
      <text x="64" y="78" fill="hsla(${hueA}, 95%, 75%, .95)" font-family="monospace" font-size="13" font-weight="700">SIM FEED // OFFLINE CACHE</text>
      <circle cx="820" cy="118" r="56" fill="none" stroke="hsla(${hueB}, 95%, 75%, .45)" stroke-width="3" filter="url(#glow)"/>
      <path d="M785 118 h70 M820 83 v70" stroke="hsla(${hueB},95%,75%,.7)" stroke-width="2"/>
    </svg>
  `);
};

export const generateCharacterProfile = async (language: Language, genre: StoryGenreId = 'cyberpunk'): Promise<string> => {
  const pack = getGenrePack(genre);
  if (!ai) return pack.local[language].protagonist;
  const model = TEXT_MODEL;
  const prompt = `Create a concise visual description of a unique ${pack.characterPrompt}. Distinctive physical features, clothes, and mood. Max 10-15 words. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Return ONLY the text string.`;

  try {
    const response = await ai.models.generateContent({ model, contents: prompt, config: { temperature: 1.2 } });
    return response.text?.trim() || pack.local[language].protagonist;
  } catch (error) {
    return pack.local[language].protagonist;
  }
};

export const generateStoryStart = async (language: Language, genre: StoryGenreId = 'cyberpunk'): Promise<StorySegment> => {
  const pack = getGenrePack(genre);
  const local = pack.local[language];
  if (!ai) {
    return sanitizeSegment({
      text: local.start,
      mood: StoryMood.TENSE,
      type: SegmentType.NARRATIVE,
      skill: 'flow',
      objective: local.warmObjective,
      pressure: 1,
      consequenceHint: local.warmHint
    });
  }
  const model = TEXT_MODEL;
  const prompt = `You are the Game Master of a ${pack.storyGenre}. WORLD RULES (follow strictly): ${pack.worldRules} Write the first sentence. The player is ${pack.heroName}, a ${pack.heroBrief[language]}. Action-oriented. 10-16 words. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Return ONLY the raw text string.`;

  try {
    const response = await ai.models.generateContent({ model, contents: prompt, config: { temperature: 1.0 } });
    return sanitizeSegment({
      text: response.text?.trim() || local.start,
      mood: StoryMood.TENSE,
      type: SegmentType.NARRATIVE,
      skill: 'flow',
      objective: local.warmObjective,
      pressure: 1
    });
  } catch (error) {
    return sanitizeSegment({ text: local.start, mood: StoryMood.TENSE, type: SegmentType.NARRATIVE, skill: 'flow' });
  }
};

export const generateNextLevelStart = async (
  nextLevel: number,
  prevSummary: string,
  language: Language,
  mission?: MissionState,
  genre: StoryGenreId = 'cyberpunk'
): Promise<StorySegment> => {
  const pack = getGenrePack(genre);
  const local = pack.local[language];
  const fallback = pick(local.levelStart, nextLevel - 1);
  if (!ai) {
    return sanitizeSegment({
      text: fallback,
      mood: mission?.heat && mission.heat > 60 ? StoryMood.DARK : StoryMood.TENSE,
      type: SegmentType.NARRATIVE,
      skill: 'flow',
      objective: local.sectorObjective(nextLevel),
      pressure: Math.min(5, 1 + nextLevel)
    });
  }
  const model = TEXT_MODEL;
  const prompt = `CONTEXT: The player is starting Level ${nextLevel} of a ${pack.storyGenre}. WORLD RULES (follow strictly): ${pack.worldRules} HERO: ${pack.heroName}. PREVIOUS OUTCOME: "${prevSummary}" MISSION METERS: heat=${mission?.heat ?? 0}, trust=${mission?.trust ?? 0}, evidence=${mission?.evidence ?? 0}, corruption=${mission?.corruption ?? 0}, route=${mission?.route ?? 'balanced'}. TASK: Write the first sentence of Level ${nextLevel}. Establish the new location/danger and reflect the meters. Immediate action. 10-16 words. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Return ONLY text.`;

  try {
    const response = await ai.models.generateContent({ model, contents: prompt, config: { temperature: 1.0 } });
    return sanitizeSegment({ text: response.text?.trim() || fallback, mood: StoryMood.TENSE, type: SegmentType.NARRATIVE, skill: 'flow' });
  } catch (e) {
    return sanitizeSegment({ text: fallback, mood: StoryMood.TENSE, type: SegmentType.NARRATIVE, skill: 'flow' });
  }
};

export const generateLevelSummary = async (
  level: number,
  stats: LevelReport,
  prevStoryContext: string,
  language: Language,
  genre: StoryGenreId = 'cyberpunk'
): Promise<string> => {
  const pack = getGenrePack(genre);
  if (!ai) return localSummary(genre, level, stats, language);
  const model = TEXT_MODEL;

  let performanceDesc = "average";
  if (stats.avgWpm > 70 && stats.totalMistakes < 5) performanceDesc = "legendary: fast and clean";
  else if (stats.totalMistakes < 3) performanceDesc = "stealthy and precise";
  else if (stats.traceLevel > 80 || stats.finalHealth < 30) performanceDesc = "disastrous and barely survived";
  else if (stats.traceLevel > 50) performanceDesc = "messy and loud";

  const mission = stats.mission;
  const prompt = `CONTEXT: The player finished Level ${level} of a ${pack.storyGenre}. WORLD RULES (follow strictly): ${pack.worldRules} HERO: ${pack.heroName}. STORY SO FAR: ${prevStoryContext.slice(-360)}... PLAYER PERFORMANCE: speed=${Math.round(stats.avgWpm)} WPM, mistakes=${stats.totalMistakes}, status=${performanceDesc}. MISSION METERS: heat=${mission?.heat ?? 0}, trust=${mission?.trust ?? 0}, evidence=${mission?.evidence ?? 0}, corruption=${mission?.corruption ?? 0}, route=${mission?.route ?? 'balanced'}, flags=${(mission?.flags || []).slice(-5).join(',')}. TASK: Write a punchy 2-sentence summary. Sentence 1: consequences of this level based on typing and choices. Sentence 2: setup for ${level >= FINAL_LEVEL ? 'the ending' : `Level ${level + 1}`}. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Return ONLY text.`;

  try {
    const response = await ai.models.generateContent({ model, contents: prompt, config: { temperature: 1.0 } });
    return response.text?.trim() || localSummary(genre, level, stats, language);
  } catch (e) {
    return localSummary(genre, level, stats, language);
  }
};

export const generateNextSegments = async (
  fullHistory: string[],
  level: number,
  round: number,
  language: Language,
  prevLevelSummary?: string,
  mission?: MissionState,
  genre: StoryGenreId = 'cyberpunk'
): Promise<BranchingStory> => {
  const pack = getGenrePack(genre);
  const fallback = getLocalBranch(genre, level, round, language, mission);
  if (!ai) return fallback;

  const model = TEXT_MODEL;
  const recentHistory = fullHistory.slice(-6).join(" ");
  const lastSentence = fullHistory[fullHistory.length - 1] || "The mission begins.";

  let narrativeInstruction = "Advance the narrative naturally and show consequences.";
  if (round <= 2 && prevLevelSummary) narrativeInstruction = `Continue from previous level outcome: "${prevLevelSummary}".`;
  else if (round >= SECTOR_ROUNDS - 1) narrativeInstruction = "Climax of the current scene. Raise stakes before the escape.";

  // PACING: the core loop is typing readable STORY prose whose branch reflects how
  // cleanly the player typed. Code/number drills (BREACH/SIGNAL) are rare tension
  // spice, forbidden in the opening rounds and only building toward the climax.
  const isClimax = round >= SECTOR_ROUNDS - 1 || level >= FINAL_LEVEL;
  let typeRule: string;
  if (level <= 1 || round <= 3) {
    typeRule = "TYPE RULE: use type NARRATIVE or DIALOG ONLY — flowing story prose or spoken dialogue. Do NOT use BREACH or SIGNAL yet: no code, no hex, no number strings. The player is reading and typing an actual story right now.";
  } else if (isClimax) {
    typeRule = "TYPE RULE: this is near the climax — you MAY use ONE BREACH or SIGNAL drill among the three paths to spike tension, but at least two paths must stay NARRATIVE/DIALOG prose.";
  } else {
    typeRule = "TYPE RULE: keep it mostly NARRATIVE/DIALOG prose; a single BREACH or SIGNAL drill is allowed only occasionally and never in more than one of the three paths.";
  }

  const prompt = `SETTING: ${pack.storyGenre}. WORLD RULES (follow strictly, never drift into another genre): ${pack.worldRules} HERO: ${pack.heroName}. CURRENT STATUS: Level ${level} | Round ${round}/${SECTOR_ROUNDS}. RECENT CONTEXT: "...${recentHistory}" LAST EVENT: "${lastSentence}" MISSION METERS: heat=${mission?.heat ?? 0}, trust=${mission?.trust ?? 0}, evidence=${mission?.evidence ?? 0}, corruption=${mission?.corruption ?? 0}, signal=${mission?.signal ?? 0}, route=${mission?.route ?? 'balanced'}, recent consequences=${(mission?.consequenceLog || []).slice(-3).join(' | ')}. TASK: Generate the next story segment options. CORE LOOP: the player TYPES the sentence you write and the branch reflects their typing — so the main content is readable story prose, NOT puzzles. INSTRUCTION: ${narrativeInstruction} ${typeRule} RULES: 1. No repeated events. 2. NARRATIVE/DIALOG: 8-18 words, ordinary sentence case (do NOT write in all-caps). 3. If (and only if) a BREACH/SIGNAL drill is allowed here: 2-6 short tokens whose content matches the WORLD RULES for this world (never terminal/hex code unless the world is cyberpunk). 4. goodPath rewards clean play with control/evidence/trust. mediumPath shows messy survival. badPath shows concrete consequences that can echo later. 5. Include objective, skill, and a short consequenceHint. 6. Every sentence must stay strictly inside the SETTING's world and era — respect the FORBIDDEN vocabulary. 7. OUTPUT LANGUAGE FOR NARRATIVE/DIALOG: ${language === 'ru' ? 'Russian' : 'English'}. Keep BREACH/SIGNAL tokens in English. Return JSON only.`;

  try {
    const apiCall = ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.92,
        topK: 40,
        topP: 0.95
      }
    });

    const response = await withTimeout(apiCall, 10000, null as any);
    if (!response || !response.text) return fallback;
    const data = cleanAndParseJSON<BranchingStory>(response.text);
    return sanitizeBranch(data);
  } catch (error) {
    console.error("Gemini API Error:", error);
    return fallback;
  }
};

export const generateStrategicDecision = async (
  fullHistory: string[],
  level: number,
  language: Language,
  mission?: MissionState,
  genre: StoryGenreId = 'cyberpunk'
): Promise<DecisionPoint> => {
  const pack = getGenrePack(genre);
  const fallback = getLocalDecision(genre, language, level, mission);
  if (!ai) return fallback;
  const model = TEXT_MODEL;
  const recentHistory = fullHistory.slice(-6).join(" ");
  const lastSentence = fullHistory[fullHistory.length - 1] || "You encounter a new obstacle.";

  const prompt = `SETTING: ${pack.storyGenre}. WORLD RULES (follow strictly, never drift into another genre): ${pack.worldRules} HERO: ${pack.heroName}. STATUS: Level ${level} | Mid-Level Branching Point. RECENT CONTEXT: "${recentHistory}" LAST EVENT: "${lastSentence}" MISSION METERS: heat=${mission?.heat ?? 0}, trust=${mission?.trust ?? 0}, evidence=${mission?.evidence ?? 0}, corruption=${mission?.corruption ?? 0}, route=${mission?.route ?? 'balanced'}. TASK: Create a major tactical decision with two approaches. Aggressive: loud, risky, stronger evidence/credits, raises heat/corruption. Stealth: quiet, technical, lowers heat, raises trust, usually less loot. OUTCOMES: text they must type next. Aggressive outcome is action text. Stealth outcome can be code/BREACH. Include preview and impact numbers. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Keep code in English. JSON schema: { "introText": string, "options": [ { "id":"aggressive", "text": string, "type":"aggressive", "preview": string, "impact": {"heat":number,"trust":number,"evidence":number,"corruption":number,"signal":number,"trace":number,"health":number,"credits":number,"route":"loud","flag":string}, "outcome": StorySegment }, { "id":"stealth", "text": string, "type":"stealth", "preview": string, "impact": {"heat":number,"trust":number,"evidence":number,"corruption":number,"signal":number,"trace":number,"health":number,"credits":number,"route":"silent","flag":string}, "outcome": StorySegment } ] }`;

  try {
    const response = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json", temperature: 1.0 } });
    if (!response.text) return fallback;
    const data = cleanAndParseJSON<DecisionPoint>(response.text);
    if (!Array.isArray(data.options) || data.options.length < 2) return fallback;
    data.options = [data.options[0], data.options[1]] as any;
    data.options.forEach((opt, index) => {
      opt.id = opt.id || (index === 0 ? 'aggressive' : 'stealth');
      opt.type = opt.type || (index === 0 ? 'aggressive' : 'stealth');
      opt.preview = opt.preview || fallback.options[index].preview;
      opt.impact = { ...fallback.options[index].impact, ...opt.impact };
      opt.outcome = sanitizeSegment(opt.outcome, index === 0 ? 'flow' : 'symbols');
    });
    return data as DecisionPoint;
  } catch (e) {
    console.error("Decision Gen Error", e);
    return fallback;
  }
};

export const generateSceneImage = async (
  sceneDescription: string,
  characterDescription: string,
  genre: StoryGenreId = 'cyberpunk',
  isStoryBeat = false
): Promise<string | null> => {
  const pack = getGenrePack(genre);
  const cacheKey = getSceneImageCacheKey(genre, sceneDescription);
  const genreChanged = genre !== lastGenre;

  if (genreChanged) lastGenre = genre;

  // Generate art for authored story beats (opening, post-decision, finale), so a
  // repeated image reads as a held shot instead of an arbitrary every-third cadence.
  const shouldGenerateRemotely = genreChanged || isStoryBeat;
  if (!shouldGenerateRemotely && lastImageDataUrl) return lastImageDataUrl;

  if (Date.now() < remoteImageRetryAfter || !ai) {
    return lastImageDataUrl || sceneImageCache.get(cacheKey) || generateLocalSceneImage(sceneDescription, characterDescription, genre);
  }
  const model = 'gemini-3.1-flash-lite-image';
  const prompt = `${pack.artStyle}. Character: ${characterDescription}. Scene: ${sceneDescription}. Readable silhouette, high contrast, dramatic angle. Do not render any words, captions, letters, or watermarks.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      const inline = (part as any).inlineData;
      if (inline?.data) {
        const imageDataUrl = `data:${inline.mimeType || 'image/png'};base64,${inline.data}`;
        lastImageDataUrl = imageDataUrl;
        remoteImageRetryAfter = 0;
        cacheSceneImage(cacheKey, imageDataUrl);
        return imageDataUrl;
      }
    }
    const cachedImage = sceneImageCache.get(cacheKey);
    if (cachedImage) {
      lastImageDataUrl = cachedImage;
      return cachedImage;
    }
    remoteImageRetryAfter = Date.now() + 30_000;
    return lastImageDataUrl || generateLocalSceneImage(sceneDescription, characterDescription, genre);
  } catch (error) {
    const cachedImage = sceneImageCache.get(cacheKey);
    if (cachedImage) {
      lastImageDataUrl = cachedImage;
      return cachedImage;
    }
    remoteImageRetryAfter = Date.now() + 30_000;
    return lastImageDataUrl || generateLocalSceneImage(sceneDescription, characterDescription, genre);
  }
};
