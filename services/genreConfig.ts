import { SegmentType } from '../types.ts';
import type { Language, StoryGenreId, TypingSkill } from '../types.ts';

export interface LocalBranchTemplate {
  skill: TypingSkill;
  good: string;
  medium: string;
  bad: string;
  objective: string;
  type?: SegmentType;
}

interface GenreLocalText {
  protagonist: string;
  start: string;
  levelStart: string[];
  warmObjective: string;
  warmHint: string;
  sectorObjective: (level: number) => string;
}

interface GenreDecisionCopy {
  introHot: string;
  introCool: string;
  aggressive: string;
  stealth: string;
  aggressiveOutcome: string;
  stealthOutcome: string;
}

export interface GenrePack {
  id: StoryGenreId;
  chip: string;
  accent: string;
  name: Record<Language, string>;
  tagline: Record<Language, string>;
  storyGenre: string;
  // Prompt-side world bible: allowed vocabulary, forbidden vocabulary, and what
  // BREACH/SIGNAL drills look like INSIDE this world. Injected into every text
  // generation call so continuations can't drift back into cyberpunk.
  worldRules: string;
  heroName: string;
  heroBrief: Record<Language, string>;
  characterPrompt: string;
  artStyle: string;
  svgHueOffset: number;
  ui: {
    mainTitle: Record<Language, string>;
    introDesc: Record<Language, string>;
    campaignGoal: Record<Language, string>;
    victoryTitle: Record<Language, string>;
    connectionSevered: Record<Language, string>;
  };
  local: Record<Language, GenreLocalText>;
  branches: Record<Language, LocalBranchTemplate[]>;
  decision: Record<Language, GenreDecisionCopy>;
  summary: Record<Language, {
    finalClean: string;
    finalLoud: string;
    finalPartial: string;
    silent: (level: number) => string;
    loud: (level: number) => string;
    default: (level: number) => string;
  }>;
}

const breach = (good: string, medium: string, bad: string, objective: string): LocalBranchTemplate => ({
  skill: 'symbols',
  type: SegmentType.BREACH,
  good,
  medium,
  bad,
  objective
});

const flow = (good: string, medium: string, bad: string, objective: string): LocalBranchTemplate => ({
  skill: 'flow',
  good,
  medium,
  bad,
  objective
});

const dialog = (good: string, medium: string, bad: string, objective: string): LocalBranchTemplate => ({
  skill: 'punctuation',
  type: SegmentType.DIALOG,
  good,
  medium,
  bad,
  objective
});

const signal = (good: string, medium: string, bad: string, objective: string): LocalBranchTemplate => ({
  skill: 'numbers',
  type: SegmentType.SIGNAL,
  good,
  medium,
  bad,
  objective
});

export const GENRE_ORDER: StoryGenreId[] = ['cyberpunk', 'space_horror', 'noir', 'dark_fable', 'dead_channel'];

export const GENRE_PACKS: Record<StoryGenreId, GenrePack> = {
  cyberpunk: {
    id: 'cyberpunk',
    chip: '⚡',
    accent: '#22d3ee',
    name: { en: 'Cyberpunk Espionage', ru: 'Киберпанк-шпионаж' },
    tagline: { en: 'Neon cities, stolen ledgers, corporate hunters.', ru: 'Неоновые города, украденные реестры, корпоративные охотники.' },
    storyGenre: 'cyberpunk espionage typing thriller',
    worldRules: 'World: neon megacity, corporate towers, netrunners, drones, implants, black-market data. BREACH drills = terminal commands and hex codes (technical English). SIGNAL drills = node routes, frequencies, trace readouts.',
    heroName: 'Agent Nox',
    heroBrief: { en: 'hacker-agent stealing proof from a megacorp', ru: 'хакер-агент, крадущий улики у мегакорпорации' },
    characterPrompt: 'cyberpunk field agent/hacker with chrome cybernetics and a torn graphite coat',
    artStyle: 'Cyberpunk graphic novel key art, dark neon city, rain-slick streets, holographic ads, high contrast cinematic 16:9',
    svgHueOffset: 0,
    ui: {
      mainTitle: { en: 'Operation Black Ledger', ru: 'Операция Черный Реестр' },
      introDesc: { en: 'Type to move, decide to bend the city, survive to publish the proof.', ru: 'Печатай, чтобы двигаться; выбирай, чтобы менять город; выживи, чтобы опубликовать улики.' },
      campaignGoal: { en: 'Goal: survive four sectors and publish enough evidence.', ru: 'Цель: пережить четыре сектора и опубликовать достаточно улик.' },
      victoryTitle: { en: 'LEDGER PUBLISHED', ru: 'РЕЕСТР ОПУБЛИКОВАН' },
      connectionSevered: { en: 'Your link was severed before the Ledger went live.', ru: 'Связь оборвалась до публикации Реестра.' }
    },
    local: {
      en: {
        protagonist: 'A calm field agent with chrome irises and a torn graphite coat.',
        start: 'Agent Nox wakes inside a stolen courier drone as sirens bloom below.',
        levelStart: [
          'The safehouse shutters open to a city grid already searching for your pulse.',
          'Rain floods the relay roof while corporate spotlights comb the antenna forest.',
          'The archive vault breathes cold air and recognizes your stolen biometric mask.',
          'At the orbital uplink, the Black Ledger waits behind one final firewall.'
        ],
        warmObjective: 'Warm-up: hold rhythm',
        warmHint: 'Clean start lowers the hunt',
        sectorObjective: (level) => `Sector ${level}: new rhythm`
      },
      ru: {
        protagonist: 'Спокойный полевой агент с хромовыми радужками и рваным графитовым плащом.',
        start: 'Агент Нокс приходит в себя внутри украденного дрона-курьера; снизу вспыхивают сирены.',
        levelStart: [
          'Ставни убежища раскрываются, а городская сеть уже ищет твой пульс.',
          'Дождь заливает крышу ретранслятора, пока прожекторы прочесывают антенны.',
          'Архивное хранилище выдыхает холод и узнает твою украденную биомаску.',
          'На орбитальном узле Черный Реестр ждет за последним файрволом.'
        ],
        warmObjective: 'Разогрев: держи ритм',
        warmHint: 'Чистый старт снизит охоту',
        sectorObjective: (level) => `Сектор ${level}: новый ритм`
      }
    },
    branches: {
      en: [
        flow('You ghost through the checkpoint, letting the patrol chase your decoy heartbeat.', 'You slip past the checkpoint, but one camera catches a blurred shoulder.', 'The checkpoint blooms red; guards pivot toward the echo of your panic.', 'Smooth flow: keep momentum'),
        breach('>> inject_key --silent 47A9', '>> route_packet /safe/node-6', '>> TRACE_LOCKED :: FAIL_09', 'Symbols: exact characters only'),
        dialog('"Mira, hold the uplink," you whisper. "I am already inside."', '"Mira—wait—I need ten more seconds," you rasp into static.', '"They see me," you admit, and the channel dies mid-sentence.', 'Dialog: punctuation and quotes'),
        signal('4417-09 // sync_ok', '4417-?? // drift', '0000-00 // TRACE', 'Numbers: keep the sync clean'),
        flow('You plant the evidence shard where every free station can mirror it.', 'You plant the shard, but the upload coughs sparks into the trace.', 'The shard cracks in your glove, spilling proof into hostile storage.', 'Flow: long sentence control')
      ],
      ru: [
        flow('Ты проходишь пост, и патруль гонится только за фальшивым сердцебиением.', 'Ты минуешь пост, но одна камера ловит смазанное плечо.', 'Пост вспыхивает красным; охрана разворачивается на эхо твоей паники.', 'Поток: держи ровный темп'),
        breach('>> inject_key --silent 47A9', '>> route_packet /safe/node-6', '>> TRACE_LOCKED :: FAIL_09', 'Символы: точный ввод'),
        dialog('«Мира, держи аплинк,» шепчешь ты. «Я уже внутри.»', '«Мира—подожди—мне еще десять секунд,» хрипишь ты в помехи.', '«Они меня видят,» признаешь ты, и канал обрывается на полуслове.', 'Диалог: кавычки и знаки'),
        signal('4417-09 // sync_ok', '4417-?? // drift', '0000-00 // TRACE', 'Числа: держи синхронизацию'),
        flow('Ты ставишь осколок доказательств там, где его отзеркалит каждая свободная станция.', 'Ты ставишь осколок, но загрузка выбрасывает искры в трассировку.', 'Осколок трескается в перчатке, сливая доказательства во враждебное хранилище.', 'Поток: длинная фраза')
      ]
    },
    decision: {
      en: {
        introHot: 'A corporate hunter has your silhouette locked in thermal vision.',
        introCool: 'Two exits split ahead: the evidence server or a quiet service tunnel.',
        aggressive: 'Crack the server open and rip out the Black Ledger',
        stealth: 'Spoof the route and pass through the service layer',
        aggressiveOutcome: 'You tear the server shell open and seize the evidence core.',
        stealthOutcome: '>> ghost_route --mask MIRA --ttl 08'
      },
      ru: {
        introHot: 'Корпоративный охотник уже видит твой силуэт в тепловом канале.',
        introCool: 'Перед тобой развилка: сервер улик или тихий сервисный тоннель.',
        aggressive: 'Вломиться в сервер и вытащить Черный Реестр',
        stealth: 'Подменить маршрут и пройти сервисным слоем',
        aggressiveOutcome: 'Ты выбиваешь крышку сервера и хватаешь ядро с уликами.',
        stealthOutcome: '>> ghost_route --mask MIRA --ttl 08'
      }
    },
    summary: {
      en: {
        finalClean: 'You publish the Black Ledger without leaving a spare fingerprint. The city wakes as the corporation loses its name, face, and power.',
        finalLoud: 'The Black Ledger hits the net, but your silhouette rides the broadcast. Victory is loud, dangerous, and irreversible.',
        finalPartial: 'You break the final node and survive, though some proof remains sealed. This is not the end of the war, only its first honest scar.',
        silent: (level) => `Sector ${level} falls almost silently: Mira trusts you more, and the hunt loses your scent.`,
        loud: (level) => `Sector ${level} is taken by force: you gain proof, but the city starts recognizing your signature.`,
        default: (level) => `Sector ${level} is survived at a price: the network trembles, and your errors become part of the route.`
      },
      ru: {
        finalClean: 'Ты публикуешь Черный Реестр без единого лишнего следа. Город просыпается, а корпорация теряет имя, лицо и власть.',
        finalLoud: 'Черный Реестр уходит в сеть, но вместе с ним всплывает твой цифровой силуэт. Победа громкая, опасная и необратимая.',
        finalPartial: 'Ты срываешь финальный узел и выживаешь, но часть доказательств остается запертой. Это не конец войны, а первый правильный шрам.',
        silent: (level) => `Сектор ${level} пройден почти бесшумно: Мира доверяет тебе больше, а охота теряет запах.`,
        loud: (level) => `Сектор ${level} взят силой: улик больше, но город начинает узнавать твой почерк.`,
        default: (level) => `Сектор ${level} пережит с ценой: сеть дрожит, а твои ошибки становятся частью маршрута.`
      }
    }
  },
  space_horror: {
    id: 'space_horror',
    chip: '🛸',
    accent: '#a78bfa',
    name: { en: 'Space Horror', ru: 'Космический хоррор' },
    tagline: { en: 'Dead stations, wrong signals, something listening in the vents.', ru: 'Мертвые станции, ложные сигналы, что-то слушает в вентиляции.' },
    storyGenre: 'sci-fi space horror typing survival thriller',
    worldRules: 'World: a derelict deep-space station — failing life support, flickering corridors, something alive in the vents. Tech is heavy retro-industrial ship hardware. FORBIDDEN vocabulary: city streets, cars, corporate hacker slang, magic. BREACH drills = airlock/reactor override sequences (e.g. "AIRLOCK-7 OVERRIDE // VENT-CYCLE-3"). SIGNAL drills = distress frequencies, oxygen readouts, deck coordinates.',
    heroName: 'Drifter Kael',
    heroBrief: { en: 'lone salvage runner escaping a haunted orbital relay', ru: 'одинокий спасатель, бегущий с проклятого орбитального ретранслятора' },
    characterPrompt: 'worn EVA suit, frost on visor, emergency lamp, haunted orbital survivor',
    artStyle: 'Sci-fi horror graphic novel, claustrophobic space station, emergency red lighting, fogged visors, cosmic dread, cinematic 16:9',
    svgHueOffset: 55,
    ui: {
      mainTitle: { en: 'Signal from the Black Relay', ru: 'Сигнал с Черного Ретранслятора' },
      introDesc: { en: 'Type to keep the airlock sequence alive, choose routes through the dead station, escape with the blackbox.', ru: 'Печатай, чтобы держать шлюз живым; выбирай маршруты по мертвой станции; выберись с черным ящиком.' },
      campaignGoal: { en: 'Goal: survive four decks and extract the relay blackbox.', ru: 'Цель: пережить четыре палубы и извлечь черный ящик ретранслятора.' },
      victoryTitle: { en: 'BLACKBOX EXTRACTED', ru: 'ЧЕРНЫЙ ЯЩИК ИЗВЛЕЧЕН' },
      connectionSevered: { en: 'The station swallowed your signal before the blackbox could transmit.', ru: 'Станция поглотила твой сигнал до передачи черного ящика.' }
    },
    local: {
      en: {
        protagonist: 'A frost-scarred drifter in a cracked EVA suit and a dying headlamp.',
        start: 'Kael wakes to vent hiss and a chorus of footsteps that are not his.',
        levelStart: [
          'Deck One opens on corridors where every door remembers a scream.',
          'Deck Two flickers with emergency red and a childlike voice in the comms.',
          'Deck Three stores frozen bodies behind glass that fogs when you type.',
          'The black relay core hums like a throat waiting for your last command.'
        ],
        warmObjective: 'Keep breathing rhythm steady',
        warmHint: 'Clean typing keeps the suit pressure stable',
        sectorObjective: (level) => `Deck ${level}: hold the line`
      },
      ru: {
        protagonist: 'Измороженный дрифтер в треснувшем скафандре и умирающем налобнике.',
        start: 'Каэл просыпается от шипения вентиляции и чужих шагов в коридоре.',
        levelStart: [
          'Палуба один открывается коридорами, где каждая дверь помнит крик.',
          'Палуба два мерцает аварийным красным и детским голосом в связи.',
          'Палуба три хранит замороженные тела за стеклом, которое запотевает от твоего набора.',
          'Ядро черного ретранслятора гудит, как горло, ждущее последней команды.'
        ],
        warmObjective: 'Держи ровный дыхательный ритм',
        warmHint: 'Чистый набор стабилизирует давление в скафандре',
        sectorObjective: (level) => `Палуба ${level}: держи линию`
      }
    },
    branches: {
      en: [
        flow('You crawl through a maintenance duct while something scratches parallel pipes.', 'You squeeze through the duct, but your shoulder leaves a smear on the grate.', 'The duct seals behind you with a wet click and the lights die.', 'Flow: do not break rhythm'),
        breach('>> vent_override --deck 03', '>> seal_breach /temp', '>> HULL_FAIL :: BREACH_09', 'Terminal: exact override codes'),
        dialog('"Stay quiet," you tell the empty suit. "It listens for breath."', '"Stay—quiet—please," you beg the dark, and the vents answer.', '"It already heard me," you say, and the suit radio fills with wet static.', 'Dialog: keep the commas clean'),
        signal('03:17 // O2_stable', '03:?? // O2_drift', '00:00 // HULL_ALARM', 'Numbers: suit telemetry'),
        flow('You rip the blackbox free while the station exhales frozen dust.', 'You free the blackbox, but a proximity alarm wakes in the walls.', 'The blackbox slips, and the deck tilts toward the hungry dark.', 'Flow: long extraction line')
      ],
      ru: [
        flow('Ты ползешь по техшахте, пока что-то царапает параллельные трубы.', 'Ты протискиваешься, но плечо оставляет след на решетке.', 'Шахта захлопывается мокрым щелчком, и свет гаснет.', 'Поток: не ломай ритм'),
        breach('>> vent_override --deck 03', '>> seal_breach /temp', '>> HULL_FAIL :: BREACH_09', 'Терминал: точные коды'),
        dialog('«Тише,» говоришь ты пустому скафандру. «Оно слушает дыхание.»', '«Тише—пожалуйста—тише,» молишь ты тьму, и вентиляция отвечает.', '«Оно уже меня слышало,» говоришь ты, и рация наполняется мокрыми помехами.', 'Диалог: держи запятые'),
        signal('03:17 // O2_stable', '03:?? // O2_drift', '00:00 // HULL_ALARM', 'Числа: телеметрия скафандра'),
        flow('Ты вырываешь черный ящик, пока станция выдыхает ледяную пыль.', 'Ты освобождаешь ящик, но в стенах просыпается тревога.', 'Черный ящик соскальзывает, и палуба наклоняется в голодную тьму.', 'Поток: длинная линия извлечения')
      ]
    },
    decision: {
      en: {
        introHot: 'Something heavy is pacing the bulkhead outside the relay room.',
        introCool: 'Two paths: rip the blackbox from the core or ghost through the coolant spine.',
        aggressive: 'Force the relay core open and tear out the blackbox',
        stealth: 'Ride the coolant spine and spoof life-support logs',
        aggressiveOutcome: 'You wrench the core hatch open as frost bites your gloves.',
        stealthOutcome: '>> ghost_vent --mask KAEL --ttl 06'
      },
      ru: {
        introHot: 'Что-то тяжелое ходит по переборке за дверью релейной.',
        introCool: 'Два пути: вырвать черный ящик из ядра или пройти по хребту охлаждения.',
        aggressive: 'Взломать ядро ретранслятора и вырвать черный ящик',
        stealth: 'Пройти по вентиляции охлаждения и подменить логи жизнеобеспечения',
        aggressiveOutcome: 'Ты выламываешь люк ядра, пока иней кусает перчатки.',
        stealthOutcome: '>> ghost_vent --mask KAEL --ttl 06'
      }
    },
    summary: {
      en: {
        finalClean: 'The blackbox transmits clean. The station goes quiet, and for once the dark feels empty.',
        finalLoud: 'The blackbox screams into the void with your heat signature riding the burst.',
        finalPartial: 'You escape with fragments of truth while the relay keeps dreaming below.',
        silent: (level) => `Deck ${level} passes in near silence; the thing in the vents loses your scent.`,
        loud: (level) => `Deck ${level} answers every footstep; the station learns your rhythm.`,
        default: (level) => `Deck ${level} is survived, but the hull remembers every typo you fed it.`
      },
      ru: {
        finalClean: 'Черный ящик уходит чистой передачей. Станция затихает, и тьма наконец пуста.',
        finalLoud: 'Черный ящик кричит в пустоту, и твой тепловой след едет на всплеске.',
        finalPartial: 'Ты выбираешься с осколками правды, пока ретранслятор все еще спит внизу.',
        silent: (level) => `Палуба ${level} пройдена почти бесшумно; существо в вентиляции теряет запах.`,
        loud: (level) => `Палуба ${level} отвечает на каждый шаг; станция запоминает твой ритм.`,
        default: (level) => `Палуба ${level} пережита, но корпус помнит каждую опечатку.`
      }
    }
  },
  noir: {
    id: 'noir',
    chip: '🎩',
    accent: '#fbbf24',
    name: { en: 'Noir Detective', ru: 'Нуар-детектив' },
    tagline: { en: 'Rain, cigarettes, ledgers that ruin mayors.', ru: 'Дождь, сигареты, реестры, которые рушат мэров.' },
    storyGenre: 'noir detective typing thriller',
    worldRules: 'World: a rain-soaked 1950s city — detectives, informants, jazz clubs, revolvers, corrupt officials, case files. STRICTLY period technology: rotary phones, telegrams, typewriters, tape recorders. FORBIDDEN vocabulary: mainframe, server, drone, neon, cyber, hack/hacking, laser, AI, hex codes, anything digital. BREACH drills = case codes, safe combinations, license plates (e.g. "CASE 47-B // SAFE 12-31-8"). SIGNAL drills = police radio codes, phone numbers, street addresses, train times.',
    heroName: 'Detective Vale',
    heroBrief: { en: 'cynical private eye chasing a city ledger that buys judges', ru: 'циничный частный детектив, идущий за городским реестром, покупающим судей' },
    characterPrompt: 'noir detective in a soaked trench coat, cigarette glow, rain-slick alley lighting',
    artStyle: 'Film noir graphic novel, high-contrast black and amber, rain, venetian blind shadows, cinematic 16:9',
    svgHueOffset: 35,
    ui: {
      mainTitle: { en: 'The Ledger on Rain Street', ru: 'Реестр на Улице Дождя' },
      introDesc: { en: 'Type to follow the trail, choose who to burn, survive long enough to print the truth.', ru: 'Печатай, чтобы идти по следу; выбирай, кого сжечь; выживи, чтобы напечатать правду.' },
      campaignGoal: { en: 'Goal: survive four nights and get the ledger to print.', ru: 'Цель: пережить четыре ночи и довести реестр до печати.' },
      victoryTitle: { en: 'TRUTH PRINTED', ru: 'ПРАВДА НАПЕЧАТАНА' },
      connectionSevered: { en: 'The presses stopped before your ledger ever hit the street.', ru: 'Пресса остановилась до того, как реестр вышел на улицу.' }
    },
    local: {
      en: {
        protagonist: 'A tired detective with rain in his collar and ink under his nails.',
        start: 'Vale steps into the rain as a payphone whispers the mayor bought another judge.',
        levelStart: [
          'Night one begins in a pawnshop that sells alibis by the hour.',
          'Night two smells of wet asphalt and a witness who will not look up.',
          'Night three opens the ledger room where numbers have names and graves.',
          'The print shop waits with ink still warm from the last lie they published.'
        ],
        warmObjective: 'Warm-up: keep the cadence',
        warmHint: 'Clean typing keeps the tail off your back',
        sectorObjective: (level) => `Night ${level}: new lead`
      },
      ru: {
        protagonist: 'Усталый детектив с дождем в воротнике и чернилами под ногтями.',
        start: 'Вейл выходит в дождь, когда таксофон шепчет: мэр купил еще одного судью.',
        levelStart: [
          'Ночь первая начинается в ломбарде, где продают алиби по часам.',
          'Ночь вторая пахнет мокрым асфальтом и свидетелем, который не поднимает глаз.',
          'Ночь третья открывает комнату реестра, где у цифр есть имена и могилы.',
          'Типография ждет с чернилами, еще теплыми от последней лжи.'
        ],
        warmObjective: 'Разогрев: держи каденцию',
        warmHint: 'Чистый набор отрывает хвост',
        sectorObjective: (level) => `Ночь ${level}: новая нитка`
      }
    },
    branches: {
      en: [
        flow('You tail the courier through steam and let the rain erase your footsteps.', 'You keep the tail, but a streetlight catches your reflection in a puddle.', 'The courier spots your shadow and vanishes into a jazz club back door.', 'Flow: keep the tail smooth'),
        breach('>> ledger_pull --case 17A', '>> subpoena_sync /judge-4', '>> WITNESS_FAIL :: LOST', 'Terminal: legal codes matter'),
        dialog('"Talk," you tell the witness. "Names first, alibis later."', '"Talk—now—before they find us," you hiss through wet teeth.', '"Forget it," he says, and the booth goes cold.', 'Dialog: quotes under pressure'),
        signal('02:41 // alley_clear', '02:?? // tail_close', '00:00 // BADGE_FLASH', 'Numbers: stakeout clock'),
        flow('You slide the ledger pages under the press rollers before dawn.', 'You feed the press, but a corrupt editor smells ink on your hands.', 'The rollers jam and the truth scatters across the wet floor.', 'Flow: long confession line')
      ],
      ru: [
        flow('Ты идешь за курьером сквозь пар и позволяешь дождю стереть следы.', 'Ты держишь хвост, но фонарь ловит твое отражение в луже.', 'Курьер замечает тень и исчезает в черном ходу джаз-клуба.', 'Поток: ровный хвост'),
        breach('>> ledger_pull --case 17A', '>> subpoena_sync /judge-4', '>> WITNESS_FAIL :: LOST', 'Терминал: важны юридические коды'),
        dialog('«Говори,» говоришь ты свидетелю. «Сначала имена, алиби потом.»', '«Говори—сейчас—пока они нас не нашли,» шипишь ты сквозь мокрые зубы.', '«Забудь,» отвечает он, и кабинка стынет.', 'Диалог: кавычки под давлением'),
        signal('02:41 // alley_clear', '02:?? // tail_close', '00:00 // BADGE_FLASH', 'Числа: часы слежки'),
        flow('Ты подсовываешь страницы реестра под валы прессы до рассвета.', 'Ты кормишь прессу, но продажный редактор чует чернила на руках.', 'Валы заедают, и правда рассыпается по мокрому полу.', 'Поток: длинная исповедь')
      ]
    },
    decision: {
      en: {
        introHot: 'A black sedan idles across the street; someone inside knows your name.',
        introCool: 'Two choices: kick in the ledger room or bribe the night archivist.',
        aggressive: 'Kick the ledger room and grab the judge list',
        stealth: 'Bribe the archivist and copy the files after midnight',
        aggressiveOutcome: 'You splinter the ledger room door and the truth spills into the rain.',
        stealthOutcome: '>> archive_copy --alias VALE --ttl 04'
      },
      ru: {
        introHot: 'Черный седан стоит через улицу; кто-то внутри знает твое имя.',
        introCool: 'Два выбора: выломать комнату реестра или подкупить ночного архивариуса.',
        aggressive: 'Выломать комнату реестра и забрать список судей',
        stealth: 'Подкупить архивариуса и скопировать дела после полуночи',
        aggressiveOutcome: 'Ты выбиваешь дверь комнаты реестра, и правда льется в дождь.',
        stealthOutcome: '>> archive_copy --alias VALE --ttl 04'
      }
    },
    summary: {
      en: {
        finalClean: 'The ledger prints at dawn. The city pretends not to read it, but everyone does.',
        finalLoud: 'The headline hits the street with your name in the margin and blood in the ink.',
        finalPartial: 'You print enough truth to hurt someone powerful, but not enough to save everyone.',
        silent: (level) => `Night ${level} ends quietly; the tail loses interest in your silhouette.`,
        loud: (level) => `Night ${level} ends loud; every typo buys another pair of eyes on you.`,
        default: (level) => `Night ${level} is survived, but the case file grows another stain.`
      },
      ru: {
        finalClean: 'Реестр печатается на рассвете. Город делает вид, что не читает, но все читают.',
        finalLoud: 'Заголовок бьет по улице с твоим именем на полях и кровью в чернилах.',
        finalPartial: 'Ты печатаешь достаточно правды, чтобы ранить сильного, но не всех спасти.',
        silent: (level) => `Ночь ${level} заканчивается тихо; хвост теряет интерес к твоему силуэту.`,
        loud: (level) => `Ночь ${level} заканчивается громко; каждая опечатка покупает новые глаза.`,
        default: (level) => `Ночь ${level} пережита, но дело получает еще одно пятно.`
      }
    }
  },
  dark_fable: {
    id: 'dark_fable',
    chip: '🕯️',
    accent: '#f472b6',
    name: { en: 'Dark Fairy Tale', ru: 'Тёмная сказка' },
    tagline: { en: 'Cursed woods, borrowed names, truths that bite back.', ru: 'Проклятый лес, одолженные имена, правда, которая кусается.' },
    storyGenre: 'dark fairy tale typing fable',
    worldRules: 'World: a cursed forest and crooked villages — witches, bargains, talking beasts, borrowed names, old magic. Pre-industrial only: candles, ink, iron keys, bells. FORBIDDEN vocabulary: any modern or sci-fi technology, guns, computers, neon. BREACH drills = incantations, rune words, oath phrases (e.g. "SPEAK THRICE // MARROW-MARROW-MARROW"). SIGNAL drills = bell tolls, moon phases, counting rhymes (e.g. "third bell // ninth stone // one candle").',
    heroName: 'Mara the Ink-Walker',
    heroBrief: { en: 'cursed wanderer stealing names from a living storybook forest', ru: 'проклятый странник, крадущий имена из живого сказочного леса' },
    characterPrompt: 'dark fable heroine with ink-stained hands, lantern moss, thorn crown, storybook forest mood',
    artStyle: 'Dark fairy tale illustration, ink-wash forest, candlelight, thorns, storybook silhouettes, painterly cinematic 16:9',
    svgHueOffset: 95,
    ui: {
      mainTitle: { en: 'The Book That Bites Back', ru: 'Книга, которая кусается' },
      introDesc: { en: 'Type to walk the cursed paths, choose which names to steal, survive until the final page turns.', ru: 'Печатай, чтобы идти проклятыми тропами; выбирай, чьи имена украсть; доживи до последней страницы.' },
      campaignGoal: { en: 'Goal: survive four chapters and rewrite the ending.', ru: 'Цель: пережить четыре главы и переписать финал.' },
      victoryTitle: { en: 'ENDING REWRITTEN', ru: 'ФИНАЛ ПЕРЕПИСАН' },
      connectionSevered: { en: 'The book closed on your story before the last page could turn.', ru: 'Книга закрылась на твоей истории до последней страницы.' }
    },
    local: {
      en: {
        protagonist: 'A wanderer with ink on her palms and a lantern full of borrowed names.',
        start: 'Mara wakes where the path remembers every lie ever told beneath these trees.',
        levelStart: [
          'Chapter one opens on a bridge that charges a true name for passage.',
          'Chapter two winds through a orchard where apples whisper old debts.',
          'Chapter three finds the throne of thorns that keeps rewriting your shadow.',
          'The final page waits in a clearing where the book itself is breathing.'
        ],
        warmObjective: 'Warm-up: walk the line',
        warmHint: 'Clean typing keeps the forest from listening',
        sectorObjective: (level) => `Chapter ${level}: new verse`
      },
      ru: {
        protagonist: 'Странница с чернилами на ладонях и фонарем, полным одолженных имен.',
        start: 'Мара просыпается там, где тропа помнит каждую ложь под этими деревьями.',
        levelStart: [
          'Глава первая открывается на мосту, который берет правдивое имя за проход.',
          'Глава вторая ведет через сад, где яблоки шепчут старые долги.',
          'Глава третья находит трон из шипов, переписывающий твою тень.',
          'Последняя страница ждет на поляне, где сама книга дышит.'
        ],
        warmObjective: 'Разогрев: иди по линии',
        warmHint: 'Чистый набор не дает лесу слушать',
        sectorObjective: (level) => `Глава ${level}: новый стих`
      }
    },
    branches: {
      en: [
        flow('You cross the bridge by typing the name the river forgot to drown.', 'You cross, but the bridge keeps one syllable of your name as toll.', 'The bridge snaps shut and the river speaks your true name aloud.', 'Flow: keep the verse steady'),
        breach('>> name_bind --thorn 7', '>> page_turn /chapter-3', '>> CURSE_LOCK :: FAIL', 'Rune codes: exact symbols'),
        dialog('"Give me passage," you tell the bridge. "I will not give my true name."', '"Give—me—passage," you beg, and the wood drinks a syllable.', '"Too late," the bridge answers, tasting your full name.', 'Dialog: fairy-tale punctuation'),
        signal('VII-03 // path_open', 'VII-?? // toll_due', '000-00 // NAME_TAKEN', 'Numbers: chapter marks'),
        flow('You tear the ending free and the forest exhales candle smoke.', 'You rewrite the page, but the book bleeds ink across your wrists.', 'The page turns backward and your story becomes someone else.', 'Flow: long fable line')
      ],
      ru: [
        flow('Ты переходишь мост, набирая имя, которое река забыла утопить.', 'Ты переходишь, но мост оставляет себе один слог твоего имени.', 'Мост захлопывается, и река произносит твое истинное имя вслух.', 'Поток: держи стих ровно'),
        breach('>> name_bind --thorn 7', '>> page_turn /chapter-3', '>> CURSE_LOCK :: FAIL', 'Руны: точные символы'),
        dialog('«Дай проход,» говоришь ты мосту. «Истинного имени не отдам.»', '«Дай—мне—проход,» молишь ты, и дерево пьет слог.', '«Поздно,» отвечает мост, пробуя полное имя.', 'Диалог: сказочная пунктуация'),
        signal('VII-03 // path_open', 'VII-?? // toll_due', '000-00 // NAME_TAKEN', 'Числа: метки глав'),
        flow('Ты вырываешь финал, и лес выдыхает дым свечи.', 'Ты переписываешь страницу, но книга пачкает чернилами запястья.', 'Страница переворачивается назад, и история становится чужой.', 'Поток: длинная сказочная строка')
      ]
    },
    decision: {
      en: {
        introHot: 'The book stands open on a stump, and something inside is reading you back.',
        introCool: 'Two paths: steal the ending by force or trade a borrowed name for passage.',
        aggressive: 'Rip the ending out and bind it to your own name',
        stealth: 'Trade a borrowed name and slip through the thorn gate',
        aggressiveOutcome: 'You tear the ending free as thorns bloom along the margins.',
        stealthOutcome: '>> thorn_gate --alias MARA --ttl 05'
      },
      ru: {
        introHot: 'Книга стоит раскрытой на пне, и что-то внутри читает тебя в ответ.',
        introCool: 'Два пути: вырвать финал силой или отдать одолженное имя за проход.',
        aggressive: 'Вырвать финал и привязать его к своему имени',
        stealth: 'Отдать одолженное имя и пройти через шиповые врата',
        aggressiveOutcome: 'Ты вырываешь финал, и шипы цветут по полям.',
        stealthOutcome: '>> thorn_gate --alias MARA --ttl 05'
      }
    },
    summary: {
      en: {
        finalClean: 'You rewrite the ending cleanly. The forest forgets your debts for one honest night.',
        finalLoud: 'The ending screams into the trees, and every creature learns your name.',
        finalPartial: 'You change the story enough to escape, but the book keeps one page of you.',
        silent: (level) => `Chapter ${level} closes softly; the woods stop repeating your mistakes.`,
        loud: (level) => `Chapter ${level} ends loud; every typo becomes a verse the forest sings.`,
        default: (level) => `Chapter ${level} is survived, but the tale grows another thorn.`
      },
      ru: {
        finalClean: 'Ты переписываешь финал чисто. Лес забывает твои долги на одну честную ночь.',
        finalLoud: 'Финал кричит в деревья, и каждое существо узнает твое имя.',
        finalPartial: 'Ты меняешь историю достаточно, чтобы выбраться, но книга хранит страницу о тебе.',
        silent: (level) => `Глава ${level} закрывается мягко; лес перестает повторять ошибки.`,
        loud: (level) => `Глава ${level} кончается громко; каждая опечатка становится стихом леса.`,
        default: (level) => `Глава ${level} пережита, но сказка вырастает еще один шип.`
      }
    }
  },
  dead_channel: {
    id: 'dead_channel',
    chip: '📺',
    accent: '#a3e635',
    name: { en: 'Dead Channel', ru: 'Мёртвый канал' },
    tagline: { en: 'Analog static, a frequency that broadcasts what has not happened yet.', ru: 'Аналоговый шум, частота, которая вещает то, чего ещё не было.' },
    storyGenre: 'analog horror typing broadcast',
    worldRules: 'World: a dying analog broadcast station at the edge of town — CRT monitors, reel-to-reel tape, VU meters, coax cable, emergency alert tones, a frequency that should be empty. STRICTLY analog technology: dials, switches, patch cords, vacuum tubes, magnetic tape. FORBIDDEN vocabulary: internet, server, drone, AI, digital, cyber, neon, hacking as software. BREACH drills = frequency coordinates, tape counter marks, switchboard patches (e.g. "FREQ 88.7 // PATCH 4-B-12"). SIGNAL drills = timecodes, channel numbers, VU readings, countdown slates.',
    heroName: 'Vera the Night Engineer',
    heroBrief: { en: 'night-shift engineer keeping a dead frequency on air while it broadcasts tomorrow', ru: 'ночной инженер, держащий мёртвую частоту в эфире, пока она вещает завтра' },
    characterPrompt: 'lone broadcast engineer in a dark control room, CRT glow on her face, headphones around neck, analog dials and tape reels',
    artStyle: 'Analog horror broadcast still, CRT phosphor glow, scanlines, VHS grain, dark control room, sickly green and amber, cinematic 16:9',
    svgHueOffset: 60,
    ui: {
      mainTitle: { en: 'The Frequency That Answers First', ru: 'Частота, которая отвечает первой' },
      introDesc: { en: 'Type to hold the signal open, choose what goes on air, survive until the broadcast ends.', ru: 'Печатай, чтобы держать сигнал открытым; выбирай, что выйдет в эфир; доживи до конца трансляции.' },
      campaignGoal: { en: 'Goal: survive four hours on air and cut the feed clean.', ru: 'Цель: продержаться четыре часа в эфире и обрезать сигнал чисто.' },
      victoryTitle: { en: 'FEED CUT CLEAN', ru: 'ЭФИР ОБРЕЗАН ЧИСТО' },
      connectionSevered: { en: 'The carrier dropped before you could cut it — something else is still broadcasting.', ru: 'Несущая упала раньше, чем ты успел обрезать — что-то ещё продолжает вещать.' }
    },
    local: {
      en: {
        protagonist: 'A night engineer with solder burns on her fingers and a dead channel that will not stay dead.',
        start: 'Vera powers up the board at 03:00 and the dead channel is already mid-sentence.',
        levelStart: [
          'Hour one hums through a control room where every VU needle twitches in unison.',
          'Hour two brings a caller who reads tomorrow\'s obituaries on the open line.',
          'Hour three opens the tape archive where every reel is labeled with your name.',
          'The final hour waits behind a transmitter that has started breathing.'
        ],
        warmObjective: 'Warm-up: hold the carrier',
        warmHint: 'Clean typing keeps the static from forming words',
        sectorObjective: (level) => `Hour ${level}: on air`
      },
      ru: {
        protagonist: 'Ночной инженер со следами припоя на пальцах и мёртвым каналом, который не хочет умирать.',
        start: 'Вера включает пульт в 03:00, а мёртвый канал уже говорит на середине фразы.',
        levelStart: [
          'Час первый гудит в аппаратной, где все стрелки VU дрожат в унисон.',
          'Час второй приносит звонящего, который читает завтрашние некрологи в открытую линию.',
          'Час третий открывает архив лент, где каждая бобина подписана твоим именем.',
          'Последний час ждёт за передатчиком, который начал дышать.'
        ],
        warmObjective: 'Разогрев: держи несущую',
        warmHint: 'Чистый набор не даёт шуму сложиться в слова',
        sectorObjective: (level) => `Час ${level}: в эфире`
      }
    },
    branches: {
      en: [
        flow('You ride the gain and the dead channel settles into a voice that knows your shift schedule.', 'You hold the carrier, but the VU needles start spelling letters.', 'The signal slips and the static says your name in your own voice.', 'Flow: ride the gain steady'),
        breach('>> patch_bay --freq 88.7', '>> tape_seek /reel-13', '>> CARRIER_LOST :: OPEN', 'Patch bay: exact coordinates'),
        dialog('"Stay on the line," you tell the caller. "Tell me what happens at dawn."', '"Stay—on—the—line," you beg, and the dial tone answers in your voice.', '"You already know," it says, and the line goes to snow.', 'Dialog: voices on the wire'),
        signal('03:13 // carrier_hold', '03:?? // bleed_through', '00:00 // FEED_OPEN', 'Timecodes: broadcast clock'),
        flow('You cut the feed at the exact frame the broadcast predicted you would.', 'You reach the switch, but the transmitter has already chosen a new frequency.', 'The feed cuts itself and the silence keeps transmitting.', 'Flow: long sign-off line')
      ],
      ru: [
        flow('Ты ведёшь усиление, и мёртвый канал укладывается в голос, знающий твоё расписание смен.', 'Ты держишь несущую, но стрелки VU начинают складываться в буквы.', 'Сигнал срывается, и шум произносит твоё имя твоим же голосом.', 'Поток: веди усиление ровно'),
        breach('>> patch_bay --freq 88.7', '>> tape_seek /reel-13', '>> CARRIER_LOST :: OPEN', 'Коммутация: точные координаты'),
        dialog('«Оставайтесь на линии,» говоришь ты звонящему. «Скажите, что будет на рассвете.»', '«Оставайтесь—на—линии,» молишь ты, и гудок отвечает твоим голосом.', '«Ты уже знаешь,» отвечает оно, и линия уходит в снег.', 'Диалог: голоса в проводах'),
        signal('03:13 // carrier_hold', '03:?? // bleed_through', '00:00 // FEED_OPEN', 'Таймкоды: эфирные часы'),
        flow('Ты обрезаешь эфир ровно на том кадре, который трансляция предсказала.', 'Ты тянешься к рубильнику, но передатчик уже выбрал новую частоту.', 'Эфир обрезает себя сам, и тишина продолжает вещать.', 'Поток: длинная строка отбоя')
      ]
    },
    decision: {
      en: {
        introHot: 'The emergency tone fires on its own; the script it reads is tonight\'s schedule.',
        introCool: 'Two moves: kill the transmitter or reroute the feed through the dead archive.',
        aggressive: 'Kill the transmitter and burn the tape archive',
        stealth: 'Reroute the feed through the archive and let it broadcast itself out',
        aggressiveOutcome: 'You drop the transmitter and the building exhales a decade of dead air.',
        stealthOutcome: '>> feed_reroute --archive 13 --ttl 06'
      },
      ru: {
        introHot: 'Аварийный тон срабатывает сам; сценарий, который он читает — расписание этой ночи.',
        introCool: 'Два хода: убить передатчик или пустить эфир через мёртвый архив.',
        aggressive: 'Убить передатчик и сжечь архив лент',
        stealth: 'Пустить эфир через архив и дать ему вывещать себя до конца',
        aggressiveOutcome: 'Ты роняешь передатчик, и здание выдыхает десятилетие мёртвого эфира.',
        stealthOutcome: '>> feed_reroute --archive 13 --ttl 06'
      }
    },
    summary: {
      en: {
        finalClean: 'You cut the feed on the predicted frame. The static forgets your voice by morning.',
        finalLoud: 'The sign-off screams across every channel, and the whole town hears its own tomorrow.',
        finalPartial: 'You cut enough of the feed to leave, but one frequency keeps your chair warm.',
        silent: (level) => `Hour ${level} ends quiet; the needles stop spelling.`,
        loud: (level) => `Hour ${level} ends loud; every typo goes out live on the open band.`,
        default: (level) => `Hour ${level} is survived, but the log gains another impossible entry.`
      },
      ru: {
        finalClean: 'Ты обрезаешь эфир на предсказанном кадре. К утру шум забывает твой голос.',
        finalLoud: 'Отбой кричит по всем каналам, и весь город слышит своё завтра.',
        finalPartial: 'Ты обрезаешь достаточно эфира, чтобы уйти, но одна частота греет твоё кресло.',
        silent: (level) => `Час ${level} кончается тихо; стрелки перестают складывать буквы.`,
        loud: (level) => `Час ${level} кончается громко; каждая опечатка уходит в открытый эфир.`,
        default: (level) => `Час ${level} пережит, но журнал получает ещё одну невозможную запись.`
      }
    }
  }
};

export const getGenrePack = (genre: StoryGenreId = 'cyberpunk'): GenrePack => GENRE_PACKS[genre] ?? GENRE_PACKS.cyberpunk;
