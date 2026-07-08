import {
  StoryMood,
  BranchingStory,
  StorySegment,
  LevelReport,
  SegmentType,
  DecisionPoint,
  Language,
  MissionState,
  TypingSkill
} from "../types";

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

const STORY_GENRE = "cyberpunk espionage typing thriller";
const TEXT_MODEL = "gemini-flash-lite-latest";
const FINAL_LEVEL = 4;
let remoteImageGenerationUnavailable = false;

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

const localText = {
  en: {
    protagonist: "A calm field agent with chrome irises and a torn graphite coat.",
    start: "Agent Nox wakes inside a stolen courier drone as sirens bloom below.",
    levelStart: [
      "The safehouse shutters open to a city grid already searching for your pulse.",
      "Rain floods the relay roof while corporate spotlights comb the antenna forest.",
      "The archive vault breathes cold air and recognizes your stolen biometric mask.",
      "At the orbital uplink, the Black Ledger waits behind one final firewall."
    ],
    summaryFallback: "You survive the sector, but every keystroke leaves a different scar on the city.",
    noApiImage: "LOCAL VISUAL FEED"
  },
  ru: {
    protagonist: "Спокойный полевой агент с хромовыми радужками и рваным графитовым плащом.",
    start: "Агент Нокс приходит в себя внутри украденного дрона-курьера; снизу вспыхивают сирены.",
    levelStart: [
      "Ставни убежища раскрываются, а городская сеть уже ищет твой пульс.",
      "Дождь заливает крышу ретранслятора, пока прожекторы прочесывают антенны.",
      "Архивное хранилище выдыхает холод и узнает твою украденную биомаску.",
      "На орбитальном узле Черный Реестр ждет за последним файрволом."
    ],
    summaryFallback: "Ты переживаешь сектор, но каждый набор оставляет на городе новый шрам.",
    noApiImage: "ЛОКАЛЬНЫЙ ВИЗУАЛЬНЫЙ КАНАЛ"
  }
};

const localBranches = {
  en: [
    {
      skill: 'flow' as TypingSkill,
      good: "You ghost through the checkpoint, letting the patrol chase your decoy heartbeat.",
      medium: "You slip past the checkpoint, but one camera catches a blurred shoulder.",
      bad: "The checkpoint blooms red; guards pivot toward the echo of your panic.",
      objective: "Smooth flow: keep momentum"
    },
    {
      skill: 'symbols' as TypingSkill,
      good: ">> inject_key --silent 47A9",
      medium: ">> route_packet /safe/node-6",
      bad: ">> TRACE_LOCKED :: FAIL_09",
      objective: "Symbols: exact characters only",
      type: SegmentType.BREACH
    },
    {
      skill: 'punctuation' as TypingSkill,
      good: "\"Breathe once, then type,\" Mira whispers. \"The door believes confidence.\"",
      medium: "\"Keep moving,\" Mira says, though static bites the end of her voice.",
      bad: "\"They heard you,\" Mira hisses; the channel fractures into alarms.",
      objective: "Dialogue: punctuation practice",
      type: SegmentType.DIALOG
    },
    {
      skill: 'numbers' as TypingSkill,
      good: "SIG 03-17-44 // pulse stable // window 08",
      medium: "SIG 22-04-19 // drift rising // window 03",
      bad: "SIG 99-99-00 // hostile mirror // window closed",
      objective: "Numbers: steady rhythm",
      type: SegmentType.SIGNAL
    },
    {
      skill: 'precision' as TypingSkill,
      good: "Your clean keystrokes fold the city map into a silent escape lane.",
      medium: "The map opens, yet each correction leaves fingerprints in the routing mesh.",
      bad: "The map rejects your rhythm and sells your location to every tower nearby.",
      objective: "Precision: avoid backtracking"
    },
    {
      skill: 'symbols' as TypingSkill,
      good: "sudo ./ledger_sync --ghost",
      medium: "grep -R witness_id ./vault",
      bad: "rm -rf /cover/blown",
      objective: "Terminal drill: symbols and spacing",
      type: SegmentType.BREACH
    },
    {
      skill: 'flow' as TypingSkill,
      good: "You plant the evidence shard where every free station can mirror it.",
      medium: "You plant the shard, but the upload coughs sparks into the trace.",
      bad: "The shard cracks in your glove, spilling proof into hostile storage.",
      objective: "Flow: long sentence control"
    },
    {
      skill: 'punctuation' as TypingSkill,
      good: "\"No heroics,\" you tell yourself. \"Only clean exits and cleaner proof.\"",
      medium: "\"No heroics,\" you mutter, stepping over glass and bad choices.",
      bad: "\"No heroics,\" you lie, while drones paint your chest with lasers.",
      objective: "Punctuation: commas and quotes",
      type: SegmentType.DIALOG
    },
    {
      skill: 'numbers' as TypingSkill,
      good: "NODE 7 -> 12 -> 18 // latency 004ms",
      medium: "NODE 7 -> 13 -> 18 // latency 071ms",
      bad: "NODE 7 -> 00 -> NULL // latency fatal",
      objective: "Numbers and arrows",
      type: SegmentType.SIGNAL
    },
    {
      skill: 'precision' as TypingSkill,
      good: "The final lock opens because you never let fear choose a key.",
      medium: "The final lock opens late, coughing your alias into the dark.",
      bad: "The final lock screams, and the building learns the shape of your hands.",
      objective: "Climax: clean under pressure"
    }
  ],
  ru: [
    {
      skill: 'flow' as TypingSkill,
      good: "Ты проходишь пост, и патруль гонится только за фальшивым сердцебиением.",
      medium: "Ты минуешь пост, но одна камера ловит смазанное плечо.",
      bad: "Пост вспыхивает красным; охрана разворачивается на эхо твоей паники.",
      objective: "Поток: держи ровный темп"
    },
    {
      skill: 'symbols' as TypingSkill,
      good: ">> inject_key --silent 47A9",
      medium: ">> route_packet /safe/node-6",
      bad: ">> TRACE_LOCKED :: FAIL_09",
      objective: "Символы: точный ввод",
      type: SegmentType.BREACH
    },
    {
      skill: 'punctuation' as TypingSkill,
      good: "«Вдохни один раз, потом печатай», — шепчет Мира. «Дверь верит уверенности».",
      medium: "«Двигайся», — говорит Мира, хотя статика кусает конец фразы.",
      bad: "«Они услышали», — шипит Мира; канал рассыпается тревогами.",
      objective: "Диалог: кавычки и пунктуация",
      type: SegmentType.DIALOG
    },
    {
      skill: 'numbers' as TypingSkill,
      good: "SIG 03-17-44 // pulse stable // window 08",
      medium: "SIG 22-04-19 // drift rising // window 03",
      bad: "SIG 99-99-00 // hostile mirror // window closed",
      objective: "Числа: ровный ритм",
      type: SegmentType.SIGNAL
    },
    {
      skill: 'precision' as TypingSkill,
      good: "Чистый набор складывает карту города в тихий коридор побега.",
      medium: "Карта открывается, но каждое исправление оставляет след в маршрутизаторе.",
      bad: "Карта отвергает твой ритм и продает позицию ближайшим башням.",
      objective: "Точность: меньше откатов"
    },
    {
      skill: 'symbols' as TypingSkill,
      good: "sudo ./ledger_sync --ghost",
      medium: "grep -R witness_id ./vault",
      bad: "rm -rf /cover/blown",
      objective: "Терминал: символы и пробелы",
      type: SegmentType.BREACH
    },
    {
      skill: 'flow' as TypingSkill,
      good: "Ты ставишь осколок доказательств там, где его отзеркалит каждая свободная станция.",
      medium: "Ты ставишь осколок, но загрузка выбрасывает искры в трассировку.",
      bad: "Осколок трескается в перчатке, сливая доказательства во враждебное хранилище.",
      objective: "Поток: длинная фраза"
    },
    {
      skill: 'punctuation' as TypingSkill,
      good: "«Без героизма», — говоришь себе. «Только чистые выходы и чистые улики».",
      medium: "«Без героизма», — бормочешь ты, переступая стекло и плохие решения.",
      bad: "«Без героизма», — лжешь ты, пока дроны рисуют лазеры на груди.",
      objective: "Пунктуация: запятые и кавычки",
      type: SegmentType.DIALOG
    },
    {
      skill: 'numbers' as TypingSkill,
      good: "NODE 7 -> 12 -> 18 // latency 004ms",
      medium: "NODE 7 -> 13 -> 18 // latency 071ms",
      bad: "NODE 7 -> 00 -> NULL // latency fatal",
      objective: "Числа и стрелки",
      type: SegmentType.SIGNAL
    },
    {
      skill: 'precision' as TypingSkill,
      good: "Последний замок открывается, потому что страх не выбрал ни одной клавиши.",
      medium: "Последний замок открывается поздно, выкашливая твой псевдоним в темноту.",
      bad: "Последний замок кричит, и здание запоминает форму твоих рук.",
      objective: "Кульминация: чисто под давлением"
    }
  ]
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

const getLocalBranch = (level: number, round: number, language: Language, mission?: MissionState): BranchingStory => {
  const templates = localBranches[language];
  const template = pick(templates, (level * 17) + (round * 5) + (mission?.heat || 0) + (mission?.evidence || 0));
  const type = template.type || SegmentType.NARRATIVE;
  const heat = mission?.heat || 0;
  const pressure = clamp(Math.round((heat / 25) + (round / 4)), 1, 5);
  const goodHint = language === 'ru' ? '+улики, -угроза' : '+evidence, -heat';
  const mediumHint = language === 'ru' ? '+след, путь сохранен' : '+trace, route intact';
  const badHint = language === 'ru' ? '+коррупция, город запоминает ошибку' : '+corruption, city remembers';

  return sanitizeBranch({
    goodPath: makeSegment(template.good, StoryMood.HOPEFUL, type, template.skill, template.objective, pressure, goodHint),
    mediumPath: makeSegment(template.medium, StoryMood.TENSE, type, template.skill, template.objective, pressure + 1, mediumHint),
    badPath: makeSegment(template.bad, StoryMood.DARK, type === SegmentType.BREACH ? SegmentType.SIGNAL : type, template.skill, template.objective, pressure + 2, badHint)
  });
};

const getLocalDecision = (language: Language, level: number, mission?: MissionState): DecisionPoint => {
  const heat = mission?.heat || 0;
  const aggressivePreview = language === 'ru' ? '+улики, +угроза, возможный урон' : '+evidence, +heat, possible damage';
  const stealthPreview = language === 'ru' ? '-угроза, +доверие, меньше кредитов' : '-heat, +trust, fewer credits';

  if (language === 'ru') {
    return {
      introText: heat > 55
        ? "Корпоративный охотник уже видит твой силуэт в тепловом канале."
        : "Перед тобой развилка: сервер улик или тихий сервисный тоннель.",
      options: [
        {
          id: 'aggressive',
          text: "Вломиться в сервер и вытащить Черный Реестр",
          type: 'aggressive',
          preview: aggressivePreview,
          impact: { heat: 14, evidence: 8, corruption: 2, route: 'loud', flag: `loud_level_${level}`, trace: 10, credits: 18 },
          outcome: makeSegment("Ты выбиваешь крышку сервера и хватаешь ядро с уликами.", StoryMood.TENSE, SegmentType.NARRATIVE, 'flow', 'Рискованный длинный набор', 4)
        },
        {
          id: 'stealth',
          text: "Подменить маршрут и пройти сервисным слоем",
          type: 'stealth',
          preview: stealthPreview,
          impact: { heat: -10, trust: 5, evidence: 3, route: 'silent', flag: `silent_level_${level}`, trace: -12, credits: 6 },
          outcome: makeSegment(">> ghost_route --mask MIRA --ttl 08", StoryMood.NEUTRAL, SegmentType.BREACH, 'symbols', 'Короткий скрытный взлом', 2)
        }
      ]
    };
  }

  return {
    introText: heat > 55
      ? "A corporate hunter has your silhouette locked in thermal vision."
      : "Two exits split ahead: the evidence server or a quiet service tunnel.",
    options: [
      {
        id: 'aggressive',
        text: "Crack the server open and rip out the Black Ledger",
        type: 'aggressive',
        preview: aggressivePreview,
        impact: { heat: 14, evidence: 8, corruption: 2, route: 'loud', flag: `loud_level_${level}`, trace: 10, credits: 18 },
        outcome: makeSegment("You tear the server shell open and seize the evidence core.", StoryMood.TENSE, SegmentType.NARRATIVE, 'flow', 'Risky long-form typing', 4)
      },
      {
        id: 'stealth',
        text: "Spoof the route and pass through the service layer",
        type: 'stealth',
        preview: stealthPreview,
        impact: { heat: -10, trust: 5, evidence: 3, route: 'silent', flag: `silent_level_${level}`, trace: -12, credits: 6 },
        outcome: makeSegment(">> ghost_route --mask MIRA --ttl 08", StoryMood.NEUTRAL, SegmentType.BREACH, 'symbols', 'Short stealth breach', 2)
      }
    ]
  };
};

const localSummary = (level: number, stats: LevelReport, language: Language): string => {
  const mission = stats.mission;
  const clean = stats.totalMistakes <= 4 && stats.traceLevel < 55;
  const evidence = mission?.evidence || 0;
  const route = mission?.route || 'balanced';

  if (language === 'ru') {
    if (level >= FINAL_LEVEL) {
      if (evidence >= 55 && clean) return "Ты публикуешь Черный Реестр без единого лишнего следа. Город просыпается, а корпорация теряет имя, лицо и власть.";
      if (evidence >= 55) return "Черный Реестр уходит в сеть, но вместе с ним всплывает твой цифровой силуэт. Победа громкая, опасная и необратимая.";
      return "Ты срываешь финальный узел и выживаешь, но часть доказательств остается запертой. Это не конец войны, а первый правильный шрам.";
    }
    if (route === 'silent' && clean) return `Сектор ${level} пройден почти бесшумно: Мира доверяет тебе больше, а охота теряет запах. Следующий узел открывается через скрытую линию метро.`;
    if (route === 'loud') return `Сектор ${level} взят силой: улик больше, но город начинает узнавать твой почерк. Следующий уровень пройдет под прожекторами.`;
    return `Сектор ${level} пережит с ценой: сеть дрожит, а твои ошибки становятся частью маршрута. Следующий узел требует более чистого набора.`;
  }

  if (level >= FINAL_LEVEL) {
    if (evidence >= 55 && clean) return "You publish the Black Ledger without leaving a spare fingerprint. The city wakes as the corporation loses its name, face, and power.";
    if (evidence >= 55) return "The Black Ledger hits the net, but your silhouette rides the broadcast. Victory is loud, dangerous, and irreversible.";
    return "You break the final node and survive, though some proof remains sealed. This is not the end of the war, only its first honest scar.";
  }
  if (route === 'silent' && clean) return `Sector ${level} falls almost silently: Mira trusts you more, and the hunt loses your scent. The next node opens through a hidden metro line.`;
  if (route === 'loud') return `Sector ${level} is taken by force: you gain proof, but the city starts recognizing your signature. The next level begins under spotlights.`;
  return `Sector ${level} is survived at a price: the network trembles, and your errors become part of the route. The next node demands cleaner typing.`;
};

const svgToDataUri = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;

const generateLocalSceneImage = (sceneDescription: string, characterDescription: string): string => {
  const seed = [...sceneDescription].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const hueA = 170 + (seed % 70);
  const hueB = 280 + (seed % 50);
  const title = sceneDescription.slice(0, 72).replace(/[<&>]/g, '');
  const character = characterDescription.slice(0, 92).replace(/[<&>]/g, '');
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
      <text x="64" y="78" fill="hsla(${hueA}, 95%, 75%, .95)" font-family="monospace" font-size="24" font-weight="700">LOCAL VISUAL FEED</text>
      <text x="64" y="428" fill="#e2e8f0" font-family="monospace" font-size="26" font-weight="700">${title}</text>
      <text x="64" y="464" fill="#94a3b8" font-family="monospace" font-size="16">${character}</text>
      <text x="64" y="110" fill="#64748b" font-family="monospace" font-size="13">procedural fallback // no image API required</text>
      <circle cx="820" cy="118" r="56" fill="none" stroke="hsla(${hueB}, 95%, 75%, .45)" stroke-width="3" filter="url(#glow)"/>
      <path d="M785 118 h70 M820 83 v70" stroke="hsla(${hueB},95%,75%,.7)" stroke-width="2"/>
    </svg>
  `);
};

export const generateCharacterProfile = async (language: Language): Promise<string> => {
  if (!ai) return localText[language].protagonist;
  const model = TEXT_MODEL;
  const prompt = `Create a concise visual description of a unique cyberpunk field agent/hacker. Distinctive physical features, clothes, and cybernetics. Max 10-15 words. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Return ONLY the text string.`;

  try {
    const response = await ai.models.generateContent({ model, contents: prompt, config: { temperature: 1.2 } });
    return response.text?.trim() || localText[language].protagonist;
  } catch (error) {
    return localText[language].protagonist;
  }
};

export const generateStoryStart = async (language: Language): Promise<StorySegment> => {
  if (!ai) {
    return sanitizeSegment({
      text: localText[language].start,
      mood: StoryMood.TENSE,
      type: SegmentType.NARRATIVE,
      skill: 'flow',
      objective: language === 'ru' ? 'Разогрев: держи ритм' : 'Warm-up: hold rhythm',
      pressure: 1,
      consequenceHint: language === 'ru' ? 'Чистый старт снизит охоту' : 'Clean start lowers the hunt'
    });
  }
  const model = TEXT_MODEL;
  const prompt = `You are the Game Master of a ${STORY_GENRE}. Write the first sentence. The player is Agent Nox, a hacker-agent stealing proof from a megacorp. Action-oriented. 10-16 words. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Return ONLY the raw text string.`;

  try {
    const response = await ai.models.generateContent({ model, contents: prompt, config: { temperature: 1.0 } });
    return sanitizeSegment({
      text: response.text?.trim() || localText[language].start,
      mood: StoryMood.TENSE,
      type: SegmentType.NARRATIVE,
      skill: 'flow',
      objective: language === 'ru' ? 'Разогрев: держи ритм' : 'Warm-up: hold rhythm',
      pressure: 1
    });
  } catch (error) {
    return sanitizeSegment({ text: localText[language].start, mood: StoryMood.TENSE, type: SegmentType.NARRATIVE, skill: 'flow' });
  }
};

export const generateNextLevelStart = async (
  nextLevel: number,
  prevSummary: string,
  language: Language,
  mission?: MissionState
): Promise<StorySegment> => {
  const fallback = pick(localText[language].levelStart, nextLevel - 1);
  if (!ai) {
    return sanitizeSegment({
      text: fallback,
      mood: mission?.heat && mission.heat > 60 ? StoryMood.DARK : StoryMood.TENSE,
      type: SegmentType.NARRATIVE,
      skill: 'flow',
      objective: language === 'ru' ? `Сектор ${nextLevel}: новый ритм` : `Sector ${nextLevel}: new rhythm`,
      pressure: Math.min(5, 1 + nextLevel)
    });
  }
  const model = TEXT_MODEL;
  const prompt = `CONTEXT: The player is starting Level ${nextLevel} of a ${STORY_GENRE}. PREVIOUS OUTCOME: "${prevSummary}" MISSION METERS: heat=${mission?.heat ?? 0}, trust=${mission?.trust ?? 0}, evidence=${mission?.evidence ?? 0}, corruption=${mission?.corruption ?? 0}, route=${mission?.route ?? 'balanced'}. TASK: Write the first sentence of Level ${nextLevel}. Establish the new location/danger and reflect the meters. Immediate action. 10-16 words. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Return ONLY text.`;

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
  language: Language
): Promise<string> => {
  if (!ai) return localSummary(level, stats, language);
  const model = TEXT_MODEL;

  let performanceDesc = "average";
  if (stats.avgWpm > 70 && stats.totalMistakes < 5) performanceDesc = "legendary: fast and clean";
  else if (stats.totalMistakes < 3) performanceDesc = "stealthy and precise";
  else if (stats.traceLevel > 80 || stats.finalHealth < 30) performanceDesc = "disastrous and barely survived";
  else if (stats.traceLevel > 50) performanceDesc = "messy and loud";

  const mission = stats.mission;
  const prompt = `CONTEXT: The player finished Level ${level} of a ${STORY_GENRE}. STORY SO FAR: ${prevStoryContext.slice(-360)}... PLAYER PERFORMANCE: speed=${Math.round(stats.avgWpm)} WPM, mistakes=${stats.totalMistakes}, status=${performanceDesc}. MISSION METERS: heat=${mission?.heat ?? 0}, trust=${mission?.trust ?? 0}, evidence=${mission?.evidence ?? 0}, corruption=${mission?.corruption ?? 0}, route=${mission?.route ?? 'balanced'}, flags=${(mission?.flags || []).slice(-5).join(',')}. TASK: Write a punchy 2-sentence summary. Sentence 1: consequences of this level based on typing and choices. Sentence 2: setup for ${level >= FINAL_LEVEL ? 'the ending' : `Level ${level + 1}`}. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Return ONLY text.`;

  try {
    const response = await ai.models.generateContent({ model, contents: prompt, config: { temperature: 1.0 } });
    return response.text?.trim() || localSummary(level, stats, language);
  } catch (e) {
    return localSummary(level, stats, language);
  }
};

export const generateNextSegments = async (
  fullHistory: string[],
  level: number,
  round: number,
  language: Language,
  prevLevelSummary?: string,
  mission?: MissionState
): Promise<BranchingStory> => {
  const fallback = getLocalBranch(level, round, language, mission);
  if (!ai) return fallback;

  const model = TEXT_MODEL;
  const recentHistory = fullHistory.slice(-6).join(" ");
  const lastSentence = fullHistory[fullHistory.length - 1] || "The mission begins.";

  let narrativeInstruction = "Advance the narrative naturally and show consequences.";
  if (round <= 2 && prevLevelSummary) narrativeInstruction = `Continue from previous level outcome: "${prevLevelSummary}".`;
  else if (round >= 9) narrativeInstruction = "Climax of the current scene. Raise stakes before the escape.";

  const prompt = `CURRENT STATUS: Level ${level} | Round ${round}/10. RECENT CONTEXT: "...${recentHistory}" LAST EVENT: "${lastSentence}" MISSION METERS: heat=${mission?.heat ?? 0}, trust=${mission?.trust ?? 0}, evidence=${mission?.evidence ?? 0}, corruption=${mission?.corruption ?? 0}, signal=${mission?.signal ?? 0}, route=${mission?.route ?? 'balanced'}, recent consequences=${(mission?.consequenceLog || []).slice(-3).join(' | ')}. TASK: Generate the next segment options. INSTRUCTION: ${narrativeInstruction} SPECIAL MECHANIC: Mix typing drills. Use NARRATIVE for flow, BREACH for exact code, DIALOG for punctuation, SIGNAL for numbers/symbols. RULES: 1. No repeated events. 2. NARRATIVE/DIALOG: 8-18 words. 3. BREACH/SIGNAL: 2-8 tokens, symbols allowed. 4. goodPath should reward clean play with control/evidence/trust. mediumPath should show messy survival. badPath should show concrete consequences that can echo later. 5. Include objective, skill, and a short consequenceHint. 6. OUTPUT LANGUAGE FOR NARRATIVE/DIALOG: ${language === 'ru' ? 'Russian' : 'English'}. Keep BREACH/SIGNAL in technical English. Return JSON only.`;

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
  mission?: MissionState
): Promise<DecisionPoint> => {
  const fallback = getLocalDecision(language, level, mission);
  if (!ai) return fallback;
  const model = TEXT_MODEL;
  const recentHistory = fullHistory.slice(-6).join(" ");
  const lastSentence = fullHistory[fullHistory.length - 1] || "You encounter a new obstacle.";

  const prompt = `STATUS: Level ${level} | Mid-Level Branching Point. RECENT CONTEXT: "${recentHistory}" LAST EVENT: "${lastSentence}" MISSION METERS: heat=${mission?.heat ?? 0}, trust=${mission?.trust ?? 0}, evidence=${mission?.evidence ?? 0}, corruption=${mission?.corruption ?? 0}, route=${mission?.route ?? 'balanced'}. TASK: Create a major tactical decision with two approaches. Aggressive: loud, risky, stronger evidence/credits, raises heat/corruption. Stealth: quiet, technical, lowers heat, raises trust, usually less loot. OUTCOMES: text they must type next. Aggressive outcome is action text. Stealth outcome can be code/BREACH. Include preview and impact numbers. OUTPUT LANGUAGE: ${language === 'ru' ? 'Russian' : 'English'}. Keep code in English. JSON schema: { "introText": string, "options": [ { "id":"aggressive", "text": string, "type":"aggressive", "preview": string, "impact": {"heat":number,"trust":number,"evidence":number,"corruption":number,"signal":number,"trace":number,"health":number,"credits":number,"route":"loud","flag":string}, "outcome": StorySegment }, { "id":"stealth", "text": string, "type":"stealth", "preview": string, "impact": {"heat":number,"trust":number,"evidence":number,"corruption":number,"signal":number,"trace":number,"health":number,"credits":number,"route":"silent","flag":string}, "outcome": StorySegment } ] }`;

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

export const generateSceneImage = async (sceneDescription: string, characterDescription: string): Promise<string | null> => {
  if (remoteImageGenerationUnavailable) return generateLocalSceneImage(sceneDescription, characterDescription);
  if (!ai) return generateLocalSceneImage(sceneDescription, characterDescription);
  // Keep image generation server-side. The proxy converts the interaction image
  // response back into inlineData so the game can keep the same rendering path.
  const model = 'gemini-3.1-flash-lite-image';
  const prompt = `Cyberpunk graphic novel key art, wide cinematic 16:9 composition. Character: ${characterDescription}. Scene: ${sceneDescription}. Dark neon city, readable silhouette, high contrast, dramatic angle. Do not render any words, captions, letters, or watermarks.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      const inline = (part as any).inlineData;
      if (inline?.data) {
        return `data:${inline.mimeType || 'image/png'};base64,${inline.data}`;
      }
    }
    remoteImageGenerationUnavailable = true;
    return generateLocalSceneImage(sceneDescription, characterDescription);
  } catch (error) {
    remoteImageGenerationUnavailable = true;
    return generateLocalSceneImage(sceneDescription, characterDescription);
  }
};
