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
  DecisionOption,
  StoryGenreId
} from "../types.ts";
import { getGenrePack, type LocalBranchTemplate } from "./genreConfig.ts";
import { SECTOR_ROUNDS } from "./gameRules.ts";
import { getRecentConsequences } from "./missionLog.ts";
import { isProseSegmentType, repairProseLine } from "./proseRepair.ts";
import { clampDecisionImpact } from "./decisionImpact.ts";
import { getBeatDirection, getRoundShape } from "./sectorRhythm.ts";
import { captureProductEvent } from "./productAnalytics.ts";

type Schema = Record<string, unknown>;

const Type = {
  OBJECT: 'OBJECT',
  STRING: 'STRING'
} as const;

type GeminiResponse = {
  text?: string;
  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
};

/** Why a generator served local content instead of model output. */
type FallbackReason = 'http' | 'network' | 'timeout' | 'empty' | 'parse' | 'cooldown';

class GeminiRequestError extends Error {
  constructor(public readonly reason: 'http' | 'network' | 'timeout') {
    super(`Gemini request failed: ${reason}`);
  }
}

const reportFallback = (generator: string, reason: FallbackReason) => {
  captureProductEvent('typomancer_ai_fallback', { generator, reason });
};

const fallbackReason = (error: unknown): FallbackReason => (
  error instanceof GeminiRequestError ? error.reason : 'parse'
);

/* Every generator gets the same ceiling: a hung proxy must never pin the
   player on a loading line. next_segments keeps its own 10s race on top of
   this — it is the hot path and deserves the tighter bound. */
const GEMINI_REQUEST_TIMEOUT_MS = 15_000;

const callGemini = async ({ model, contents, config }: { model: string; contents: string; config?: Record<string, unknown> }): Promise<GeminiResponse> => {
  const kind = model === TEXT_MODEL ? 'text' : 'image';
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), GEMINI_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, contents, config }),
      signal: abort.signal
    });

    if (!response.ok) {
      captureProductEvent('typomancer_ai_request', { kind, ok: false });
      throw new GeminiRequestError('http');
    }

    const result = await response.json();
    // Spend telemetry: which kind of call went out and whether the complete
    // request parsed successfully. Prompts and responses stay local.
    captureProductEvent('typomancer_ai_request', { kind, ok: true });
    return result;
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    captureProductEvent('typomancer_ai_request', { kind, ok: false });
    throw new GeminiRequestError(abort.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
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
  // The player reproduces this text keystroke by keystroke, so prose is repaired
  // before it can become something they are asked to type. Drills are exact by
  // definition and pass through untouched.
  const text = isProseSegmentType(type)
    ? repairProseLine(segment.text)
    : segment.text.trim().replace(/\s+/g, ' ');
  if (!text) {
    return {
      text: "Signal interference corrupts the feed; stabilize the link before moving.",
      mood: segment.mood || StoryMood.TENSE,
      type: SegmentType.NARRATIVE,
      skill: fallbackSkill,
      objective: "Recover signal"
    };
  }
  return {
    ...segment,
    text,
    type,
    skill: segment.skill || defaultSkill,
    objective: segment.objective || getDefaultObjective(type, segment.skill || defaultSkill),
    pressure: typeof segment.pressure === 'number' ? clamp(segment.pressure, 0, 5) : undefined
  };
};

const sanitizeBranch = (branch: BranchingStory, pressure?: number): BranchingStory => {
  // Pressure is authored by the sector curve, not chosen by the generator, so the
  // sector tightens on schedule instead of on the model's mood. The worse branches
  // sit a step above the beat, since a fumbled line should also hurt more.
  const withPressure = (segment: StorySegment, step: number): StorySegment => (
    typeof pressure === 'number' ? { ...segment, pressure: clamp(pressure + step, 0, 5) } : segment
  );
  return {
    goodPath: withPressure(sanitizeSegment(branch.goodPath, 'precision'), 0),
    mediumPath: withPressure(sanitizeSegment(branch.mediumPath || branch.goodPath, 'flow'), 1),
    badPath: withPressure(sanitizeSegment(branch.badPath, 'flow'), 2)
  };
};

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
    const drillsAllowed = r >= 4 && (level >= FINAL_LEVEL || r >= SECTOR_ROUNDS - 1 || ((level * 7 + r * 3) % 3 === 0));
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
  // Pressure comes from the authored sector curve rather than from Heat: a player
  // running clean keeps Heat low, so the better they played the flatter the
  // sector used to get.
  const pressure = getRoundShape(round, SECTOR_ROUNDS, level).pressure;
  const goodHint = language === 'ru' ? '+улики, -угроза' : '+evidence, -heat';
  const mediumHint = language === 'ru' ? '+след, путь сохранен' : '+trace, route intact';
  const badHint = language === 'ru' ? '+угроза, мир запоминает ошибку' : '+heat, world remembers';

  return sanitizeBranch({
    goodPath: makeSegment(template.good, StoryMood.HOPEFUL, type, template.skill, template.objective, pressure, goodHint),
    mediumPath: makeSegment(template.medium, StoryMood.TENSE, type, template.skill, template.objective, clamp(pressure + 1, 0, 5), mediumHint),
    badPath: makeSegment(template.bad, StoryMood.DARK, type === SegmentType.BREACH ? SegmentType.SIGNAL : type, template.skill, template.objective, clamp(pressure + 2, 0, 5), badHint)
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
        impact: { heat: 16, evidence: 8, route: 'loud', flag: `loud_level_${level}`, trace: 10, credits: 18 },
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
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
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

  const model = TEXT_MODEL;
  const prompt = `Create a concise visual description of a unique ${pack.characterPrompt}. Distinctive physical features, clothes, and mood. Max 10-15 words. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Return ONLY the text string.`;

  try {
    const response = await callGemini({ model, contents: prompt, config: { temperature: 1.2 } });
    const text = response.text?.trim();
    if (!text) reportFallback('character_profile', 'empty');
    return text || pack.local[language].protagonist;
  } catch (error) {
    reportFallback('character_profile', fallbackReason(error));
    return pack.local[language].protagonist;
  }
};

export const generateStoryStart = async (language: Language, genre: StoryGenreId = 'cyberpunk'): Promise<StorySegment> => {
  const pack = getGenrePack(genre);
  const local = pack.local[language];

  const model = TEXT_MODEL;
  const prompt = `You are the Game Master of a ${pack.storyGenre}. WORLD RULES (follow strictly): ${pack.worldRules} Write the first sentence. The player is ${pack.heroName}, a ${pack.heroBrief[language]}. Action-oriented. 10-16 words. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Return ONLY the raw text string.`;

  try {
    const response = await callGemini({ model, contents: prompt, config: { temperature: 1.0 } });
    const text = response.text?.trim();
    if (!text) reportFallback('story_start', 'empty');
    return sanitizeSegment({
      text: text || local.start,
      mood: StoryMood.TENSE,
      type: SegmentType.NARRATIVE,
      skill: 'flow',
      objective: local.warmObjective,
      pressure: 1
    });
  } catch (error) {
    reportFallback('story_start', fallbackReason(error));
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

  const model = TEXT_MODEL;
  const prompt = `CONTEXT: The player is starting Level ${nextLevel} of a ${pack.storyGenre}. WORLD RULES (follow strictly): ${pack.worldRules} HERO: ${pack.heroName}. PREVIOUS OUTCOME: "${prevSummary}" MISSION METERS: heat=${mission?.heat ?? 0}, trust=${mission?.trust ?? 0}, evidence=${mission?.evidence ?? 0}, route=${mission?.route ?? 'balanced'}. TASK: Write the first sentence of Level ${nextLevel}. Establish the new location/danger and reflect the meters. Immediate action. 10-16 words. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Return ONLY text.`;

  try {
    const response = await callGemini({ model, contents: prompt, config: { temperature: 1.0 } });
    const text = response.text?.trim();
    if (!text) reportFallback('level_start', 'empty');
    return sanitizeSegment({ text: text || fallback, mood: StoryMood.TENSE, type: SegmentType.NARRATIVE, skill: 'flow' });
  } catch (e) {
    reportFallback('level_start', fallbackReason(e));
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

  const model = TEXT_MODEL;

  let performanceDesc = "average";
  if (stats.avgWpm > 70 && stats.totalMistakes < 5) performanceDesc = "legendary: fast and clean";
  else if (stats.totalMistakes < 3) performanceDesc = "stealthy and precise";
  else if (stats.traceLevel > 80 || stats.finalHealth < 30) performanceDesc = "disastrous and barely survived";
  else if (stats.traceLevel > 50) performanceDesc = "messy and loud";

  const mission = stats.mission;
  const prompt = `CONTEXT: The player finished Level ${level} of a ${pack.storyGenre}. WORLD RULES (follow strictly): ${pack.worldRules} HERO: ${pack.heroName}. STORY SO FAR: ${prevStoryContext.slice(-360)}... PLAYER PERFORMANCE: speed=${Math.round(stats.avgWpm)} WPM, mistakes=${stats.totalMistakes}, status=${performanceDesc}. MISSION METERS: heat=${mission?.heat ?? 0}, trust=${mission?.trust ?? 0}, evidence=${mission?.evidence ?? 0}, route=${mission?.route ?? 'balanced'}, flags=${(mission?.flags || []).slice(-5).join(',')}. BEATS THE PLAYER LIVED (oldest to newest, tagged by how cleanly they typed them)=${getRecentConsequences(mission?.consequenceLog || [], 4).join(' | ')}. TASK: Write a punchy 2-sentence summary. Sentence 1: consequences of this level, naming at least one specific beat above rather than describing performance in the abstract. Sentence 2: setup for ${level >= FINAL_LEVEL ? 'the ending' : `Level ${level + 1}`}. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Return ONLY text.`;

  try {
    const response = await callGemini({ model, contents: prompt, config: { temperature: 1.0 } });
    const summary = response.text?.trim();
    if (!summary) reportFallback('level_summary', 'empty');
    // Read rather than typed, but it headlines the debrief screen, so it gets the
    // same mechanical repair as anything else the player is shown.
    return summary ? repairProseLine(summary) : localSummary(genre, level, stats, language);
  } catch (e) {
    reportFallback('level_summary', fallbackReason(e));
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
  genre: StoryGenreId = 'cyberpunk',
  /** Letter pairs this player fumbles, so the campaign itself becomes the drill. */
  trainingFocus: string[] = []
): Promise<BranchingStory> => {
  const pack = getGenrePack(genre);
  const fallback = getLocalBranch(genre, level, round, language, mission);


  const model = TEXT_MODEL;
  const recentHistory = fullHistory.slice(-6).join(" ");
  const lastSentence = fullHistory[fullHistory.length - 1] || "The mission begins.";

  const shape = getRoundShape(round, SECTOR_ROUNDS, level);
  let narrativeInstruction = getBeatDirection(shape.beat);
  if (round <= 2 && prevLevelSummary) {
    narrativeInstruction = `${narrativeInstruction} Continue from the previous sector outcome: "${prevLevelSummary}".`;
  }

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

  // The player's own weak patterns, worked into the prose they are about to type.
  // Framed as a preference rather than a requirement: a sentence contorted to hit
  // a letter pair stops being a story, and the story is the reason anyone types.
  const focusRule = trainingFocus.length
    ? ` TYPING FOCUS: this player fumbles these letters and letter pairs — ${trainingFocus.join(', ')}. Prefer ordinary words that happen to contain them. This is a soft preference and must never bend a sentence, invent an odd word, or repeat one: if a beat has no natural home for them, ignore it entirely.`
    : '';

  const prompt = `SETTING: ${pack.storyGenre}. WORLD RULES (follow strictly, never drift into another genre): ${pack.worldRules} HERO: ${pack.heroName}.${focusRule} CURRENT STATUS: Level ${level} | Round ${round}/${SECTOR_ROUNDS}. RECENT CONTEXT: "...${recentHistory}" LAST EVENT: "${lastSentence}" MISSION METERS: heat=${mission?.heat ?? 0}, trust=${mission?.trust ?? 0}, evidence=${mission?.evidence ?? 0}, route=${mission?.route ?? 'balanced'}, recent consequences (oldest to newest)=${getRecentConsequences(mission?.consequenceLog || [], 3).join(' | ')}. TASK: Generate the next story segment options. CORE LOOP: the player TYPES the sentence you write and the branch reflects their typing — so the main content is readable story prose, NOT puzzles. INSTRUCTION: ${narrativeInstruction} ${typeRule} RULES: 1. No repeated events. 2. NARRATIVE/DIALOG: ${shape.minWords}-${shape.maxWords} words${shape.isClimax ? ' (this is the sector climax, so use the upper end of that range)' : ''}, and a complete grammatical sentence — it must begin with a capital letter and end with . ? or !. Ordinary sentence case; never all-caps, never a bare fragment, never open with a lowercase pronoun. The player types this text character by character, so an ungrammatical line is a defect they are forced to copy. 3. If (and only if) a BREACH/SIGNAL drill is allowed here: 2-6 short tokens whose content matches the WORLD RULES for this world (never terminal/hex code unless the world is cyberpunk). 4. goodPath rewards clean play with control/evidence/trust. mediumPath shows messy survival. badPath shows concrete consequences that can echo later. 5. Include objective, skill, and a short consequenceHint. 6. Every sentence must stay strictly inside the SETTING's world and era — respect the FORBIDDEN vocabulary. 7. RECENT CONSEQUENCES are beats the player already lived, tagged CLEAN, MESSY or BLOWN by how they typed them. If the newest is MESSY or BLOWN, this segment must show its aftermath concretely — a guard who is now looking, a door that no longer opens — instead of resetting the scene. If it is CLEAN, let the player feel the advantage they earned. 8. OUTPUT LANGUAGE FOR NARRATIVE/DIALOG: ${language === 'ru' ? 'Russian' : 'English'}. Keep BREACH/SIGNAL tokens in English. Return JSON only.`;

  try {
    const apiCall = callGemini({
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

    const response = await withTimeout<GeminiResponse | null>(apiCall, 10000, null);
    if (!response || !response.text) {
      reportFallback('next_segments', response ? 'empty' : 'timeout');
      return fallback;
    }
    const data = cleanAndParseJSON<BranchingStory>(response.text);
    return sanitizeBranch(data, shape.pressure);
  } catch (error) {
    console.error("Gemini API Error:", error);
    reportFallback('next_segments', fallbackReason(error));
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

  const model = TEXT_MODEL;
  const recentHistory = fullHistory.slice(-6).join(" ");
  const lastSentence = fullHistory[fullHistory.length - 1] || "You encounter a new obstacle.";

  const prompt = `SETTING: ${pack.storyGenre}. WORLD RULES (follow strictly, never drift into another genre): ${pack.worldRules} HERO: ${pack.heroName}. STATUS: Level ${level} | Mid-Level Branching Point. RECENT CONTEXT: "${recentHistory}" LAST EVENT: "${lastSentence}" MISSION METERS: heat=${mission?.heat ?? 0}, trust=${mission?.trust ?? 0}, evidence=${mission?.evidence ?? 0}, route=${mission?.route ?? 'balanced'}. TASK: Create a major tactical decision with two approaches. Aggressive: loud, risky, stronger evidence/credits, raises heat. Stealth: quiet, technical, lowers heat, raises trust, usually less loot. OUTCOMES: text they must type next. Aggressive outcome is action text. Stealth outcome can be code/BREACH. Include preview and impact numbers. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Keep code in English. JSON schema: { "introText": string, "options": [ { "id":"aggressive", "text": string, "type":"aggressive", "preview": string, "impact": {"heat":number,"trust":number,"evidence":number,"trace":number,"health":number,"credits":number,"route":"loud","flag":string}, "outcome": StorySegment }, { "id":"stealth", "text": string, "type":"stealth", "preview": string, "impact": {"heat":number,"trust":number,"evidence":number,"trace":number,"health":number,"credits":number,"route":"silent","flag":string}, "outcome": StorySegment } ] }`;

  try {
    const response = await callGemini({ model, contents: prompt, config: { responseMimeType: "application/json", temperature: 1.0 } });
    if (!response.text) { reportFallback('strategic_decision', 'empty'); return fallback; }
    const data = cleanAndParseJSON<DecisionPoint>(response.text);
    if (!Array.isArray(data.options) || data.options.length < 2) { reportFallback('strategic_decision', 'parse'); return fallback; }
    data.options = [data.options[0], data.options[1]] as [DecisionOption, DecisionOption];
    data.options.forEach((opt, index) => {
      opt.id = opt.id || (index === 0 ? 'aggressive' : 'stealth');
      opt.type = opt.type || (index === 0 ? 'aggressive' : 'stealth');
      opt.preview = opt.preview || fallback.options[index].preview;
      opt.impact = clampDecisionImpact({ ...fallback.options[index].impact, ...opt.impact });
      opt.outcome = sanitizeSegment(opt.outcome, index === 0 ? 'flow' : 'symbols');
    });
    return data as DecisionPoint;
  } catch (e) {
    console.error("Decision Gen Error", e);
    reportFallback('strategic_decision', fallbackReason(e));
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
  // A prefetched beat still serves from cache — the decision window warms both
  // outcomes ahead of the pick.
  const shouldGenerateRemotely = genreChanged || isStoryBeat;
  if (!shouldGenerateRemotely && lastImageDataUrl) return lastImageDataUrl;
  if (!genreChanged) {
    const prefetched = sceneImageCache.get(cacheKey);
    if (prefetched) {
      lastImageDataUrl = prefetched;
      return prefetched;
    }
  }

  if (Date.now() < remoteImageRetryAfter) {
    const held = lastImageDataUrl || sceneImageCache.get(cacheKey);
    if (held) return held;
    reportFallback('scene_image', 'cooldown');
    return generateLocalSceneImage(sceneDescription, characterDescription, genre);
  }
  const model = 'gemini-3.1-flash-lite-image';
  const prompt = `${pack.artStyle}. Character: ${characterDescription}. Scene: ${sceneDescription}. Readable silhouette, high contrast, dramatic angle. Do not render any words, captions, letters, or watermarks.`;

  try {
    const response = await callGemini({
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
    reportFallback('scene_image', 'empty');
    return lastImageDataUrl || generateLocalSceneImage(sceneDescription, characterDescription, genre);
  } catch (error) {
    const cachedImage = sceneImageCache.get(cacheKey);
    if (cachedImage) {
      lastImageDataUrl = cachedImage;
      return cachedImage;
    }
    remoteImageRetryAfter = Date.now() + 30_000;
    reportFallback('scene_image', fallbackReason(error));
    return lastImageDataUrl || generateLocalSceneImage(sceneDescription, characterDescription, genre);
  }
};
