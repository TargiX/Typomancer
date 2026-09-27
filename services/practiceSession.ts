import type { Language } from '../types.ts';
import { getDrillPatterns, getDuePatterns, normalizeTrainingToken, type TypingTrainingProfile } from './typingTraining.ts';

export const PRACTICE_PHASE_MS = [60_000, 180_000, 60_000] as const;
export const PRACTICE_PROMPT_ID = 'steady-transmission-v2';

const CORPUS: Record<Language, string[]> = {
  en: [
    'A quiet signal crosses the city. Keep a steady rhythm and give each letter enough time. The next clear message will guide the operator home.',
    'The station opens at seven. A careful operator checks every number, reads the route, and leaves a short message beside the door.',
    'Small steps make the path clear. Rest your hands, look ahead, and let each word follow the last without a sudden rush.',
    'Rain moves across the window while the network wakes. We carry the proof through the market and wait for the green light.',
    'At 09:45, Mira opens gate 7. Her note says, "Check the blue cable; keep the spare key." The next team arrives in 20 minutes.',
    'Please bring twelve clean pages to the workshop. Quick fingers help, but careful work keeps every label in the right place.',
    'We cross the bridge together, following the narrow trail between the bright windows and the old brick wall.',
    'The report is ready: check the address, confirm the time, and send the final line. Precision keeps the connection stable.'
  ],
  ru: [
    'Тихий сигнал проходит через город. Держи ровный ритм и уделяй каждой букве достаточно времени. Следующее сообщение поможет оператору найти дорогу домой.',
    'Станция открывается в семь. Внимательный оператор проверяет каждое число, читает маршрут и оставляет короткое сообщение у двери.',
    'Маленькие шаги делают путь понятным. Расслабь руки, смотри вперёд и набирай слова последовательно, без резких ускорений.',
    'Дождь стекает по стеклу, пока сеть просыпается. Мы несём улики через рынок и ждём зелёного света на другом конце улицы.',
    'В 09:45 Мира открывает ворота № 7. В записке сказано: «Проверь синий кабель; сохрани запасной ключ». Смена прибудет через 20 минут.',
    'Принеси двенадцать чистых листов в мастерскую. Быстрые пальцы помогают, но внимательная работа сохраняет порядок в каждой записи.',
    'Мы вместе переходим мост и идём по узкой тропе между светлыми окнами и старой кирпичной стеной.',
    'Отчёт готов: проверь адрес, уточни время и отправь последнюю строку. Точность помогает сохранить устойчивую связь.'
  ]
};

export const selectPracticeFocus = (language: Language, profile: TypingTrainingProfile, requested?: string[]): string[] => {
  const eligible = [...new Set([...getDuePatterns(profile, language).map(r => r.token), ...getDrillPatterns(language, profile, 6).map(stat => stat.token)])];
  const selected = requested?.filter(token => eligible.includes(token));
  return (selected?.length ? selected : eligible).slice(0, 3);
};

export const practicePrompt = (language: Language, phase: number, passage: number, focus: string[], stage = 2): string => {
  const corpus = CORPUS[language];
  // The two checks use precisely the same passage order and conditions.
  if (phase !== 1 || focus.length === 0) return corpus[passage % corpus.length];
  const words = corpus.join(' ').toLowerCase().match(language === 'ru' ? /[а-яё]+/g : /[a-z]+/g) || [];
  const target = focus[passage % focus.length];
  const matches = [...new Set(words.filter(word => normalizeTrainingToken(target) && word.includes(target)))];
  const offset = passage % Math.max(1, matches.length);
  const variedWords = [...matches.slice(offset), ...matches.slice(0, offset)].slice(0, 8);
  if (stage === 0) return Array.from({ length: 4 }, (_, i) => [...focus.slice(i % focus.length), ...focus.slice(0, i % focus.length)].join(' ')).join(' ');
  if (stage === 1 && variedWords.length) return variedWords.join(' ');
  const sentence = corpus.find((line, index) => index >= passage % corpus.length && line.toLowerCase().includes(target)) || corpus.find(line => line.toLowerCase().includes(target));
  // Rare pairs and symbols use an explicit transmission code, never invented words.
  return sentence || (language === 'ru' ? `Передай код: ${target} ${target}. Проверь знак, затем подтверди приём.` : `Transmit this code: ${target} ${target}. Check each mark, then confirm receipt.`);
};
