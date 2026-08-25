import { Language, StoryGenreId } from '../types';

type L = Record<Language, string>;

export type PerkGroupId =
  | 'neural_buffer'
  | 'ghost_protocol'
  | 'adrenaline_spike'
  | 'titanium_firewall'
  | 'critical_override'
  | 'focus_lattice'
  | 'error_siphon'
  | 'evidence_lens';

export type UpgradeId =
  | 'synapticWeave'
  | 'cryptoMiner'
  | 'signalDampener'
  | 'bufferExpansion'
  | 'focusLens'
  | 'patternScanner';

export interface GenreSkin {
  /** Hub / meta shop — presentation only; upgrade IDs & numbers stay shared. */
  market: {
    menuButton: L;
    title: L;
    subtitle: L;
    install: L;
    currency: L;
    availCredits: L;
  };
  meters: {
    heat: L;
    trust: L;
    evidence: L;
    route: L;
    security: L;
    health: L;
    focus: L;
    credits: L;
    score: L;
    wallet: L;
  };
  focus: {
    name: L;
    active: L;
    ready: L;
    charge: L;
    title: L;
    hint: L;
  };
  segments: {
    breachInit: L;
    dialogInit: L;
    signalInit: L;
    criticalOverride: L;
  };
  decisions: {
    aggressive: L;
    stealth: L;
    tactical: L;
  };
  routes: {
    balanced: L;
    silent: L;
    loud: L;
  };
  run: {
    loadoutTitle: L;
    loadoutSubtitle: L;
    selectUpgrade: L;
    seqComplete: L;
    generatingSector: L;
    generatingScenario: L;
    legendaryDrop: L;
    operationDossier: L;
    mistakesWarn: L;
    emptyLog: L;
    systemOnline: L;
    levelWord: L;
    criticalFailure: L;
  };
  endings: {
    ghost: L;
    loud: L;
    broken: L;
    survivor: L;
  };
  upgrades: Record<UpgradeId, { name: L; desc: L }>;
  perks: Record<PerkGroupId, { name: L; tiers: [L, L, L] }>;
}

const enRu = (en: string, ru: string): L => ({ en, ru });

const CYBERPUNK: GenreSkin = {
  market: {
    menuButton: enRu('[2] THE BLACK MARKET', '[2] ЧЕРНЫЙ РЫНОК'),
    title: enRu('THE BLACK MARKET', 'ЧЕРНЫЙ РЫНОК'),
    subtitle: enRu('Permanent hardware upgrades for future runs', 'Постоянные апгрейды оборудования для будущих забегов'),
    install: enRu('INSTALL', 'УСТАНОВИТЬ'),
    currency: enRu('CR', 'CR'),
    availCredits: enRu('Available Credits', 'Доступные Кредиты')
  },
  meters: {
    heat: enRu('Heat', 'Угроза'),
    trust: enRu('Trust', 'Доверие'),
    evidence: enRu('Evidence', 'Улики'),
    route: enRu('Route', 'Маршрут'),
    security: enRu('Security Trace', 'Трассировка'),
    health: enRu('Health', 'Здоровье'),
    focus: enRu('Focus', 'Фокус'),
    credits: enRu('Credits', 'Кредиты'),
    score: enRu('Score', 'Счет'),
    wallet: enRu('Wallet', 'Кошелек')
  },
  focus: {
    name: enRu('Focus Mode', 'Фокус-Мод'),
    active: enRu('FOCUS MODE ACTIVE', 'ФОКУС-МОД АКТИВЕН'),
    ready: enRu('TAB ⚡ FOCUS', 'TAB ⚡ ФОКУС'),
    charge: enRu('FOCUS', 'ФОКУС'),
    title: enRu('Type correctly to build Focus. Press TAB when full.', 'Печатай верно, чтобы зарядить Фокус. Нажми TAB при полном заряде.'),
    hint: enRu('TAB activates Focus Mode when charged: trace pauses, mistakes hurt less, rewards double.', 'TAB включает Фокус-Мод при полном заряде: след заморожен, ошибки мягче, награды удвоены.')
  },
  segments: {
    breachInit: enRu('>> BREACH_PROTOCOL_INITIATED // EXACT_INPUT_REQUIRED', '>> ПРОТОКОЛ_ВЗЛОМА // НУЖЕН ТОЧНЫЙ ВВОД'),
    dialogInit: enRu('DIALOGUE CHANNEL // PUNCTUATION MATTERS', 'КАНАЛ ДИАЛОГА // ВАЖНА ПУНКТУАЦИЯ'),
    signalInit: enRu('SIGNAL DECODE // NUMBERS AND SYMBOLS', 'ДЕКОД СИГНАЛА // ЧИСЛА И СИМВОЛЫ'),
    criticalOverride: enRu('CRITICAL OVERRIDE', 'КРИТИЧЕСКИЙ ВЗЛОМ')
  },
  decisions: {
    aggressive: enRu('AGGRESSIVE', 'АГРЕССИЯ'),
    stealth: enRu('STEALTH', 'СКРЫТНОСТЬ'),
    tactical: enRu('TACTICAL INTERVENTION REQUIRED', 'ТРЕБУЕТСЯ ТАКТИЧЕСКОЕ ВМЕШАТЕЛЬСТВО')
  },
  routes: {
    balanced: enRu('BALANCED', 'БАЛАНС'),
    silent: enRu('SILENT', 'ТИХО'),
    loud: enRu('LOUD', 'ГРОМКО')
  },
  run: {
    loadoutTitle: enRu('CONFIGURE LOADOUT', 'КОНФИГУРАЦИЯ'),
    loadoutSubtitle: enRu('Pick the subroutine that defines your first strategy.', 'Выбери подпрограмму, которая задаст первую стратегию.'),
    selectUpgrade: enRu('SELECT NEURAL UPGRADE', 'ВЫБОР НЕЙРО-АПГРЕЙДА'),
    seqComplete: enRu('SEQUENCE COMPLETE', 'СЕКВЕНЦИЯ ЗАВЕРШЕНА'),
    generatingSector: enRu('GENERATING NEW SECTOR...', 'ГЕНЕРАЦИЯ НОВОГО СЕКТОРА...'),
    generatingScenario: enRu('GENERATING SCENARIO...', 'ГЕНЕРАЦИЯ СЦЕНАРИЯ...'),
    legendaryDrop: enRu('⚠ LEGENDARY DROP DETECTED', '⚠ ОБНАРУЖЕН ЛЕГЕНДАРНЫЙ МОДУЛЬ'),
    operationDossier: enRu('OPERATION DOSSIER', 'ДОСЬЕ ОПЕРАЦИИ'),
    mistakesWarn: enRu('Every typo changes heat, trust, evidence, and the ending.', 'Каждая опечатка меняет угрозу, доверие, улики и финал.'),
    emptyLog: enRu('Mission log is empty.\nAwaiting system initialization...', 'Журнал миссии пуст.\nОжидание инициализации системы...'),
    systemOnline: enRu('SYSTEM ONLINE', 'СИСТЕМА В СЕТИ'),
    levelWord: enRu('Sector', 'Сектор'),
    criticalFailure: enRu('CRITICAL FAILURE', 'КРИТИЧЕСКИЙ СБОЙ')
  },
  endings: {
    ghost: enRu('Ghost Publication', 'Тихая публикация'),
    loud: enRu('Loud Leak', 'Громкий слив'),
    broken: enRu('Broken Link', 'Сломанная связь'),
    survivor: enRu('Surviving Witness', 'Выживший свидетель')
  },
  upgrades: {
    synapticWeave: {
      name: enRu('Synaptic Weave', 'Синаптическая Сеть'),
      desc: enRu('Increases Max Health permanently.', 'Постоянно увеличивает макс. здоровье.')
    },
    cryptoMiner: {
      name: enRu('Crypto Miner', 'Крипто-Майнер'),
      desc: enRu('Increases Credit earnings permanently.', 'Постоянно увеличивает заработок кредитов.')
    },
    signalDampener: {
      name: enRu('Signal Dampener', 'Глушитель Сигнала'),
      desc: enRu('Slows down Security Trace accumulation.', 'Замедляет накопление уровня угрозы.')
    },
    bufferExpansion: {
      name: enRu('Buffer Expansion', 'Расширение Буфера'),
      desc: enRu('Increases Focus charge capacity.', 'Увеличивает емкость заряда Фокуса.')
    },
    focusLens: {
      name: enRu('Focus Lens', 'Линза Фокуса'),
      desc: enRu('Extends Focus Mode and adds soft typo forgiveness.', 'Продлевает Фокус-Мод и добавляет мягкое прощение ошибок.')
    },
    patternScanner: {
      name: enRu('Pattern Scanner', 'Сканер Паттернов'),
      desc: enRu('Breach drills yield more credits and evidence.', 'Сегменты взлома дают больше кредитов и улик.')
    }
  },
  perks: {
    neural_buffer: {
      name: enRu('Neural Buffer', 'Нейро-Буфер'),
      tiers: [
        enRu('First mistake per round is ignored.', 'Первая ошибка в раунде игнорируется.'),
        enRu('First 2 mistakes per round are ignored.', 'Первые 2 ошибки в раунде игнорируются.'),
        enRu('First 3 mistakes per round are ignored.', 'Первые 3 ошибки в раунде игнорируются.')
      ]
    },
    ghost_protocol: {
      name: enRu('Ghost Protocol', 'Протокол Призрак'),
      tiers: [
        enRu('Security Trace grows 20% slower.', 'Трассировка угрозы растет на 20% медленнее.'),
        enRu('Security Trace grows 35% slower.', 'Трассировка угрозы растет на 35% медленнее.'),
        enRu('Security Trace grows 50% slower.', 'Трассировка угрозы растет на 50% медленнее.')
      ]
    },
    adrenaline_spike: {
      name: enRu('Adrenaline Spike', 'Выброс Адреналина'),
      tiers: [
        enRu('Typing >80 WPM regenerates +2 HP.', 'Скорость >80 СЛ/М восстанавливает +2 ОЗ.'),
        enRu('Typing >70 WPM regenerates +3 HP.', 'Скорость >70 СЛ/М восстанавливает +3 ОЗ.'),
        enRu('Typing >60 WPM regenerates +4 HP.', 'Скорость >60 СЛ/М восстанавливает +4 ОЗ.')
      ]
    },
    titanium_firewall: {
      name: enRu('Titanium Firewall', 'Титановый Файрвол'),
      tiers: [
        enRu('Max Health floor increased to 35.', 'Минимум макс. здоровья увеличен до 35.'),
        enRu('Max Health floor increased to 50.', 'Минимум макс. здоровья увеличен до 50.'),
        enRu('Max Health floor increased to 75.', 'Минимум макс. здоровья увеличен до 75.')
      ]
    },
    critical_override: {
      name: enRu('Critical Override', 'Критический Взлом'),
      tiers: [
        enRu('5% chance to auto-hack a segment instantly.', '5% шанс мгновенно взломать сегмент.'),
        enRu('12% chance to auto-hack a segment instantly.', '12% шанс мгновенно взломать сегмент.'),
        enRu('20% chance to auto-hack a segment instantly.', '20% шанс мгновенно взломать сегмент.')
      ]
    },
    focus_lattice: {
      name: enRu('Focus Lattice', 'Решетка Фокуса'),
      tiers: [
        enRu('Focus Mode lasts 1s longer and forgives +1 typo.', 'Фокус-Мод длится на 1с дольше и прощает +1 ошибку.'),
        enRu('Focus Mode lasts 2s longer and forgives +2 typos.', 'Фокус-Мод длится на 2с дольше и прощает +2 ошибки.'),
        enRu('Focus Mode lasts 3s longer and forgives +3 typos.', 'Фокус-Мод длится на 3с дольше и прощает +3 ошибки.')
      ]
    },
    error_siphon: {
      name: enRu('Error Siphon', 'Сифон Ошибок'),
      tiers: [
        enRu('Mistakes feed +2 Focus charge instead of only punishing you.', 'Ошибки дают +2 заряда Фокуса вместо чистого наказания.'),
        enRu('Mistakes feed +4 Focus charge.', 'Ошибки дают +4 заряда Фокуса.'),
        enRu('Mistakes feed +7 Focus charge.', 'Ошибки дают +7 заряда Фокуса.')
      ]
    },
    evidence_lens: {
      name: enRu('Evidence Lens', 'Линза Улик'),
      tiers: [
        enRu('Clean segments generate 15% more evidence.', 'Чистые сегменты дают на 15% больше улик.'),
        enRu('Clean segments generate 30% more evidence.', 'Чистые сегменты дают на 30% больше улик.'),
        enRu('Clean segments generate 50% more evidence.', 'Чистые сегменты дают на 50% больше улик.')
      ]
    }
  }
};

const SPACE_HORROR: GenreSkin = {
  market: {
    menuButton: enRu('[2] SALVAGE BAY', '[2] ОТСЕК УТИЛЯ'),
    title: enRu('SALVAGE BAY', 'ОТСЕК УТИЛЯ'),
    subtitle: enRu('Permanent suit and hull fittings that carry between extractions', 'Постоянные апгрейды скафандра и корпуса между вылазками'),
    install: enRu('FIT', 'УСТАНОВИТЬ'),
    currency: enRu('SV', 'SV'),
    availCredits: enRu('Available Salvage', 'Доступный Утиль')
  },
  meters: {
    heat: enRu('Contagion', 'Зараза'),
    trust: enRu('Crew Trust', 'Доверие экипажа'),
    evidence: enRu('Blackbox', 'Черный ящик'),
    route: enRu('Deck Route', 'Маршрут палуб'),
    security: enRu('Proximity Alarm', 'Сенсор приближения'),
    health: enRu('Suit Integrity', 'Целостность скафандра'),
    focus: enRu('Suit Lock', 'Блокировка скафандра'),
    credits: enRu('Salvage', 'Утиль'),
    score: enRu('Signal', 'Сигнал'),
    wallet: enRu('Hold', 'Трюм')
  },
  focus: {
    name: enRu('Suit Lock', 'Блокировка скафандра'),
    active: enRu('SUIT LOCK ENGAGED', 'БЛОКИРОВКА СКАФАНДРА'),
    ready: enRu('TAB ⚡ SUIT LOCK', 'TAB ⚡ БЛОКИРОВКА'),
    charge: enRu('SUIT LOCK', 'БЛОКИРОВКА'),
    title: enRu('Type cleanly to pressurize Suit Lock. Press TAB when full.', 'Печатай чисто, чтобы набрать давление Блокировки. Нажми TAB при полном заряде.'),
    hint: enRu('TAB engages Suit Lock when charged: proximity freezes, typos hurt less, rewards double.', 'TAB включает Блокировку при полном заряде: сенсор замирает, ошибки мягче, награды удвоены.')
  },
  segments: {
    breachInit: enRu('>> HULL_OVERRIDE // EXACT CODES REQUIRED', '>> ПЕРЕОПРЕДЕЛЕНИЕ КОРПУСА // НУЖНЫ ТОЧНЫЕ КОДЫ'),
    dialogInit: enRu('SUIT COMMS // PUNCTUATION KEEPS THE CHANNEL CLEAR', 'РАЦИЯ СКАФАНДРА // ПУНКТУАЦИЯ ДЕРЖИТ КАНАЛ ЧИСТЫМ'),
    signalInit: enRu('TELEMETRY STREAM // NUMBERS AND SYMBOLS', 'ПОТОК ТЕЛЕМЕТРИИ // ЧИСЛА И СИМВОЛЫ'),
    criticalOverride: enRu('EMERGENCY OVERRIDE', 'АВАРИЙНЫЙ ОБХОД')
  },
  decisions: {
    aggressive: enRu('FORCE OPEN', 'СИЛОЙ'),
    stealth: enRu('GHOST VENT', 'ТЕНЬ ВЕНТИЛЯЦИИ'),
    tactical: enRu('DECK BRANCH — CHOOSE A PATH', 'РАЗВИЛКА ПАЛУБЫ — ВЫБЕРИ ПУТЬ')
  },
  routes: {
    balanced: enRu('STANDARD', 'СТАНДАРТ'),
    silent: enRu('SOFTWALK', 'ТИХИЙ ХОД'),
    loud: enRu('HARD BURN', 'ЖЕСТКИЙ ПРОРЫВ')
  },
  run: {
    loadoutTitle: enRu('SUIT CONFIG', 'КОНФИГ СКАФАНДРА'),
    loadoutSubtitle: enRu('Pick the fitting that defines your first extraction plan.', 'Выбери модуль, который задаст первую стратегию извлечения.'),
    selectUpgrade: enRu('SELECT HULL FITTING', 'ВЫБОР МОДУЛЯ КОРПУСА'),
    seqComplete: enRu('DECK CLEARED', 'ПАЛУБА ЗАЧИЩЕНА'),
    generatingSector: enRu('PRESSURIZING NEXT DECK...', 'НАКАЧКА СЛЕДУЮЩЕЙ ПАЛУБЫ...'),
    generatingScenario: enRu('SYNCING BLACK RELAY...', 'СИНХРОНИЗАЦИЯ ЧЕРНОГО РЕТРАНСЛЯТОРА...'),
    legendaryDrop: enRu('⚠ ANOMALOUS SALVAGE DETECTED', '⚠ ОБНАРУЖЕН АНОМАЛЬНЫЙ УТИЛЬ'),
    operationDossier: enRu('EXTRACTION LOG', 'ЖУРНАЛ ИЗВЛЕЧЕНИЯ'),
    mistakesWarn: enRu('Every typo feeds contagion, erodes crew trust, stains the blackbox, and twists the ending.', 'Каждая опечатка кормит заразу, ест доверие экипажа, пачкает черный ящик и ломает финал.'),
    emptyLog: enRu('Extraction log is empty.\nWaiting for suit handshake...', 'Журнал извлечения пуст.\nОжидание рукопожатия скафандра...'),
    systemOnline: enRu('SUIT LINK ONLINE', 'СВЯЗЬ СКАФАНДРА В СЕТИ'),
    levelWord: enRu('Deck', 'Палуба'),
    criticalFailure: enRu('HULL FAILURE', 'РАЗГЕРМЕТИЗАЦИЯ')
  },
  endings: {
    ghost: enRu('Silent Extraction', 'Тихое извлечение'),
    loud: enRu('Screaming Burst', 'Кричащий всплеск'),
    broken: enRu('Lost in the Vents', 'Потерян в вентиляции'),
    survivor: enRu('Frostbitten Courier', 'Обмороженный курьер')
  },
  upgrades: {
    synapticWeave: {
      name: enRu('Sealant Mesh', 'Герметичная Сетка'),
      desc: enRu('Increases Suit Integrity permanently.', 'Постоянно увеличивает целостность скафандра.')
    },
    cryptoMiner: {
      name: enRu('Scrap Magnet', 'Магнит Лома'),
      desc: enRu('Increases Salvage earnings permanently.', 'Постоянно увеличивает сбор утиля.')
    },
    signalDampener: {
      name: enRu('Soft-Foot Pads', 'Мягкие Подошвы'),
      desc: enRu('Slows Proximity Alarm buildup.', 'Замедляет рост сенсора приближения.')
    },
    bufferExpansion: {
      name: enRu('Pressure Reserve', 'Запас Давления'),
      desc: enRu('Increases Suit Lock charge capacity.', 'Увеличивает емкость заряда Блокировки скафандра.')
    },
    focusLens: {
      name: enRu('Visor Latch', 'Замок Визора'),
      desc: enRu('Extends Suit Lock and softens typo pressure.', 'Продлевает Блокировку и смягчает давление опечаток.')
    },
    patternScanner: {
      name: enRu('Code Sniffer', 'Нюхач Кодов'),
      desc: enRu('Hull Override drills yield more salvage and blackbox data.', 'Сегменты переопределения корпуса дают больше утиля и данных черного ящика.')
    }
  },
  perks: {
    neural_buffer: {
      name: enRu('Foam Liner', 'Пенолайнер'),
      tiers: [
        enRu('First mistake per round is ignored.', 'Первая ошибка в раунде игнорируется.'),
        enRu('First 2 mistakes per round are ignored.', 'Первые 2 ошибки в раунде игнорируются.'),
        enRu('First 3 mistakes per round are ignored.', 'Первые 3 ошибки в раунде игнорируются.')
      ]
    },
    ghost_protocol: {
      name: enRu('Mute Boots', 'Немые Сапоги'),
      tiers: [
        enRu('Proximity Alarm grows 20% slower.', 'Сенсор приближения растет на 20% медленнее.'),
        enRu('Proximity Alarm grows 35% slower.', 'Сенсор приближения растет на 35% медленнее.'),
        enRu('Proximity Alarm grows 50% slower.', 'Сенсор приближения растет на 50% медленнее.')
      ]
    },
    adrenaline_spike: {
      name: enRu('O2 Spike', 'Всплеск O2'),
      tiers: [
        enRu('Typing >80 WPM regenerates +2 Suit Integrity.', 'Скорость >80 СЛ/М восстанавливает +2 целостности.'),
        enRu('Typing >70 WPM regenerates +3 Suit Integrity.', 'Скорость >70 СЛ/М восстанавливает +3 целостности.'),
        enRu('Typing >60 WPM regenerates +4 Suit Integrity.', 'Скорость >60 СЛ/М восстанавливает +4 целостности.')
      ]
    },
    titanium_firewall: {
      name: enRu('Hardened Plates', 'Усиленные Плиты'),
      tiers: [
        enRu('Max Suit Integrity floor increased to 35.', 'Минимум макс. целостности увеличен до 35.'),
        enRu('Max Suit Integrity floor increased to 50.', 'Минимум макс. целостности увеличен до 50.'),
        enRu('Max Suit Integrity floor increased to 75.', 'Минимум макс. целостности увеличен до 75.')
      ]
    },
    critical_override: {
      name: enRu('Panic Latch', 'Паническая Защелка'),
      tiers: [
        enRu('5% chance to auto-clear a segment instantly.', '5% шанс мгновенно закрыть сегмент.'),
        enRu('12% chance to auto-clear a segment instantly.', '12% шанс мгновенно закрыть сегмент.'),
        enRu('20% chance to auto-clear a segment instantly.', '20% шанс мгновенно закрыть сегмент.')
      ]
    },
    focus_lattice: {
      name: enRu('Lock Lattice', 'Решетка Блокировки'),
      tiers: [
        enRu('Suit Lock lasts 1s longer and forgives +1 typo.', 'Блокировка длится на 1с дольше и прощает +1 ошибку.'),
        enRu('Suit Lock lasts 2s longer and forgives +2 typos.', 'Блокировка длится на 2с дольше и прощает +2 ошибки.'),
        enRu('Suit Lock lasts 3s longer and forgives +3 typos.', 'Блокировка длится на 3с дольше и прощает +3 ошибки.')
      ]
    },
    error_siphon: {
      name: enRu('Fear Siphon', 'Сифон Страха'),
      tiers: [
        enRu('Mistakes feed +2 Suit Lock charge instead of only punishing you.', 'Ошибки дают +2 заряда Блокировки вместо чистого наказания.'),
        enRu('Mistakes feed +4 Suit Lock charge.', 'Ошибки дают +4 заряда Блокировки.'),
        enRu('Mistakes feed +7 Suit Lock charge.', 'Ошибки дают +7 заряда Блокировки.')
      ]
    },
    evidence_lens: {
      name: enRu('Blackbox Lens', 'Линза Черного Ящика'),
      tiers: [
        enRu('Clean segments generate 15% more blackbox data.', 'Чистые сегменты дают на 15% больше данных черного ящика.'),
        enRu('Clean segments generate 30% more blackbox data.', 'Чистые сегменты дают на 30% больше данных черного ящика.'),
        enRu('Clean segments generate 50% more blackbox data.', 'Чистые сегменты дают на 50% больше данных черного ящика.')
      ]
    }
  }
};

const NOIR: GenreSkin = {
  market: {
    menuButton: enRu('[2] THE PAWNBROKER', '[2] ЛОМБАРД'),
    title: enRu('THE PAWNBROKER', 'ЛОМБАРД'),
    subtitle: enRu('Permanent tools and favors that carry between cases', 'Постоянные инструменты и услуги между делами'),
    install: enRu('BUY', 'КУПИТЬ'),
    currency: enRu('$', '$'),
    availCredits: enRu('Available Cash', 'Доступная Наличность')
  },
  meters: {
    heat: enRu('Heat', 'Жар'),
    trust: enRu('Favor', 'Блат'),
    evidence: enRu('Ledger', 'Реестр'),
    route: enRu('Case Route', 'Линия дела'),
    security: enRu('Tail Pressure', 'Давление хвоста'),
    health: enRu('Grit', 'Живучесть'),
    focus: enRu('Cold Read', 'Холодное чтение'),
    credits: enRu('Cash', 'Наличность'),
    score: enRu('Case Score', 'Счет дела'),
    wallet: enRu('Pocket', 'Карман')
  },
  focus: {
    name: enRu('Cold Read', 'Холодное чтение'),
    active: enRu('COLD READ ACTIVE', 'ХОЛОДНОЕ ЧТЕНИЕ АКТИВНО'),
    ready: enRu('TAB ⚡ COLD READ', 'TAB ⚡ ХОЛОДНОЕ ЧТЕНИЕ'),
    charge: enRu('COLD READ', 'ХОЛОДНОЕ ЧТЕНИЕ'),
    title: enRu('Type cleanly to build Cold Read. Press TAB when full.', 'Печатай чисто, чтобы набрать Холодное чтение. Нажми TAB при полном заряде.'),
    hint: enRu('TAB activates Cold Read when charged: the tail freezes, typos hurt less, rewards double.', 'TAB включает Холодное чтение при полном заряде: хвост замирает, ошибки мягче, награды удвоены.')
  },
  segments: {
    breachInit: enRu('>> CASE PULL // EXACT FILE CODES REQUIRED', '>> ВЫЕМКА ДЕЛА // НУЖНЫ ТОЧНЫЕ КОДЫ'),
    dialogInit: enRu('INTERROGATION // PUNCTUATION LANDS THE BLOW', 'ДОПРОС // ПУНКТУАЦИЯ БЬЕТ ТОЧНО'),
    signalInit: enRu('STAKEOUT CLOCK // NUMBERS AND MARKS', 'ЧАСЫ СЛЕЖКИ // ЧИСЛА И МЕТКИ'),
    criticalOverride: enRu('LUCKY BREAK', 'СЧАСТЛИВЫЙ СЛУЧАЙ')
  },
  decisions: {
    aggressive: enRu('KICK THE DOOR', 'ВЫБИТЬ ДВЕРЬ'),
    stealth: enRu('BUY A FAVOR', 'КУПИТЬ УСЛУГУ'),
    tactical: enRu('TWO WAYS DOWN THE ALLEY', 'ДВА ПУТИ ПО ПЕРЕУЛКУ')
  },
  routes: {
    balanced: enRu('STRAIGHT', 'ПРЯМО'),
    silent: enRu('SOFT SHOE', 'МЯГКИЙ ШАГ'),
    loud: enRu('HARD KNOCK', 'ГРОМКИЙ УДАР')
  },
  run: {
    loadoutTitle: enRu('POCKET LOADOUT', 'НАБОР В КАРМАН'),
    loadoutSubtitle: enRu('Pick the tool that shapes your first night on the case.', 'Выбери инструмент, который задаст первую ночь дела.'),
    selectUpgrade: enRu('SELECT STREET TOOL', 'ВЫБОР УЛИЧНОГО ИНСТРУМЕНТА'),
    seqComplete: enRu('NIGHT CLOSED', 'НОЧЬ ЗАКРЫТА'),
    generatingSector: enRu('TURNING THE NEXT NIGHT...', 'ЛИСТАЕТСЯ СЛЕДУЮЩАЯ НОЧЬ...'),
    generatingScenario: enRu('SHUFFLING THE CASE FILE...', 'ПЕРЕМЕШИВАЕТСЯ ДЕЛО...'),
    legendaryDrop: enRu('⚠ RARE MARK DETECTED', '⚠ ОБНАРУЖЕНА РЕДКАЯ МЕТКА'),
    operationDossier: enRu('CASE NOTES', 'ЗАМЕТКИ ПО ДЕЛУ'),
    mistakesWarn: enRu('Every typo raises heat, burns favor, smudges the ledger, and twists the ending.', 'Каждая опечатка поднимает жар, жжет блат, пачкает реестр и ломает финал.'),
    emptyLog: enRu('Case notes are empty.\nWaiting for the first tip...', 'Заметки по делу пусты.\nЖдем первую наводку...'),
    systemOnline: enRu('STREET WIRE LIVE', 'УЛИЧНАЯ СВЯЗЬ ЖИВА'),
    levelWord: enRu('Night', 'Ночь'),
    criticalFailure: enRu('CASE COLD', 'ДЕЛО ОСТЫЛО')
  },
  endings: {
    ghost: enRu('Quiet Headline', 'Тихий заголовок'),
    loud: enRu('Front-Page Fire', 'Пожар на первой полосе'),
    broken: enRu('Bought Silence', 'Купленная тишина'),
    survivor: enRu('Rain-Soaked Witness', 'Свидетель под дождем')
  },
  upgrades: {
    synapticWeave: {
      name: enRu('Iron Liver', 'Железный Организм'),
      desc: enRu('Increases Max Grit permanently.', 'Постоянно увеличивает макс. живучесть.')
    },
    cryptoMiner: {
      name: enRu('Side Hustle', 'Левый Заработок'),
      desc: enRu('Increases Cash earnings permanently.', 'Постоянно увеличивает доход наличности.')
    },
    signalDampener: {
      name: enRu('Soft Hat', 'Мягкая Шляпа'),
      desc: enRu('Slows Tail Pressure buildup.', 'Замедляет рост давления хвоста.')
    },
    bufferExpansion: {
      name: enRu('Notebook Depth', 'Глубина Блокнота'),
      desc: enRu('Increases Cold Read charge capacity.', 'Увеличивает емкость заряда Холодного чтения.')
    },
    focusLens: {
      name: enRu('Reading Glasses', 'Очки Чтения'),
      desc: enRu('Extends Cold Read and softens typo sting.', 'Продлевает Холодное чтение и смягчает укус опечаток.')
    },
    patternScanner: {
      name: enRu('File Index', 'Картотека'),
      desc: enRu('Case-pull drills yield more cash and ledger pages.', 'Сегменты выемки дела дают больше наличности и страниц реестра.')
    }
  },
  perks: {
    neural_buffer: {
      name: enRu('Thick Skin', 'Толстая Кожа'),
      tiers: [
        enRu('First mistake per round is ignored.', 'Первая ошибка в раунде игнорируется.'),
        enRu('First 2 mistakes per round are ignored.', 'Первые 2 ошибки в раунде игнорируются.'),
        enRu('First 3 mistakes per round are ignored.', 'Первые 3 ошибки в раунде игнорируются.')
      ]
    },
    ghost_protocol: {
      name: enRu('Alley Ghost', 'Призрак Переулка'),
      tiers: [
        enRu('Tail Pressure grows 20% slower.', 'Давление хвоста растет на 20% медленнее.'),
        enRu('Tail Pressure grows 35% slower.', 'Давление хвоста растет на 35% медленнее.'),
        enRu('Tail Pressure grows 50% slower.', 'Давление хвоста растет на 50% медленнее.')
      ]
    },
    adrenaline_spike: {
      name: enRu('Black Coffee', 'Черный Кофе'),
      tiers: [
        enRu('Typing >80 WPM regenerates +2 Grit.', 'Скорость >80 СЛ/М восстанавливает +2 живучести.'),
        enRu('Typing >70 WPM regenerates +3 Grit.', 'Скорость >70 СЛ/М восстанавливает +3 живучести.'),
        enRu('Typing >60 WPM regenerates +4 Grit.', 'Скорость >60 СЛ/М восстанавливает +4 живучести.')
      ]
    },
    titanium_firewall: {
      name: enRu('Bullet Habit', 'Привычка к Пулям'),
      tiers: [
        enRu('Max Grit floor increased to 35.', 'Минимум макс. живучести увеличен до 35.'),
        enRu('Max Grit floor increased to 50.', 'Минимум макс. живучести увеличен до 50.'),
        enRu('Max Grit floor increased to 75.', 'Минимум макс. живучести увеличен до 75.')
      ]
    },
    critical_override: {
      name: enRu('Gut Instinct', 'Нутро'),
      tiers: [
        enRu('5% chance to auto-crack a segment instantly.', '5% шанс мгновенно закрыть сегмент.'),
        enRu('12% chance to auto-crack a segment instantly.', '12% шанс мгновенно закрыть сегмент.'),
        enRu('20% chance to auto-crack a segment instantly.', '20% шанс мгновенно закрыть сегмент.')
      ]
    },
    focus_lattice: {
      name: enRu('Cold Lattice', 'Решетка Холода'),
      tiers: [
        enRu('Cold Read lasts 1s longer and forgives +1 typo.', 'Холодное чтение длится на 1с дольше и прощает +1 ошибку.'),
        enRu('Cold Read lasts 2s longer and forgives +2 typos.', 'Холодное чтение длится на 2с дольше и прощает +2 ошибки.'),
        enRu('Cold Read lasts 3s longer and forgives +3 typos.', 'Холодное чтение длится на 3с дольше и прощает +3 ошибки.')
      ]
    },
    error_siphon: {
      name: enRu('Mistake Ledger', 'Реестр Ошибок'),
      tiers: [
        enRu('Mistakes feed +2 Cold Read charge instead of only punishing you.', 'Ошибки дают +2 заряда Холодного чтения вместо чистого наказания.'),
        enRu('Mistakes feed +4 Cold Read charge.', 'Ошибки дают +4 заряда Холодного чтения.'),
        enRu('Mistakes feed +7 Cold Read charge.', 'Ошибки дают +7 заряда Холодного чтения.')
      ]
    },
    evidence_lens: {
      name: enRu('Ink Loupe', 'Лупа Чернил'),
      tiers: [
        enRu('Clean segments generate 15% more ledger pages.', 'Чистые сегменты дают на 15% больше страниц реестра.'),
        enRu('Clean segments generate 30% more ledger pages.', 'Чистые сегменты дают на 30% больше страниц реестра.'),
        enRu('Clean segments generate 50% more ledger pages.', 'Чистые сегменты дают на 50% больше страниц реестра.')
      ]
    }
  }
};

const DARK_FABLE: GenreSkin = {
  market: {
    menuButton: enRu('[2] THE WITCH MARKET', '[2] ВЕДЬМИН РЫНОК'),
    title: enRu('THE WITCH MARKET', 'ВЕДЬМИН РЫНОК'),
    subtitle: enRu('Permanent charms and bindings that endure between chapters', 'Постоянные чары и узы между главами'),
    install: enRu('BIND', 'СВЯЗАТЬ'),
    currency: enRu('◆', '◆'),
    availCredits: enRu('Available Tithes', 'Доступная Дань')
  },
  meters: {
    heat: enRu('Curse', 'Проклятие'),
    trust: enRu('Wood Favor', 'Милость леса'),
    evidence: enRu('Names', 'Имена'),
    route: enRu('Path', 'Тропа'),
    security: enRu("Forest's Ear", 'Слух леса'),
    health: enRu('Vitality', 'Живость'),
    focus: enRu('True Name', 'Истинное имя'),
    credits: enRu('Tithes', 'Дань'),
    score: enRu('Tale Score', 'Счет сказки'),
    wallet: enRu('Satchel', 'Сумка')
  },
  focus: {
    name: enRu('True Name', 'Истинное имя'),
    active: enRu('TRUE NAME SPOKEN', 'ИСТИННОЕ ИМЯ ПРОИЗНЕСЕНО'),
    ready: enRu('TAB ⚡ TRUE NAME', 'TAB ⚡ ИСТИННОЕ ИМЯ'),
    charge: enRu('TRUE NAME', 'ИСТИННОЕ ИМЯ'),
    title: enRu('Type cleanly to gather True Name. Press TAB when full.', 'Печатай чисто, чтобы собрать Истинное имя. Нажми TAB при полном заряде.'),
    hint: enRu('TAB speaks True Name when charged: the forest freezes, typos hurt less, rewards double.', 'TAB произносит Истинное имя при полном заряде: лес замирает, ошибки мягче, награды удвоены.')
  },
  segments: {
    breachInit: enRu('>> RUNE BIND // EXACT SYMBOLS REQUIRED', '>> УЗЫ РУН // НУЖНЫ ТОЧНЫЕ СИМВОЛЫ'),
    dialogInit: enRu('WHISPER BARGAIN // PUNCTUATION SEALS THE DEAL', 'ШЕПОТ СДЕЛКИ // ПУНКТУАЦИЯ СКРЕПЛЯЕТ ДОГОВОР'),
    signalInit: enRu('CHAPTER MARKS // NUMBERS AND SIGILS', 'МЕТКИ ГЛАВ // ЧИСЛА И ЗНАКИ'),
    criticalOverride: enRu('FAIRY FAVOR', 'МИЛОСТЬ СКАЗКИ')
  },
  decisions: {
    aggressive: enRu('TEAR THE PAGE', 'ВЫРВАТЬ СТРАНИЦУ'),
    stealth: enRu('TRADE A NAME', 'ОТДАТЬ ИМЯ'),
    tactical: enRu('THE PATH FORKS UNDER THORN', 'ТРОПА РАЗДВАИВАЕТСЯ ПОД ШИПАМИ')
  },
  routes: {
    balanced: enRu('WALKING', 'ХОД'),
    silent: enRu('SOFT VERSE', 'ТИХИЙ СТИХ'),
    loud: enRu('BLOOD INK', 'КРОВАВЫЕ ЧЕРНИЛА')
  },
  run: {
    loadoutTitle: enRu('CHARM BINDING', 'СВЯЗЬ ЧАР'),
    loadoutSubtitle: enRu('Pick the charm that opens your first chapter.', 'Выбери чары, которые откроют первую главу.'),
    selectUpgrade: enRu('SELECT FOREST CHARM', 'ВЫБОР ЛЕСНЫХ ЧАР'),
    seqComplete: enRu('CHAPTER CLOSED', 'ГЛАВА ЗАКРЫТА'),
    generatingSector: enRu('TURNING THE NEXT CHAPTER...', 'ЛИСТАЕТСЯ СЛЕДУЮЩАЯ ГЛАВА...'),
    generatingScenario: enRu('THE BOOK IS BREATHING...', 'КНИГА ДЫШИТ...'),
    legendaryDrop: enRu('⚠ CURSED RELIC FOUND', '⚠ НАЙДЕНА ПРОКЛЯТАЯ РЕЛИКВИЯ'),
    operationDossier: enRu('TALE MARGINS', 'ПОЛЯ СКАЗКИ'),
    mistakesWarn: enRu('Every typo deepens the curse, spends wood favor, stains stolen names, and twists the ending.', 'Каждая опечатка углубляет проклятие, тратит милость леса, пачкает украденные имена и ломает финал.'),
    emptyLog: enRu('The margins are blank.\nWaiting for the first verse...', 'Поля пусты.\nЖдем первый стих...'),
    systemOnline: enRu('LANTERN LIT', 'ФОНАРЬ ГОРИТ'),
    levelWord: enRu('Chapter', 'Глава'),
    criticalFailure: enRu('BOOK CLOSED', 'КНИГА ЗАКРЫТА')
  },
  endings: {
    ghost: enRu('Soft Rewrite', 'Тихая перепись'),
    loud: enRu('Name in the Trees', 'Имя в деревьях'),
    broken: enRu('Page Kept Hostage', 'Страница в заложниках'),
    survivor: enRu('Ink-Stained Wanderer', 'Странник в чернилах')
  },
  upgrades: {
    synapticWeave: {
      name: enRu('Mossweave', 'Моховая Ткань'),
      desc: enRu('Increases Max Vitality permanently.', 'Постоянно увеличивает макс. живость.')
    },
    cryptoMiner: {
      name: enRu('Tithe Bowl', 'Чаша Дани'),
      desc: enRu('Increases Tithe earnings permanently.', 'Постоянно увеличивает сбор дани.')
    },
    signalDampener: {
      name: enRu('Quiet Bell', 'Тихий Колокольчик'),
      desc: enRu("Slows the Forest's Ear.", 'Замедляет Слух леса.')
    },
    bufferExpansion: {
      name: enRu('Name Well', 'Колодец Имен'),
      desc: enRu('Increases True Name charge capacity.', 'Увеличивает емкость заряда Истинного имени.')
    },
    focusLens: {
      name: enRu('Lantern Glass', 'Стекло Фонаря'),
      desc: enRu('Extends True Name and softens typo bite.', 'Продлевает Истинное имя и смягчает укус опечаток.')
    },
    patternScanner: {
      name: enRu('Rune Reader', 'Чтец Рун'),
      desc: enRu('Rune-bind drills yield more tithes and stolen names.', 'Сегменты рунных уз дают больше дани и украденных имен.')
    }
  },
  perks: {
    neural_buffer: {
      name: enRu('Soft Binding', 'Мягкий Переплет'),
      tiers: [
        enRu('First mistake per round is ignored.', 'Первая ошибка в раунде игнорируется.'),
        enRu('First 2 mistakes per round are ignored.', 'Первые 2 ошибки в раунде игнорируются.'),
        enRu('First 3 mistakes per round are ignored.', 'Первые 3 ошибки в раунде игнорируются.')
      ]
    },
    ghost_protocol: {
      name: enRu('Leaf Silence', 'Тишина Листьев'),
      tiers: [
        enRu("Forest's Ear grows 20% slower.", 'Слух леса растет на 20% медленнее.'),
        enRu("Forest's Ear grows 35% slower.", 'Слух леса растет на 35% медленнее.'),
        enRu("Forest's Ear grows 50% slower.", 'Слух леса растет на 50% медленнее.')
      ]
    },
    adrenaline_spike: {
      name: enRu('Blood Sap', 'Кровавый Сок'),
      tiers: [
        enRu('Typing >80 WPM regenerates +2 Vitality.', 'Скорость >80 СЛ/М восстанавливает +2 живости.'),
        enRu('Typing >70 WPM regenerates +3 Vitality.', 'Скорость >70 СЛ/М восстанавливает +3 живости.'),
        enRu('Typing >60 WPM regenerates +4 Vitality.', 'Скорость >60 СЛ/М восстанавливает +4 живости.')
      ]
    },
    titanium_firewall: {
      name: enRu('Thorn Mail', 'Шиповая Кольчуга'),
      tiers: [
        enRu('Max Vitality floor increased to 35.', 'Минимум макс. живости увеличен до 35.'),
        enRu('Max Vitality floor increased to 50.', 'Минимум макс. живости увеличен до 50.'),
        enRu('Max Vitality floor increased to 75.', 'Минимум макс. живости увеличен до 75.')
      ]
    },
    critical_override: {
      name: enRu("Story's Mercy", 'Милость Сюжета'),
      tiers: [
        enRu('5% chance to auto-resolve a segment instantly.', '5% шанс мгновенно закрыть сегмент.'),
        enRu('12% chance to auto-resolve a segment instantly.', '12% шанс мгновенно закрыть сегмент.'),
        enRu('20% chance to auto-resolve a segment instantly.', '20% шанс мгновенно закрыть сегмент.')
      ]
    },
    focus_lattice: {
      name: enRu('Name Lattice', 'Решетка Имени'),
      tiers: [
        enRu('True Name lasts 1s longer and forgives +1 typo.', 'Истинное имя длится на 1с дольше и прощает +1 ошибку.'),
        enRu('True Name lasts 2s longer and forgives +2 typos.', 'Истинное имя длится на 2с дольше и прощает +2 ошибки.'),
        enRu('True Name lasts 3s longer and forgives +3 typos.', 'Истинное имя длится на 3с дольше и прощает +3 ошибки.')
      ]
    },
    error_siphon: {
      name: enRu('Ink Siphon', 'Сифон Чернил'),
      tiers: [
        enRu('Mistakes feed +2 True Name charge instead of only punishing you.', 'Ошибки дают +2 заряда Истинного имени вместо чистого наказания.'),
        enRu('Mistakes feed +4 True Name charge.', 'Ошибки дают +4 заряда Истинного имени.'),
        enRu('Mistakes feed +7 True Name charge.', 'Ошибки дают +7 заряда Истинного имени.')
      ]
    },
    evidence_lens: {
      name: enRu('Name Glass', 'Стекло Имен'),
      tiers: [
        enRu('Clean segments generate 15% more stolen names.', 'Чистые сегменты дают на 15% больше украденных имен.'),
        enRu('Clean segments generate 30% more stolen names.', 'Чистые сегменты дают на 30% больше украденных имен.'),
        enRu('Clean segments generate 50% more stolen names.', 'Чистые сегменты дают на 50% больше украденных имен.')
      ]
    }
  }
};

export const GENRE_SKINS: Record<StoryGenreId, GenreSkin> = {
  cyberpunk: CYBERPUNK,
  space_horror: SPACE_HORROR,
  noir: NOIR,
  dark_fable: DARK_FABLE
};

export const getGenreSkin = (genre: StoryGenreId = 'cyberpunk'): GenreSkin =>
  GENRE_SKINS[genre] ?? GENRE_SKINS.cyberpunk;
