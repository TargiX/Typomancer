import { DAILY_RULESET } from './sessionRules.ts';
import { GENRE_ORDER } from './genreConfig.ts';
import type { Language, StoryGenreId } from '../types.ts';

export const DAILY_MAX_ATTEMPTS = 3;

export interface DailyBrief {
  dailyId: `SECTOR-${string}`;
  dateLabel: string;
  genre: StoryGenreId;
  opening: Record<Language, string>;
}

export interface DailyState {
  attemptsUsed: number;
  bestScore: number;
  bestEnding: string | null;
}

const DAILY_STORAGE_PREFIX = 'nfDaily:';
import { playerStorage } from './playerStorage.ts';
const EMPTY_DAILY_STATE: DailyState = {
  attemptsUsed: 0,
  bestScore: 0,
  bestEnding: null
};

const DAILY_OPENINGS: Record<StoryGenreId, Array<Record<Language, string>>> = {
  cyberpunk: [
    {
      en: "A courier drone crashes through your window carrying a ledger that predicts tomorrow's corporate executions.",
      ru: 'Дрон-курьер пробивает твоё окно с реестром, который предсказывает завтрашние корпоративные казни в городе.'
    },
    {
      en: 'A dead netrunner calls your private line while her stolen memories auction themselves across the city.',
      ru: 'Мёртвая нетраннерша звонит на закрытую линию, пока её украденные воспоминания продают по всему городу.'
    },
    {
      en: 'Every billboard displays your face tonight, but the bounty belongs to someone wearing your heartbeat.',
      ru: 'Сегодня каждый билборд показывает твоё лицо, но награда назначена за человека с твоим пульсом.'
    },
    {
      en: 'The metro arrives empty except for a chrome briefcase handcuffed to a still-warm synthetic arm.',
      ru: 'Пустой поезд метро привозит хромированный кейс, прикованный наручником к ещё тёплой синтетической руке.'
    },
    {
      en: 'Your implant wakes with root access to the city and one command already counting down.',
      ru: 'Имплант просыпается с полным доступом к городу, а неизвестная команда уже ведёт обратный отсчёт.'
    }
  ],
  space_horror: [
    {
      en: 'Your salvage tug docks itself to a silent relay where every clock counts backward.',
      ru: 'Твой спасательный буксир сам стыкуется с безмолвным ретранслятором, где все часы идут назад.'
    },
    {
      en: 'The distress beacon repeats your childhood address from a station abandoned before you were born.',
      ru: 'Аварийный маяк повторяет адрес твоего детства со станции, заброшенной ещё до твоего рождения.'
    },
    {
      en: 'Something outside the airlock scratches a perfect copy of your access code into the frost.',
      ru: 'Нечто за шлюзом царапает на инее точную копию твоего личного кода доступа.'
    },
    {
      en: 'The relay crew answers roll call in your voice, though their suits hang empty nearby.',
      ru: 'Экипаж ретранслятора отвечает на перекличку твоим голосом, хотя рядом висят пустые скафандры.'
    },
    {
      en: 'Oxygen returns to the dead station as a second heartbeat appears inside your sealed suit.',
      ru: 'На мёртвую станцию возвращается кислород, а внутри герметичного скафандра возникает второе сердцебиение.'
    }
  ],
  noir: [
    {
      en: "A dead singer leaves your name written in lipstick inside the mayor's locked evidence room.",
      ru: 'Мёртвая певица оставляет твоё имя помадой в запертой комнате улик при мэрии.'
    },
    {
      en: 'The rain delivers a photograph of tomorrow morning, with your shadow beside the newest corpse.',
      ru: 'Дождь приносит фотографию завтрашнего утра, где твоя тень стоит рядом с новым трупом.'
    },
    {
      en: 'A judge hires you to find the bullet he swears has not been fired yet.',
      ru: 'Судья нанимает тебя найти пулю, которая, по его клятве, ещё не была выпущена.'
    },
    {
      en: 'Your missing partner sends one matchbook from a nightclub demolished twelve years ago.',
      ru: 'Пропавший напарник присылает спичечный коробок из клуба, снесённого двенадцать лет назад, этой ночью.'
    },
    {
      en: 'At midnight, every police radio names you as witness to a murder still unfolding.',
      ru: 'В полночь каждая полицейская рация называет тебя свидетелем убийства, которое ещё продолжается.'
    }
  ],
  dark_fable: [
    {
      en: "At moonrise, the village well whispers your true name and demands the crown's forgotten debt.",
      ru: 'На восходе луны деревенский колодец шепчет твоё истинное имя и требует забытый долг короны.'
    },
    {
      en: 'A white stag leaves bloody hoofprints to the nursery where the royal cradle rocks alone.',
      ru: 'Белый олень оставляет кровавые следы к детской, где королевская колыбель качается сама.'
    },
    {
      en: 'The forest returns every missing child tonight, unchanged and carrying tiny iron keys.',
      ru: 'Сегодня лес возвращает всех пропавших детей неизменившимися, и каждый несёт крошечный железный ключ.'
    },
    {
      en: 'Your reflection inherits the throne at dawn unless you break the witchglass before sunrise.',
      ru: 'На рассвете твое отражение унаследует трон, если до восхода ты не разобьёшь ведьмино зеркало.'
    },
    {
      en: 'The queen offers your village one harvest in exchange for the last story nobody remembers.',
      ru: 'Королева обещает деревне один урожай в обмен на последнюю сказку, которую никто не помнит.'
    }
  ],
  dead_channel: [
    {
      en: 'The dead channel signs on at 03:00 with your voice reading tomorrow\'s police blotter.',
      ru: 'Мёртвый канал выходит в эфир в 03:00 твоим голосом, читающим завтрашнюю сводку полиции.'
    },
    {
      en: 'Every television in the darkened town turns itself to the frequency you were hired to keep silent.',
      ru: 'Каждый телевизор в уснувшем городе сам переключается на частоту, которую тебя наняли держать немой.'
    },
    {
      en: 'The emergency broadcast test runs three minutes early and lists your name among the casualties.',
      ru: 'Проверка аварийного вещания идёт на три минуты раньше и называет твоё имя среди погибших.'
    },
    {
      en: 'A caller on the open line describes the inside of your control room better than you remember it.',
      ru: 'Звонящий в открытой линии описывает твою аппаратную изнутри лучше, чем ты её помнишь.'
    },
    {
      en: 'The tape archive logs a reel recorded tonight that is already labeled with tomorrow\'s date.',
      ru: 'Архив лент регистрирует бобину, записанную этой ночью, но уже подписанную завтрашним числом.'
    }
  ]
};

const padDatePart = (value: number): string => String(value).padStart(2, '0');

const getDateParts = (date: Date): { compact: string; label: string } => {
  const year = date.getUTCFullYear();
  const month = padDatePart(date.getUTCMonth() + 1);
  const day = padDatePart(date.getUTCDate());
  return {
    compact: `${year}${month}${day}`,
    label: `${year}-${month}-${day}`
  };
};

const hashDate = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export const pickDailyItems = (dailyId: string, itemIds: string[], count: number): string[] => (
  [...new Set(itemIds)]
    .sort()
    .map((id) => ({ id, rank: hashDate(`${dailyId}:${id}`) }))
    .sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, count))
    .map(({ id }) => id)
);

export const getDailyBrief = (date: Date = new Date()): DailyBrief => {
  const { compact, label } = getDateParts(date);
  const hash = hashDate(compact);
  const genre = GENRE_ORDER[hash % GENRE_ORDER.length];
  const openings = DAILY_OPENINGS[genre];
  const opening = openings[Math.floor(hash / GENRE_ORDER.length) % openings.length];

  return {
    dailyId: `SECTOR-${compact}`,
    dateLabel: label,
    genre,
    opening
  };
};

const normalizeDailyState = (value: unknown): DailyState => {
  if (!value || typeof value !== 'object') return { ...EMPTY_DAILY_STATE };
  const stored = value as Partial<DailyState>;
  const attemptsUsed = Number.isFinite(stored.attemptsUsed)
    ? Math.min(DAILY_MAX_ATTEMPTS, Math.max(0, Math.floor(stored.attemptsUsed as number)))
    : 0;
  const bestScore = Number.isFinite(stored.bestScore)
    ? Math.max(0, Math.floor(stored.bestScore as number))
    : 0;

  return {
    attemptsUsed,
    bestScore,
    bestEnding: typeof stored.bestEnding === 'string' && stored.bestEnding.trim()
      ? stored.bestEnding
      : null
  };
};

const cleanupOldDailyKeys = (activeKey: string): void => {
  const storage = playerStorage();
  if (!storage) return;
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith(DAILY_STORAGE_PREFIX) && key !== activeKey) keys.push(key);
  }
  keys.sort().slice(0, Math.max(0, keys.length - 30)).forEach(key => storage.removeItem(key));
};

const dailyKey = (dailyId: string, language?: Language) => `${DAILY_STORAGE_PREFIX}${dailyId}${language ? `_${language}_${DAILY_RULESET}` : ''}`;

export const getDailyState = (dailyId: string, language?: Language): DailyState => {
  if (typeof localStorage === 'undefined') return { ...EMPTY_DAILY_STATE };
  const key = dailyKey(dailyId, language);
  try {
    cleanupOldDailyKeys(key);
    const stored = playerStorage()?.getItem(key);
    return stored ? normalizeDailyState(JSON.parse(stored)) : { ...EMPTY_DAILY_STATE };
  } catch {
    return { ...EMPTY_DAILY_STATE };
  }
};

export const recordDailyAttempt = (dailyId: string, score: number, endingTitle: string, language?: Language, reserved = false): DailyState => {
  const previous = getDailyState(dailyId, language);
  const normalizedScore = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  const isNewBest = normalizedScore > previous.bestScore || previous.bestEnding === null;
  const next: DailyState = {
    attemptsUsed: Math.min(DAILY_MAX_ATTEMPTS, previous.attemptsUsed + (reserved ? 0 : 1)),
    bestScore: isNewBest ? normalizedScore : previous.bestScore,
    bestEnding: isNewBest ? endingTitle : previous.bestEnding
  };

  if (typeof localStorage !== 'undefined') {
    try {
      playerStorage()?.setItem(dailyKey(dailyId, language), JSON.stringify(next));
    } catch {
      // Storage can be unavailable in privacy modes; the run should still finish.
    }
  }
  return next;
};

/** Charge admission, including abandoned attempts; completion only updates the score. */
export const reserveDailyAttempt = (dailyId: string, language: Language): DailyState | null => {
  const previous = getDailyState(dailyId, language);
  if (previous.attemptsUsed >= DAILY_MAX_ATTEMPTS) return null;
  const next = { ...previous, attemptsUsed: previous.attemptsUsed + 1 };
  try { playerStorage()?.setItem(dailyKey(dailyId, language), JSON.stringify(next)); } catch { /* memory state still limits this session */ }
  return next;
};
