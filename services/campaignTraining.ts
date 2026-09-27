import type { Language, StorySegment } from '../types.ts';
export type CampaignGoal = 'flow' | 'repair' | 'codes';
export const GOAL_COPY: Record<CampaignGoal, Record<Language, string>> = {
  flow: { en: 'Story flow — mistakes affect the route', ru: 'Сюжет — ошибки влияют на маршрут' },
  repair: { en: 'Repair — correct every wrong character before sending', ru: 'Редактор — исправь все неверные символы перед отправкой' },
  codes: { en: 'Codes — numbers and punctuation between story beats', ru: 'Коды — числа и знаки между сюжетными сценами' }
};
const CONTEXT: Record<Language, string[]> = {
  en: ['Keep the signal steady through the storm.', 'Check the address and confirm the next station.', 'Bring the report through the quiet market.', 'The operator reads every number before sending.', 'We follow the narrow bridge beyond the window.', 'Trust the crew, protect the route, and carry the proof.'],
  ru: ['Держи сигнал ровным, пока стихает буря.', 'Проверь адрес и подтверди следующую станцию.', 'Пронеси отчёт через тихую площадь.', 'Оператор читает каждое число перед отправкой.', 'Мы идём по узкому мосту к светлому окну.', 'Доверься команде, защити маршрут и сохрани улики.']
};
/** Authored fallback practice does not depend on an AI following a focus prompt. */
export function prepareCampaignSegment(segment: StorySegment, language: Language, goal: CampaignGoal, focus: string[], level: number, round: number, seed: string): StorySegment {
  if (goal === 'codes' && round % 2 === 0) {
    let hash = 2166136261;
    for (const char of `${seed}:${level}:${round}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    const code = `${String(hash % 24).padStart(2, '0')}:${String(Math.floor(hash / 24) % 60).padStart(2, '0')} / ${100 + hash % 900}-${10 + hash % 90}`;
    return { ...segment, text: `${segment.text} ${language === 'ru' ? 'Код' : 'Code'}: ${code}.`, skill: 'numbers' };
  }
  if (round % 3 !== 2 || !focus.length) return segment;
  const target = focus[(level + round) % focus.length];
  if (segment.text.toLowerCase().includes(target)) return segment;
  const candidates = CONTEXT[language].filter(line => line.toLowerCase().includes(target));
  const line = candidates[(level + round) % candidates.length];
  return line ? { ...segment, text: `${segment.text} ${line}` } : segment;
}
export function canTransmit(text: string, value: string, goal: CampaignGoal, match: (typed: string, expected: string) => boolean): boolean {
  return text.length === value.length && (goal !== 'repair' || [...value].every((char, i) => match(char, text[i])));
}
