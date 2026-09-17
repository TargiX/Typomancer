import { SegmentType, StoryMood } from '../types.ts';
import type { BranchingStory, DecisionImpact, DecisionPoint, Language, MissionState, StorySegment } from '../types.ts';

/** Authored events live in the existing checkpointed mission flags. */
export const LAST_RELAY = 'last-relay:v1';
export const RELAY_SECTORS = 2;
export const RELAY_CHARACTER = 'Agent Nox and Mira, a courier in a yellow raincoat carrying a witness key';
export const isLastRelay = (mission?: MissionState): boolean => Boolean(mission?.flags.includes(LAST_RELAY));
const has = (mission: MissionState, flag: string) => mission.flags.includes(`relay:${flag}`);
const copy = (language: Language, en: string, ru: string) => language === 'ru' ? ru : en;
const line = (language: Language, en: string, ru: string, pressure = 2, missionBeat?: StorySegment['missionBeat']): StorySegment => ({
  text: copy(language, en, ru), type: SegmentType.NARRATIVE, mood: StoryMood.TENSE,
  skill: 'flow', pressure, missionBeat,
  objective: copy(language, 'The Last Relay · keep Mira on the line', 'Последний канал · удержать связь с Мирой')
});

export const getRelayStart = (level: number, language: Language, mission: MissionState): StorySegment => level === 1
  ? line(language, 'Mira whispers: "Nox, the door is locked. Please keep this channel open."', 'Мира шепчет: «Нокс, дверь заперта. Пожалуйста, не отключай этот канал».', 1)
  : has(mission, 'rescued')
    ? line(language, 'Mira reaches the rooftop relay with you. She carries the only witness key.', 'Мира выходит с тобой к передатчику на крыше. У неё единственный ключ свидетеля.', 2)
    : line(language, 'You reach the rooftop alone. Below you, Mira keeps knocking on the sealed door.', 'Ты выходишь на крышу один. Внизу Мира всё ещё стучит в запертую дверь.', 3);

/** Called again after settling the previous line, so new events affect the very next scene. */
export const getRelayBranch = (level: number, round: number, language: Language, mission: MissionState): BranchingStory => {
  const spotted = has(mission, 'spotted');
  const rescued = has(mission, 'rescued');
  let segment: StorySegment;
  if (level === 1) {
    switch (round) {
      case 2:
        segment = line(language, 'You loop the corridor camera before its lens can identify Mira behind the glass.', 'Ты замыкаешь запись камеры в коридоре, пока объектив не распознал Миру за стеклом.', 2, 'relay-camera');
        segment.consequenceHint = copy(language, 'Clean line: the service lift stays open. Otherwise, take the maintenance shaft.', 'Чистая строка: служебный лифт останется открыт. Иначе придётся идти через шахту.');
        break;
      case 3:
        segment = spotted
          ? line(language, 'The camera catches Mira. The lift locks; a maintenance shaft becomes your only way out.', 'Камера узнаёт Миру. Лифт блокируется; единственным выходом остаётся техническая шахта.', 4)
          : line(language, 'The camera repeats an empty corridor. Mira points to a service lift still waiting upstairs.', 'Камера повторяет пустой коридор. Мира указывает на служебный лифт, который ещё ждёт наверху.', 1);
        break;
      case 5:
        segment = rescued
          ? line(language, 'Mira catches your sleeve. "I can hold their scanner back when you reach the transmitter."', 'Мира хватает тебя за рукав. «Я задержу их сканер, когда ты доберёшься до передатчика».', 2)
          : line(language, 'The archive finishes copying. "You have the files," Mira says. "You still have time to use them."', 'Копирование архива завершено. «Файлы у тебя, — говорит Мира. — Ты ещё успеешь их передать».', 3);
        break;
      case 6:
        segment = spotted
          ? line(language, 'You bridge the broken shaft controls, release the emergency brake, and pull yourself past the live cables before the patrol reaches the hatch.', 'Ты соединяешь разбитые контакты, снимаешь аварийный тормоз и подтягиваешься мимо оголённых проводов, пока патруль не добрался до люка.', 5)
          : line(language, 'The service lift carries you above the patrol without a sound.', 'Служебный лифт бесшумно поднимает тебя над патрулём.', 1);
        break;
      default:
        segment = line(language, 'You force the rooftop hatch open as the corporation begins shutting down every public transmitter in the district.', 'Ты открываешь люк на крышу, пока корпорация отключает все публичные передатчики в районе.', 5);
    }
  } else {
    switch (round) {
      case 2:
        segment = rescued
          ? line(language, 'Mira plugs her witness key into the relay. The files now carry a living signature.', 'Мира вставляет ключ свидетеля в передатчик. Теперь у файлов есть подпись живого человека.', 2)
          : line(language, 'The stolen archive unlocks the relay. Without Mira, nobody can answer the receiver asking who sent it.', 'Украденный архив открывает передатчик. Без Миры некому ответить приёмщику, который спрашивает имя отправителя.', 3);
        break;
      case 3:
        segment = line(language, 'The public channel opens. The archive contains Mira\'s address alongside the evidence against the corporation.', 'Публичный канал открыт. Рядом с уликами против корпорации в архиве указан адрес Миры.', 3);
        break;
      case 5:
        segment = rescued
          ? line(language, 'Mira takes the scanner onto her own terminal. "Keep typing. I will buy you one clean window."', 'Мира переводит сканер на свой терминал. «Продолжай печатать. Я дам тебе несколько спокойных секунд».', 2, 'relay-cover')
          : line(language, 'The scanner finds your terminal. You hold the channel alone while boots strike the rooftop stairs.', 'Сканер находит твой терминал. Ты один удерживаешь канал, пока на лестнице грохочут шаги.', 5);
        segment.consequenceHint = rescued ? copy(language, 'Mira clears 18 trace after this line, once.', 'После этой строки Мира один раз снимет 18 следа.') : undefined;
        break;
      case 6:
        segment = has(mission, 'redacted')
          ? line(language, 'You strip the witness address from each signed packet, rebuild the verification chain, and keep the accusations intact as the relay begins to overheat.', 'Ты удаляешь адрес свидетеля из каждого пакета, восстанавливаешь цепочку проверки и сохраняешь обвинения, пока передатчик начинает перегреваться.', rescued ? 3 : 5)
          : line(language, 'The unedited archive clears verification. Every name will travel with it.', 'Полный архив проходит проверку. Вместе с ним уйдут все имена.', 3);
        break;
      default:
        segment = line(language, 'You hold the final connection open, sign the evidence, and send the last packet beyond the corporation\'s reach before the rooftop relay burns out.', 'Ты удерживаешь последнее соединение, подписываешь улики и отправляешь завершающий пакет за пределы сети корпорации, прежде чем передатчик сгорает.', rescued ? 3 : 5, 'relay-upload');
        segment.consequenceHint = copy(language, 'Clean line: verified publication. Otherwise, only a fragment gets through.', 'Чистая строка: подтверждённая публикация. Иначе пройдёт только фрагмент.');
    }
  }
  // These are consequences of persistent events, not alternate promises selected by an AI.
  return { goodPath: { ...segment }, mediumPath: { ...segment }, badPath: { ...segment } };
};

export const getRelayDecision = (level: number, language: Language, mission: MissionState): DecisionPoint => level === 1 ? {
  introText: copy(language, 'One power cell remains. Open Mira\'s door or copy the full archive before the lock resets.', 'Осталась одна батарея. Открыть дверь Миры или скопировать полный архив до перезапуска замка.'),
  options: [
    { id: 'relay-rescue', type: 'aggressive', text: copy(language, 'Open Mira\'s door', 'Открыть дверь Миры'),
      preview: copy(language, 'Mira escapes and will clear trace at the relay. Opening the door raises the alarm.', 'Мира выберется и снимет след у передатчика. Открытие двери поднимет тревогу.'),
      impact: { flag: 'relay:rescued', heat: 12, trust: 8, trace: 8, route: 'loud' },
      outcome: line(language, 'You spend the cell on the lock. Mira steps through the door as the alarm wakes above you.', 'Ты тратишь заряд на замок. Мира выходит из камеры, и над вами просыпается сигнализация.', 4) },
    { id: 'relay-archive', type: 'stealth', text: copy(language, 'Copy the archive; leave Mira inside', 'Скопировать архив; оставить Миру внутри'),
      preview: copy(language, 'More evidence, a quieter exit. Mira cannot help with the final transmission.', 'Больше улик и тихий выход. Мира не сможет помочь при последней передаче.'),
      impact: { flag: 'relay:archive', evidence: 14, heat: -4, trust: -8, route: 'silent' },
      outcome: line(language, 'You spend the cell on the archive. The door stays locked, and Mira stops asking you to open it.', 'Ты тратишь заряд на архив. Дверь остаётся запертой, и Мира больше не просит её открыть.', 2) }
  ]
} : {
  introText: copy(language, 'The archive is ready. Remove Mira\'s address with a longer verification, or transmit the original now.', 'Архив готов. Удалить адрес Миры и выполнить долгую проверку или отправить оригинал сейчас.'),
  options: [
    { id: 'relay-original', type: 'aggressive', text: copy(language, 'Publish the original', 'Передать оригинал'),
      preview: copy(language, 'Short verification, more evidence. Mira\'s identity becomes public.', 'Короткая проверка, больше улик. Личность Миры станет публичной.'),
      impact: { flag: 'relay:original', evidence: 8, trust: -5, route: 'loud' },
      outcome: line(language, 'You authorize the original archive. Mira\'s name stays on the outgoing packet.', 'Ты разрешаешь передачу оригинала. Имя Миры остаётся в исходящем пакете.', 3) },
    { id: 'relay-redact', type: 'stealth', text: copy(language, 'Protect Mira\'s identity', 'Скрыть личность Миры'),
      preview: copy(language, 'Longer verification under pressure. Her address stays private.', 'Долгая проверка под давлением. Её адрес останется скрыт.'),
      impact: { flag: 'relay:redacted', trust: 5, trace: 6, route: 'silent' },
      outcome: line(language, 'You remove Mira\'s address. The relay demands a new signature before it will accept the edited evidence.', 'Ты удаляешь адрес Миры. Передатчик требует новую подпись, прежде чем принять изменённые улики.', has(mission, 'rescued') ? 3 : 5) }
  ]
};

/** Event effects apply only when a tagged authored line is completed. */
export const getRelayBeatImpact = (mission: MissionState, segment: StorySegment, performance: 'good' | 'average' | 'bad'): DecisionImpact => {
  if (!isLastRelay(mission)) return {};
  if (segment.missionBeat === 'relay-camera' && !has(mission, 'spotted') && !has(mission, 'unseen')) {
    return { flag: performance === 'good' ? 'relay:unseen' : 'relay:spotted' };
  }
  if (segment.missionBeat === 'relay-cover' && has(mission, 'rescued') && !has(mission, 'covered')) {
    return { flag: 'relay:covered', trace: -18 };
  }
  if (segment.missionBeat === 'relay-upload' && !has(mission, 'published') && !has(mission, 'fragment')) {
    return { flag: performance === 'good' ? 'relay:published' : 'relay:fragment' };
  }
  return {};
};

export const getRelayEnding = (mission: MissionState, language: Language): { title: string; summary: string } => {
  const rescued = has(mission, 'rescued');
  const published = has(mission, 'published');
  const protectedIdentity = has(mission, 'redacted');
  const title = !published
    ? copy(language, 'A surviving fragment', 'Уцелевший фрагмент')
    : !rescued ? copy(language, 'Proof without a witness', 'Улики без свидетеля')
      : protectedIdentity ? copy(language, 'Two voices at dawn', 'Два голоса на рассвете')
        : copy(language, 'A name in the ledger', 'Имя в реестре');
  const transmission = published
    ? copy(language, 'The receiver verifies your final packet and publishes the evidence.', 'Приёмщик проверяет последний пакет и публикует улики.')
    : copy(language, 'The final signature breaks; only an unverified fragment reaches the receiver.', 'Последняя подпись повреждена; до приёмщика доходит лишь неподтверждённый фрагмент.');
  const witness = rescued
    ? copy(language, 'Mira escapes with you after shielding your transmission.', 'Мира уходит вместе с тобой, прикрыв передачу.')
    : copy(language, 'You leave with the archive. Mira remains behind the door you chose not to open.', 'Ты уходишь с архивом. Мира остаётся за дверью, которую ты решил не открывать.');
  const identity = protectedIdentity
    ? copy(language, 'The copy you sent keeps her address private.', 'В отправленной копии её адрес скрыт.')
    : copy(language, 'Her identity travels with the copy; the receiver now knows whom to look for.', 'Её имя уходит вместе с копией; теперь приёмщик знает, кого искать.');
  const exit = has(mission, 'spotted')
    ? copy(language, 'The camera forced your escape through the maintenance shaft.', 'Из-за камеры пришлось уходить через техническую шахту.')
    : copy(language, 'Your camera loop kept the service lift open.', 'Подмена записи камеры сохранила выход через служебный лифт.');
  return { title, summary: `${transmission} ${witness} ${identity} ${exit}` };
};

export const getRelaySummary = (level: number, mission: MissionState, language: Language): string => level >= RELAY_SECTORS
  ? getRelayEnding(mission, language).summary
  : copy(language,
    `${has(mission, 'rescued') ? 'Mira is with you; she can shield the transmission.' : 'You copied the full archive and left Mira behind.'} ${has(mission, 'spotted') ? 'The camera locked the lift, forcing you up the shaft.' : 'The looped camera let you use the lift.'} One rooftop relay remains online.`,
    `${has(mission, 'rescued') ? 'Мира с тобой; она сможет прикрыть передачу.' : 'Ты скопировал полный архив и оставил Миру внутри.'} ${has(mission, 'spotted') ? 'Камера заблокировала лифт; пришлось лезть через шахту.' : 'Подмена записи камеры позволила уйти на лифте.'} На крыше ещё работает один передатчик.`);
