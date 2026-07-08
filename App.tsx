import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GameState, StorySegment, GameStats, StoryLogItem, UserProfile, Perk, GameModifiers, LevelReport, UserUpgrades, StoryMood, SegmentType, Language, MissionState, ComicFrame } from './types';
import { generateStoryStart, generateCharacterProfile, generateLevelSummary, generateNextLevelStart } from './services/geminiService';
import { audioEngine } from './services/audioEngine';
import TypingEngine from './components/TypingEngine';
import RunComic from './components/RunComic';

// --- TRANSLATIONS ---
const TRANSLATIONS = {
    en: {
        game_title: "NARRATIVE FLOW",
        subtitle: "Consequence-Driven RPG Typer",
        score: "SCORE",
        wallet: "WALLET",
        audio_active: "♫ AUDIO ACTIVE",
        audio_muted: "AUDIO MUTED",
        empty_log: "Mission log is empty.\nAwaiting system initialization...",
        speed: "SPEED",
        system_online: "SYSTEM ONLINE",
        main_title: "Operation Black Ledger",
        intro_desc: "Type to move, decide to bend the city, survive to publish the proof.",
        mistakes_warn: "Every typo changes heat, trust, evidence, and the ending.",
        init_link: "[1] INITIALIZE LINK",
        black_market: "[2] THE BLACK MARKET",
        powered_by: "Works with Gemini, but has a full local campaign fallback",
        market_title: "THE BLACK MARKET",
        market_subtitle: "Permanent hardware upgrades for future runs",
        avail_credits: "Available Credits",
        install: "INSTALL",
        maxed_out: "MAXED OUT",
        return_menu: "[ESC] Return to Menu",
        loadout_title: "CONFIGURE LOADOUT",
        loadout_subtitle: "Pick the subroutine that defines your first strategy.",
        seq_complete: "SEQUENCE COMPLETE",
        xp_gained: "XP Gained",
        avg_speed: "AVG Speed",
        credits: "Credits",
        heat: "Heat",
        health: "Health",
        trust: "Trust",
        evidence: "Evidence",
        corruption: "Corruption",
        route: "Route",
        select_upgrade: "SELECT NEURAL UPGRADE",
        generating_sector: "GENERATING NEW SECTOR...",
        generating_scenario: "GENERATING SCENARIO...",
        critical_failure: "CRITICAL FAILURE",
        connection_severed: "Your link was severed before the Ledger went live.",
        reached: "Reached",
        main_menu: "[SPACE] MAIN MENU",
        legendary_drop: "⚠ LEGENDARY DROP DETECTED",
        level: "Level",
        wpm: "WPM",
        operation_dossier: "OPERATION DOSSIER",
        campaign_goal: "Goal: survive four sectors and publish enough evidence.",
        focus_hint: "TAB activates Focus Mode when charged: trace pauses, mistakes hurt less, rewards double.",
        victory_title: "LEDGER PUBLISHED",
        victory_subtitle: "You won the run. The ending reflects your typing and choices.",
        final_ending: "Ending",
        new_run: "[SPACE] NEW RUN",
        focus: "Focus",
        effect: "Effect",
        type_cue: "TYPE",
        type_subcue: "BEGIN INPUT",
        share_comic: "SHARE YOUR COMIC",
        comic_building: "ASSEMBLING REPLAY...",
        comic_error: "Could not build the comic.",
        comic_share: "SHARE",
        comic_download: "DOWNLOAD",
        comic_copied: "COPIED",
        comic_close: "Close",
        comic_replay: "Mission Replay",
        comic_watermark: "NARRATIVE FLOW · your run, generated live"
    },
    ru: {
        game_title: "НАРРАТИВНЫЙ ПОТОК",
        subtitle: "RPG-тайпер с последствиями",
        score: "СЧЕТ",
        wallet: "КОШЕЛЕК",
        audio_active: "♫ ЗВУК ВКЛ",
        audio_muted: "ЗВУК ВЫКЛ",
        empty_log: "Журнал миссии пуст.\nОжидание инициализации системы...",
        speed: "СКОРОСТЬ",
        system_online: "СИСТЕМА В СЕТИ",
        main_title: "Операция Черный Реестр",
        intro_desc: "Печатай, чтобы двигаться; выбирай, чтобы менять город; выживи, чтобы опубликовать улики.",
        mistakes_warn: "Каждая опечатка меняет угрозу, доверие, улики и финал.",
        init_link: "[1] ИНИЦИАЛИЗАЦИЯ",
        black_market: "[2] ЧЕРНЫЙ РЫНОК",
        powered_by: "Работает с Gemini, но имеет полноценную локальную кампанию",
        market_title: "ЧЕРНЫЙ РЫНОК",
        market_subtitle: "Постоянные апгрейды оборудования для будущих забегов",
        avail_credits: "Доступные Кредиты",
        install: "УСТАНОВИТЬ",
        maxed_out: "МАКСИМУМ",
        return_menu: "[ESC] В Меню",
        loadout_title: "КОНФИГУРАЦИЯ",
        loadout_subtitle: "Выбери подпрограмму, которая задаст первую стратегию.",
        seq_complete: "СЕКВЕНЦИЯ ЗАВЕРШЕНА",
        xp_gained: "Получено XP",
        avg_speed: "Ср. Скор.",
        credits: "Кредиты",
        heat: "Угроза",
        health: "Здоровье",
        trust: "Доверие",
        evidence: "Улики",
        corruption: "Коррупция",
        route: "Маршрут",
        select_upgrade: "ВЫБОР НЕЙРО-АПГРЕЙДА",
        generating_sector: "ГЕНЕРАЦИЯ НОВОГО СЕКТОРА...",
        generating_scenario: "ГЕНЕРАЦИЯ СЦЕНАРИЯ...",
        critical_failure: "КРИТИЧЕСКИЙ СБОЙ",
        connection_severed: "Связь оборвалась до публикации Реестра.",
        reached: "Достигнут",
        main_menu: "[SPACE] ГЛАВНОЕ МЕНЮ",
        legendary_drop: "⚠ ОБНАРУЖЕН ЛЕГЕНДАРНЫЙ МОДУЛЬ",
        level: "Уровень",
        wpm: "СЛ/М",
        operation_dossier: "ДОСЬЕ ОПЕРАЦИИ",
        campaign_goal: "Цель: пережить четыре сектора и опубликовать достаточно улик.",
        focus_hint: "TAB включает Фокус-Мод при полном заряде: след заморожен, ошибки мягче, награды удвоены.",
        victory_title: "РЕЕСТР ОПУБЛИКОВАН",
        victory_subtitle: "Ты выиграл забег. Финал зависит от печати и решений.",
        final_ending: "Финал",
        new_run: "[SPACE] НОВЫЙ ЗАБЕГ",
        focus: "Фокус",
        effect: "Эффект",
        type_cue: "TYPE",
        type_subcue: "НАЧИНАЙ ВВОД",
        share_comic: "ПОДЕЛИТЬСЯ КОМИКСОМ",
        comic_building: "СБОРКА ПОВТОРА...",
        comic_error: "Не удалось собрать комикс.",
        comic_share: "ПОДЕЛИТЬСЯ",
        comic_download: "СКАЧАТЬ",
        comic_copied: "СКОПИРОВАНО",
        comic_close: "Закрыть",
        comic_replay: "Повтор миссии",
        comic_watermark: "NARRATIVE FLOW · твой забег, сгенерирован вживую"
    }
};

// --- TIERED PERK DEFINITIONS (Bilingual) ---
const PERK_DEFINITIONS = [
    {
        groupId: 'neural_buffer',
        baseName: { en: 'Neural Buffer', ru: 'Нейро-Буфер' },
        type: 'defense',
        tiers: [
            { desc: { en: 'First mistake per round is ignored.', ru: 'Первая ошибка в раунде игнорируется.' }, grace: 1 },
            { desc: { en: 'First 2 mistakes per round are ignored.', ru: 'Первые 2 ошибки в раунде игнорируются.' }, grace: 2 },
            { desc: { en: 'First 3 mistakes per round are ignored.', ru: 'Первые 3 ошибки в раунде игнорируются.' }, grace: 3 }
        ]
    },
    {
        groupId: 'ghost_protocol',
        baseName: { en: 'Ghost Protocol', ru: 'Протокол Призрак' },
        type: 'stealth',
        tiers: [
            { desc: { en: 'Security Trace grows 20% slower.', ru: 'Трассировка угрозы растет на 20% медленнее.' }, mult: 0.8 },
            { desc: { en: 'Security Trace grows 35% slower.', ru: 'Трассировка угрозы растет на 35% медленнее.' }, mult: 0.65 },
            { desc: { en: 'Security Trace grows 50% slower.', ru: 'Трассировка угрозы растет на 50% медленнее.' }, mult: 0.5 }
        ]
    },
    {
        groupId: 'adrenaline_spike',
        baseName: { en: 'Adrenaline Spike', ru: 'Выброс Адреналина' },
        type: 'offense',
        tiers: [
            { desc: { en: 'Typing >80 WPM regenerates +2 HP.', ru: 'Скорость >80 СЛ/М восстанавливает +2 ОЗ.' }, thresh: 80, regen: 2 },
            { desc: { en: 'Typing >70 WPM regenerates +3 HP.', ru: 'Скорость >70 СЛ/М восстанавливает +3 ОЗ.' }, thresh: 70, regen: 3 },
            { desc: { en: 'Typing >60 WPM regenerates +4 HP.', ru: 'Скорость >60 СЛ/М восстанавливает +4 ОЗ.' }, thresh: 60, regen: 4 }
        ]
    },
    {
        groupId: 'titanium_firewall',
        baseName: { en: 'Titanium Firewall', ru: 'Титановый Файрвол' },
        type: 'defense',
        tiers: [
            { desc: { en: 'Max Health floor increased to 35.', ru: 'Минимум макс. здоровья увеличен до 35.' }, maxHp: 35 },
            { desc: { en: 'Max Health floor increased to 50.', ru: 'Минимум макс. здоровья увеличен до 50.' }, maxHp: 50 },
            { desc: { en: 'Max Health floor increased to 75.', ru: 'Минимум макс. здоровья увеличен до 75.' }, maxHp: 75 }
        ]
    },
    {
        groupId: 'critical_override',
        baseName: { en: 'Critical Override', ru: 'Критический Взлом' },
        type: 'utility',
        tiers: [
            { desc: { en: '5% chance to auto-hack a segment instantly.', ru: '5% шанс мгновенно взломать сегмент.' }, chance: 0.05 },
            { desc: { en: '12% chance to auto-hack a segment instantly.', ru: '12% шанс мгновенно взломать сегмент.' }, chance: 0.12 },
            { desc: { en: '20% chance to auto-hack a segment instantly.', ru: '20% шанс мгновенно взломать сегмент.' }, chance: 0.20 }
        ]
    },
    {
        groupId: 'focus_lattice',
        baseName: { en: 'Focus Lattice', ru: 'Решетка Фокуса' },
        type: 'utility',
        tiers: [
            { desc: { en: 'Focus Mode lasts 1s longer and forgives +1 typo.', ru: 'Фокус-Мод длится на 1с дольше и прощает +1 ошибку.' }, duration: 1000, forgiveness: 1 },
            { desc: { en: 'Focus Mode lasts 2s longer and forgives +2 typos.', ru: 'Фокус-Мод длится на 2с дольше и прощает +2 ошибки.' }, duration: 2000, forgiveness: 2 },
            { desc: { en: 'Focus Mode lasts 3s longer and forgives +3 typos.', ru: 'Фокус-Мод длится на 3с дольше и прощает +3 ошибки.' }, duration: 3000, forgiveness: 3 }
        ]
    },
    {
        groupId: 'error_siphon',
        baseName: { en: 'Error Siphon', ru: 'Сифон Ошибок' },
        type: 'offense',
        tiers: [
            { desc: { en: 'Mistakes feed +2 Focus charge instead of only punishing you.', ru: 'Ошибки дают +2 заряда Фокуса вместо чистого наказания.' }, charge: 2 },
            { desc: { en: 'Mistakes feed +4 Focus charge.', ru: 'Ошибки дают +4 заряда Фокуса.' }, charge: 4 },
            { desc: { en: 'Mistakes feed +7 Focus charge.', ru: 'Ошибки дают +7 заряда Фокуса.' }, charge: 7 }
        ]
    },
    {
        groupId: 'evidence_lens',
        baseName: { en: 'Evidence Lens', ru: 'Линза Улик' },
        type: 'stealth',
        tiers: [
            { desc: { en: 'Clean segments generate 15% more evidence.', ru: 'Чистые сегменты дают на 15% больше улик.' }, evidence: 0.15 },
            { desc: { en: 'Clean segments generate 30% more evidence.', ru: 'Чистые сегменты дают на 30% больше улик.' }, evidence: 0.30 },
            { desc: { en: 'Clean segments generate 50% more evidence.', ru: 'Чистые сегменты дают на 50% больше улик.' }, evidence: 0.50 }
        ]
    }
];

const DEFAULT_MODIFIERS: GameModifiers = {
    traceSpeedMultiplier: 1.0,
    mistakeGraceCount: 0,
    healthRegenWpmThreshold: 0,
    criticalHackChance: 0,
    maxHealth: 20,
    maxOverclock: 50,
    creditMultiplier: 1.0,
    focusDurationMs: 6500,
    focusMistakeForgiveness: 2,
    errorChargeGain: 0,
    breachRewardMultiplier: 1,
    evidenceMultiplier: 1
};

const DEFAULT_MISSION_STATE: MissionState = {
    heat: 18,
    trust: 44,
    evidence: 0,
    corruption: 0,
    signal: 55,
    route: 'balanced',
    flags: [],
    consequenceLog: []
};

const DEFAULT_PROFILE: UserProfile = {
    totalXp: 0,
    stealthLevel: 0,
    unlockedPerks: [],
    credits: 0,
    upgrades: {
        synapticWeave: 0,
        cryptoMiner: 0,
        signalDampener: 0,
        bufferExpansion: 0,
        focusLens: 0,
        patternScanner: 0
    },
    language: 'en'
};

const META_UPGRADES = {
    synapticWeave: {
        name: { en: "Synaptic Weave", ru: "Синаптическая Сеть" },
        desc: { en: "Increases Max Health permanently.", ru: "Постоянно увеличивает макс. здоровье." },
        baseCost: 100,
        effectPerLevel: 2,
        maxLevel: 10
    },
    cryptoMiner: {
        name: { en: "Crypto Miner", ru: "Крипто-Майнер" },
        desc: { en: "Increases Credit earnings permanently.", ru: "Постоянно увеличивает заработок кредитов." },
        baseCost: 150,
        effectPerLevel: 0.1,
        maxLevel: 10
    },
    signalDampener: {
        name: { en: "Signal Dampener", ru: "Глушитель Сигнала" },
        desc: { en: "Slows down Security Trace accumulation.", ru: "Замедляет накопление уровня угрозы." },
        baseCost: 200,
        effectPerLevel: 0.05,
        maxLevel: 10
    },
    bufferExpansion: {
        name: { en: "Buffer Expansion", ru: "Расширение Буфера" },
        desc: { en: "Increases Focus charge capacity.", ru: "Увеличивает емкость заряда Фокуса." },
        baseCost: 120,
        effectPerLevel: 5,
        maxLevel: 10
    },
    focusLens: {
        name: { en: "Focus Lens", ru: "Линза Фокуса" },
        desc: { en: "Extends Focus Mode and adds soft typo forgiveness.", ru: "Продлевает Фокус-Мод и добавляет мягкое прощение ошибок." },
        baseCost: 180,
        effectPerLevel: 500,
        maxLevel: 8
    },
    patternScanner: {
        name: { en: "Pattern Scanner", ru: "Сканер Паттернов" },
        desc: { en: "Breach drills yield more credits and evidence.", ru: "Сегменты взлома дают больше кредитов и улик." },
        baseCost: 220,
        effectPerLevel: 0.08,
        maxLevel: 8
    }
};

const CAMPAIGN_FINAL_LEVEL = 4;

interface RoundData {
    wpm: number;
    mistakes: number;
    score: number;
}

// Live "signal monitor" that replaces the cliché status pill: the label continuously
// scrambles through glyphs and re-decodes, next to a scrolling oscilloscope, a pulsing
// REC dot, a drifting ping readout and a scanline sweep — a hacker rig that feels alive.
const BEACON_SCRAMBLE = "ABCDEF0123456789#%&/\\<>[]{}=+*!?";

const SystemBeacon: React.FC<{ label: string }> = ({ label }) => {
    const [text, setText] = useState(label);
    const [ping, setPing] = useState(4);

    useEffect(() => {
        let frame = 0;
        const id = window.setInterval(() => {
            frame++;
            const period = label.length + 26; // decode, then hold, then re-scramble
            const t = frame % period;
            const revealed = Math.max(0, Math.min(label.length, t - 4));
            let out = "";
            for (let i = 0; i < label.length; i++) {
                const ch = label[i];
                if (ch === " ") { out += " "; continue; }
                out += i < revealed ? ch : BEACON_SCRAMBLE[Math.floor(Math.random() * BEACON_SCRAMBLE.length)];
            }
            setText(out);
        }, 55);
        return () => window.clearInterval(id);
    }, [label]);

    useEffect(() => {
        const id = window.setInterval(() => setPing(2 + Math.floor(Math.random() * 8)), 700);
        return () => window.clearInterval(id);
    }, []);

    const wave = useMemo(() => {
        const pts: string[] = [];
        const mid = 12;
        for (let x = 0; x <= 240; x += 3) {
            const base = Math.sin((x * 2 * Math.PI) / 40) * 2.4;
            const fine = Math.sin((x * 2 * Math.PI) / 8) * 1.0;
            let spike = 0;
            const m = x % 40;
            if (m < 3) spike = -7.5; else if (m >= 20 && m < 23) spike = 7.5;
            pts.push(`${x},${(mid + base + fine + spike).toFixed(1)}`);
        }
        return "M" + pts.join(" L");
    }, []);

    const cut = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';

    return (
        <div className="relative inline-flex items-center gap-3 px-4 py-2 overflow-hidden" style={{ clipPath: cut }}>
            {/* emerald frame + dark face */}
            <div className="absolute inset-0 z-0" style={{ clipPath: cut, background: 'linear-gradient(180deg, rgba(52,211,153,0.55), rgba(52,211,153,0.12))' }} />
            <div className="absolute inset-[1.5px] z-0 bg-[#060c12]" style={{ clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)' }} />
            {/* scanline sweep */}
            <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
                <div className="beacon-scan h-2.5 w-full bg-gradient-to-b from-transparent via-emerald-400/25 to-transparent" />
            </div>

            {/* REC dot */}
            <span className="relative z-20 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>

            {/* decoding label */}
            <span className="relative z-20 beacon-flicker font-mono text-[11px] font-bold tracking-[0.22em] text-emerald-300 whitespace-nowrap" style={{ textShadow: '0 0 8px rgba(52,211,153,0.45)' }}>
                {text}
            </span>

            {/* oscilloscope */}
            <div className="relative z-20 h-4 w-16 overflow-hidden">
                <svg className="absolute inset-0 h-full scope-scroll" style={{ width: '200%' }} viewBox="0 0 240 24" preserveAspectRatio="none">
                    <path d={wave} fill="none" stroke="#34d399" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
            </div>

            {/* drifting ping */}
            <span className="relative z-20 font-mono text-[9px] tracking-[0.15em] text-emerald-500/70 tabular-nums whitespace-nowrap">
                {ping}ms
            </span>
        </div>
    );
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [storyLog, setStoryLog] = useState<StoryLogItem[]>([]);
  const [initialSegment, setInitialSegment] = useState<StorySegment | null>(null);
  const [characterDesc, setCharacterDesc] = useState<string>("");
  const [finalStats, setFinalStats] = useState<GameStats | null>(null);
  const [victoryReport, setVictoryReport] = useState<LevelReport | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentHealth, setCurrentHealth] = useState(20);
  const [musicActive, setMusicActive] = useState(false);
  const [language, setLanguage] = useState<Language>('en'); // Global Language State
  
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [activePerks, setActivePerks] = useState<Perk[]>([]);
  const [currentModifiers, setCurrentModifiers] = useState<GameModifiers>(DEFAULT_MODIFIERS);
  const [offeredPerks, setOfferedPerks] = useState<Perk[]>([]);
  
  const [levelBuffer, setLevelBuffer] = useState<RoundData[]>([]); 
  const [lastLevelReport, setLastLevelReport] = useState<LevelReport | null>(null);
  const [levelXpGained, setLevelXpGained] = useState(0);
  const [narrativeContext, setNarrativeContext] = useState<string>("");
  const [campaignState, setCampaignState] = useState<MissionState>(DEFAULT_MISSION_STATE);
  const [comicFrames, setComicFrames] = useState<ComicFrame[]>([]);
  const [showComic, setShowComic] = useState(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  // Shortcut for current language translations
  const UI = TRANSLATIONS[language];

  useEffect(() => {
    const saved = localStorage.getItem('narrativeFlowProfile');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            setUserProfile({ 
                ...DEFAULT_PROFILE, 
                ...parsed, 
                upgrades: { ...DEFAULT_PROFILE.upgrades, ...parsed.upgrades }
            });
            if (parsed.language) setLanguage(parsed.language);
        } catch (e) { console.error("Profile load fail", e); }
    }
  }, []);

  useEffect(() => {
    const profileToSave = { ...userProfile, language };
    localStorage.setItem('narrativeFlowProfile', JSON.stringify(profileToSave));
  }, [userProfile, language]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [storyLog]);

  useEffect(() => {
      let mods = { ...DEFAULT_MODIFIERS };
      const u = userProfile.upgrades;
      mods.maxHealth += (u.synapticWeave * META_UPGRADES.synapticWeave.effectPerLevel);
      mods.creditMultiplier += (u.cryptoMiner * META_UPGRADES.cryptoMiner.effectPerLevel);
      mods.traceSpeedMultiplier -= (u.signalDampener * META_UPGRADES.signalDampener.effectPerLevel);
      mods.maxOverclock += (u.bufferExpansion * META_UPGRADES.bufferExpansion.effectPerLevel);
      mods.focusDurationMs += (u.focusLens * META_UPGRADES.focusLens.effectPerLevel);
      mods.focusMistakeForgiveness += Math.floor(u.focusLens / 2);
      mods.breachRewardMultiplier += (u.patternScanner * META_UPGRADES.patternScanner.effectPerLevel);
      mods.evidenceMultiplier += (u.patternScanner * META_UPGRADES.patternScanner.effectPerLevel);
      mods.traceSpeedMultiplier = Math.max(0.1, mods.traceSpeedMultiplier);
      activePerks.forEach(perk => {
          mods = perk.apply(mods);
      });
      setCurrentModifiers(mods);
  }, [activePerks, userProfile.upgrades]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (gameState === GameState.STARTER_PERK_SELECTION || gameState === GameState.LEVEL_COMPLETE) {
            const index = parseInt(e.key) - 1;
            if (index >= 0 && index < offeredPerks.length) {
                if (gameState === GameState.STARTER_PERK_SELECTION) {
                    handleStarterPerkSelect(offeredPerks[index]);
                } else {
                    handleSelectPerk(offeredPerks[index]);
                }
            }
        } else if (gameState === GameState.MENU) {
            if (e.key === '1' || e.key === 'Enter') initializeSession();
            if (e.key === '2') setGameState(GameState.BLACK_MARKET);
        } else if (gameState === GameState.GAME_OVER || gameState === GameState.VICTORY) {
            if (e.key === 'Enter' || e.key === ' ') setGameState(GameState.MENU);
        } else if (gameState === GameState.BLACK_MARKET) {
            if (e.key === 'Escape') setGameState(GameState.MENU);
            
            const index = parseInt(e.key) - 1;
            const upgradeKeys = Object.keys(META_UPGRADES) as (keyof UserUpgrades)[];
            if (index >= 0 && index < upgradeKeys.length) {
                handleBuyUpgrade(upgradeKeys[index]);
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, offeredPerks, userProfile]);

  const handleToggleMusic = () => {
      const active = audioEngine.toggle();
      setMusicActive(active);
  };

  const handleToggleLanguage = () => {
      setLanguage(prev => prev === 'en' ? 'ru' : 'en');
  };

  const generatePerkObject = (def: any, tierIndex: number): Perk => {
      const tierData = def.tiers[tierIndex];
      return {
          id: `${def.groupId}_${tierIndex + 1}`,
          groupId: def.groupId,
          name: `${def.baseName[language]} ${['I','II','III'][tierIndex]}`, // Localized Name
          description: tierData.desc[language], // Localized Desc
          type: def.type as any,
          rarity: tierIndex === 0 ? 'common' : tierIndex === 1 ? 'rare' : 'legendary',
          tier: tierIndex + 1,
          maxTier: def.tiers.length,
          apply: (mods) => {
              const newMods = { ...mods };
              if (def.groupId === 'neural_buffer') newMods.mistakeGraceCount = Math.max(newMods.mistakeGraceCount, tierData.grace);
              if (def.groupId === 'ghost_protocol') newMods.traceSpeedMultiplier *= tierData.mult;
              if (def.groupId === 'adrenaline_spike') newMods.healthRegenWpmThreshold = tierData.thresh;
              if (def.groupId === 'titanium_firewall') newMods.maxHealth = Math.max(newMods.maxHealth, tierData.maxHp);
              if (def.groupId === 'critical_override') newMods.criticalHackChance = tierData.chance;
              if (def.groupId === 'focus_lattice') { newMods.focusDurationMs += tierData.duration; newMods.focusMistakeForgiveness += tierData.forgiveness; }
              if (def.groupId === 'error_siphon') newMods.errorChargeGain = Math.max(newMods.errorChargeGain, tierData.charge);
              if (def.groupId === 'evidence_lens') newMods.evidenceMultiplier += tierData.evidence;
              return newMods;
          }
      };
  };

  const getRarityRoll = (performance: 'bad' | 'average' | 'good' | 'legendary'): number => {
      const rand = Math.random();
      if (performance === 'legendary') {
          if (rand < 0.20) return 2;
          if (rand < 0.60) return 1;
          return 0;
      }
      if (performance === 'good') {
          if (rand < 0.05) return 2;
          if (rand < 0.30) return 1;
          return 0;
      }
      if (performance === 'average') {
          if (rand < 0.01) return 2;
          if (rand < 0.10) return 1;
          return 0;
      }
      return 0;
  };

  const getUpgradeOptions = (performance: 'bad' | 'average' | 'good' | 'legendary') => {
      const options: Perk[] = [];
      const usedGroupIds = new Set<string>();
      const upgradeCandidates: Perk[] = [];
      activePerks.forEach(p => {
          const def = PERK_DEFINITIONS.find(d => d.groupId === p.groupId);
          if (def && p.tier < p.maxTier) {
              upgradeCandidates.push(generatePerkObject(def, p.tier)); 
              usedGroupIds.add(p.groupId);
          } else {
              usedGroupIds.add(p.groupId); 
          }
      });

      const pickedUpgrades = upgradeCandidates.sort(() => 0.5 - Math.random()).slice(0, 2);
      options.push(...pickedUpgrades);

      const availableNewDefinitions = PERK_DEFINITIONS.filter(d => !usedGroupIds.has(d.groupId));
      const shuffledDefinitions = [...availableNewDefinitions].sort(() => 0.5 - Math.random());
      const slotsNeeded = 3 - options.length;
      
      for (let i = 0; i < slotsNeeded; i++) {
          if (shuffledDefinitions[i]) {
              const def = shuffledDefinitions[i];
              const rolledTierIndex = getRarityRoll(performance);
              const finalTierIndex = Math.min(rolledTierIndex, def.tiers.length - 1);
              options.push(generatePerkObject(def, finalTierIndex));
          }
      }
      return options.sort(() => 0.5 - Math.random());
  };

  const initializeSession = () => {
      setStoryLog([]);
      setTotalScore(0);
      setFinalStats(null);
      setVictoryReport(null);
      setComicFrames([]);
      setShowComic(false);
      setCampaignState(DEFAULT_MISSION_STATE);
      setNarrativeContext("");
      setCharacterDesc("");
      setActivePerks([]); 
      setLevelBuffer([]);
      setCurrentLevel(1);
      const starters = PERK_DEFINITIONS
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
          .map(d => generatePerkObject(d, 0));
      setOfferedPerks(starters);
      setGameState(GameState.STARTER_PERK_SELECTION);
      if (!musicActive) handleToggleMusic();
  };

  const handleStarterPerkSelect = (perk: Perk) => {
      setActivePerks([perk]);
      beginStoryGeneration();
  };

  const beginStoryGeneration = async () => {
    setGameState(GameState.LOADING);
    const [start, charProfile] = await Promise.all([
        generateStoryStart(language),
        generateCharacterProfile(language)
    ]);
    setInitialSegment(start);
    setCharacterDesc(charProfile);
    setGameState(GameState.PLAYING);
  };

  const getEndingTitle = (report: LevelReport): string => {
      const mission = report.mission || campaignState;
      if (mission.evidence >= 55 && mission.heat < 55 && mission.trust >= 45) {
          return language === 'ru' ? 'Тихая публикация' : 'Ghost Publication';
      }
      if (mission.evidence >= 55 && mission.route === 'loud') {
          return language === 'ru' ? 'Громкий слив' : 'Loud Leak';
      }
      if (mission.corruption >= 45 || mission.trust < 18) {
          return language === 'ru' ? 'Сломанная связь' : 'Broken Link';
      }
      return language === 'ru' ? 'Выживший свидетель' : 'Surviving Witness';
  };

  const handleLevelComplete = async (finalRoundStats: GameStats, finalTrace: number, finalMission?: MissionState) => {
      const allRounds = levelBuffer;
      const avgWpm = allRounds.length > 0 ? allRounds.reduce((sum, r) => sum + r.wpm, 0) / allRounds.length : finalRoundStats.wpm;
      const totalMistakes = allRounds.reduce((sum, r) => sum + r.mistakes, 0); 
      const levelScore = allRounds.reduce((sum, r) => sum + r.score, 0);
      const xp = Math.floor(levelScore * (1 + (finalRoundStats.level * 0.1)));
      setLevelXpGained(xp);
      const creditsEarned = finalRoundStats.credits || 0;
      const mission = finalMission || finalRoundStats.mission || campaignState;
      setCampaignState(mission);
      setUserProfile(prev => ({ 
          ...prev, 
          totalXp: prev.totalXp + xp,
          credits: Math.floor((prev.credits || 0) + creditsEarned)
      }));
      setCurrentHealth(finalRoundStats.health);
      let performanceRating: 'bad' | 'average' | 'good' | 'legendary' = 'average';
      if (finalTrace >= 90 || finalRoundStats.health <= 5 || mission.corruption > 55) performanceRating = 'bad';
      else if (avgWpm > 75 && totalMistakes < 3 && mission.heat < 45) performanceRating = 'legendary';
      else if (avgWpm > 55 && totalMistakes < 8) performanceRating = 'good';

      const report: LevelReport = {
          level: finalRoundStats.level,
          avgWpm,
          totalMistakes,
          finalHealth: finalRoundStats.health,
          traceLevel: finalTrace,
          narrativeSummary: language === 'ru' ? "Анализ данных миссии..." : "Analyzing mission data...",
          creditsEarned,
          mission,
          route: mission.route
      };

      const isFinal = finalRoundStats.level >= CAMPAIGN_FINAL_LEVEL;
      setLastLevelReport(report);
      if (isFinal) {
          setVictoryReport({ ...report, endingTitle: getEndingTitle(report) });
          setGameState(GameState.VICTORY);
      } else {
          setGameState(GameState.LEVEL_COMPLETE);
      }

      const summary = await generateLevelSummary(finalRoundStats.level, report, storyLog.map(l => l.text).join(" "), language);
      const completedReport = { ...report, narrativeSummary: summary, endingTitle: getEndingTitle({ ...report, narrativeSummary: summary }) };
      setNarrativeContext(summary);
      addToLog(`[${UI.level.toUpperCase()} ${finalRoundStats.level} ${UI.seq_complete}]: ${summary}`, 'neutral', 0, 0, 0, `${UI.evidence}: ${mission.evidence} · ${UI.heat}: ${mission.heat}%`);

      if (isFinal) {
          setVictoryReport(completedReport);
      } else {
          setLastLevelReport(completedReport);
          setOfferedPerks(getUpgradeOptions(performanceRating));
      }
  };

  const handleSelectPerk = async (perk: Perk) => {
      setActivePerks(prev => {
          const others = prev.filter(p => p.groupId !== perk.groupId);
          return [...others, perk];
      });
      setGameState(GameState.LOADING);
      const nextLvl = currentLevel + 1;
      setCurrentLevel(nextLvl);
      setLevelBuffer([]);
      try {
          const nextStartSegment = await generateNextLevelStart(nextLvl, narrativeContext, language, campaignState);
          setInitialSegment(nextStartSegment);
          setGameState(GameState.PLAYING);
      } catch (e) {
          setInitialSegment({ 
              text: language === 'ru' ? "Связь разорвана. Вы в новом секторе." : "The connection resets. You are in a new sector.", 
              mood: StoryMood.TENSE, 
              type: SegmentType.NARRATIVE,
              skill: 'flow',
              objective: language === 'ru' ? 'Восстановить связь' : 'Recover connection'
          });
          setGameState(GameState.PLAYING);
      }
  };

  const handleGameOver = (stats: GameStats) => {
    const finalScore = totalScore;
    const bonusXp = Math.floor(finalScore * (1 + (stats.level * 0.1))); 
    setFinalStats({ ...stats, score: finalScore });
    if (stats.mission) setCampaignState(stats.mission);
    setUserProfile(prev => ({ 
        ...prev, 
        totalXp: prev.totalXp + bonusXp,
        credits: Math.floor((prev.credits || 0) + (stats.credits || 0))
    }));
    setGameState(GameState.GAME_OVER);
  };

  const handleBuyUpgrade = (key: keyof UserUpgrades) => {
      const upgrade = META_UPGRADES[key];
      const currentLvl = userProfile.upgrades[key];
      if (currentLvl >= upgrade.maxLevel) return;
      const cost = Math.floor(upgrade.baseCost * (1 + (currentLvl * 0.5)));
      if (userProfile.credits >= cost) {
          setUserProfile(prev => ({
              ...prev,
              credits: prev.credits - cost,
              upgrades: { ...prev.upgrades, [key]: currentLvl + 1 }
          }));
      }
  };

  const addToLog = (text: string, performance: 'good' | 'average' | 'bad' | 'neutral', score: number, wpm: number, mistakes: number, meta?: string, type?: SegmentType) => {
    setTotalScore(prev => prev + score);
    setStoryLog(prev => [...prev, { text, performance, score, wpm, meta, type }]);
    if (performance !== 'neutral') {
        setLevelBuffer(prev => [...prev, { wpm, mistakes, score }]); 
    }
  };

  const captureComicFrame = (frame: ComicFrame) => {
    setComicFrames(prev => [...prev, frame]);
  };

  const buildComicData = () => {
    const isVictory = gameState === GameState.VICTORY;
    const mission = (isVictory ? victoryReport?.mission : finalStats?.mission) || campaignState;
    if (isVictory && victoryReport) {
      return {
        outcome: 'victory' as const,
        endingTitle: victoryReport.endingTitle || UI.victory_title,
        tagline: victoryReport.narrativeSummary,
        shareText: language === 'ru'
          ? `Мой забег в Narrative Flow: «${victoryReport.endingTitle || UI.victory_title}»`
          : `My Narrative Flow run: “${victoryReport.endingTitle || UI.victory_title}”`,
        stats: [
          { label: UI.wpm, value: String(Math.round(victoryReport.avgWpm)) },
          { label: UI.evidence, value: String(mission.evidence) },
          { label: UI.heat, value: `${Math.round(mission.heat)}%` },
          { label: UI.score, value: String(totalScore) }
        ]
      };
    }
    return {
      outcome: 'defeat' as const,
      endingTitle: UI.critical_failure,
      tagline: UI.connection_severed,
      shareText: language === 'ru'
        ? `Мой забег в Narrative Flow оборвался на уровне ${finalStats?.level || 1}.`
        : `My Narrative Flow run was severed on level ${finalStats?.level || 1}.`,
      stats: [
        { label: UI.level, value: String(finalStats?.level || 1) },
        { label: UI.evidence, value: String(mission.evidence) },
        { label: UI.heat, value: `${Math.round(mission.heat)}%` },
        { label: UI.score, value: String(finalStats?.score || 0) }
      ]
    };
  };

  const describeUpgradeEffect = (key: keyof UserUpgrades, level: number): string => {
      switch (key) {
          case 'synapticWeave': return `+${level * META_UPGRADES.synapticWeave.effectPerLevel} HP`;
          case 'cryptoMiner': return `+${Math.round(level * META_UPGRADES.cryptoMiner.effectPerLevel * 100)}% CR`;
          case 'signalDampener': return `-${Math.round(level * META_UPGRADES.signalDampener.effectPerLevel * 100)}% ${UI.heat}`;
          case 'bufferExpansion': return `+${level * META_UPGRADES.bufferExpansion.effectPerLevel} ${UI.focus}`;
          case 'focusLens': return `+${(level * META_UPGRADES.focusLens.effectPerLevel) / 1000}s ${UI.focus}`;
          case 'patternScanner': return `+${Math.round(level * META_UPGRADES.patternScanner.effectPerLevel * 100)}% ${UI.evidence}`;
          default: return '';
      }
  };


  const renderPerkCard = (perk: Perk, index: number, isStarter: boolean) => {
      const isLegendary = perk.rarity === 'legendary';
      const isRare = perk.rarity === 'rare';
      let borderClass = 'border-slate-700';
      let bgClass = 'bg-slate-800';
      let textClass = 'text-slate-400';
      let glowClass = '';
      let titleColor = 'text-white';
      let rarityColor = 'text-slate-500 border-slate-600';

      if (isLegendary) {
          borderClass = 'border-yellow-500';
          bgClass = 'bg-yellow-900/20';
          textClass = 'text-yellow-100';
          glowClass = 'shadow-[0_0_30px_rgba(234,179,8,0.2)] hover:shadow-[0_0_40px_rgba(234,179,8,0.4)]';
          titleColor = 'text-yellow-400';
          rarityColor = 'text-yellow-400 border-yellow-500 bg-yellow-900/50';
      } else if (isRare) {
          borderClass = 'border-purple-500';
          bgClass = 'bg-purple-900/20';
          textClass = 'text-purple-100';
          glowClass = 'shadow-[0_0_20px_rgba(168,85,247,0.2)] hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]';
          titleColor = 'text-purple-400';
          rarityColor = 'text-purple-400 border-purple-500 bg-purple-900/50';
      } else {
           glowClass = 'hover:border-cyan-400 hover:bg-slate-800/90 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]';
      }

      return (
        <button
            key={perk.id}
            onClick={() => isStarter ? handleStarterPerkSelect(perk) : handleSelectPerk(perk)}
            className={`group relative ${bgClass} border ${borderClass} p-6 rounded-lg ${glowClass} transition-all text-left flex flex-col h-full`}
        >
            <div className="absolute top-2 left-2 text-slate-500 font-mono text-xs opacity-50 group-hover:opacity-100">[{index + 1}]</div>
            <div className="flex justify-between items-start mb-2 mt-4">
                 <div className={`text-[10px] uppercase border px-2 py-0.5 rounded font-bold tracking-wider ${rarityColor}`}>
                    {perk.rarity}
                 </div>
                 <div className="flex gap-1">
                     <div className={`w-1.5 h-1.5 rounded-full ${perk.tier >= 1 ? (isLegendary ? 'bg-yellow-500' : isRare ? 'bg-purple-500' : 'bg-cyan-500') : 'bg-slate-700'}`}></div>
                     <div className={`w-1.5 h-1.5 rounded-full ${perk.tier >= 2 ? (isLegendary ? 'bg-yellow-500' : isRare ? 'bg-purple-500' : 'bg-cyan-500') : 'bg-slate-700'}`}></div>
                     <div className={`w-1.5 h-1.5 rounded-full ${perk.tier >= 3 ? (isLegendary ? 'bg-yellow-500' : isRare ? 'bg-purple-500' : 'bg-cyan-500') : 'bg-slate-700'}`}></div>
                 </div>
            </div>
            <div className="mb-4">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center text-lg mb-2 ${
                    perk.type === 'defense' ? 'bg-blue-500/20 text-blue-400' :
                    perk.type === 'stealth' ? 'bg-purple-500/20 text-purple-400' :
                    perk.type === 'utility' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                }`}>
                    {perk.type === 'defense' ? '🛡️' : perk.type === 'stealth' ? '👻' : perk.type === 'utility' ? '🔋' : '⚡'}
                </div>
                <h4 className={`text-xl font-bold ${titleColor} transition-colors`}>{perk.name}</h4>
            </div>
            <p className={`text-sm ${textClass} leading-relaxed flex-1`}>
                {perk.description}
            </p>
            {isLegendary && (
                <div className="mt-4 text-xs text-yellow-500 font-bold uppercase tracking-widest animate-pulse">
                    {UI.legendary_drop}
                </div>
            )}
        </button>
      );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col md:flex-row font-mono overflow-hidden">
      
      {/* Sidebar — operator console */}
      <aside className="relative w-full md:w-1/3 lg:w-1/4 flex flex-col h-[30vh] md:h-screen bg-gradient-to-b from-[#0b101a] to-[#070a11] border-r border-white/[0.06]">
        <div className="tex-grid absolute inset-0 opacity-40 pointer-events-none"></div>
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent pointer-events-none"></div>

        {/* Header + status */}
        <div className="relative z-10 px-5 pt-5 pb-4 space-y-4">
          {/* Wordmark */}
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 flex items-center justify-center rounded-md bg-emerald-400/10 border border-emerald-400/25 shadow-[0_0_22px_rgba(52,211,153,0.18)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-emerald-400">
                <path d="M2 13h4l2.5-7 4 15 2.5-8H22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-[15px] font-bold tracking-[0.12em] text-white leading-none truncate">{UI.game_title}</h1>
              <p className="mt-1.5 text-[9px] uppercase tracking-[0.22em] text-slate-500 truncate">{UI.subtitle}</p>
            </div>
          </div>

          {/* Status panel */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[9px] uppercase tracking-[0.22em] text-slate-500">{UI.wallet}</div>
                <div className="font-display mt-1 text-2xl font-bold tabular-nums text-white leading-none">
                  {Math.floor(userProfile.credits || 0)}<span className="text-sm text-emerald-400 ml-1 align-baseline">CR</span>
                </div>
              </div>
              {gameState === GameState.PLAYING && (
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-[0.22em] text-slate-500">{UI.score}</div>
                  <div className="font-display mt-1 text-lg font-bold tabular-nums text-emerald-400 leading-none">{totalScore}</div>
                </div>
              )}
            </div>

            <div className="h-px bg-white/[0.06]"></div>

            <div className="space-y-2.5">
              {[
                { key: 'heat', label: UI.heat, val: campaignState.heat, color: '#fbbf24', suffix: '%' },
                { key: 'trust', label: UI.trust, val: campaignState.trust, color: '#38bdf8', suffix: '' },
                { key: 'evidence', label: UI.evidence, val: campaignState.evidence, color: '#34d399', suffix: '' },
                { key: 'corruption', label: UI.corruption, val: campaignState.corruption, color: '#a78bfa', suffix: '' }
              ].map(m => (
                <div key={m.key} className="flex items-center gap-3">
                  <span className="w-[68px] shrink-0 text-[9px] uppercase tracking-[0.16em] text-slate-500">{m.label}</span>
                  <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, Math.max(0, m.val))}%`, backgroundColor: m.color, boxShadow: `0 0 8px ${m.color}55` }}
                    ></div>
                  </div>
                  <span className="w-9 text-right text-[11px] tabular-nums text-slate-300">{Math.round(m.val)}{m.suffix}</span>
                </div>
              ))}
            </div>
          </div>

          {activePerks.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activePerks.map((p, i) => (
                <span key={i} title={p.description} className={`text-[10px] px-2 py-0.5 rounded-full border cursor-help tracking-wide ${
                  p.tier === 3 ? 'border-amber-400/40 text-amber-300 bg-amber-400/10' :
                  p.tier === 2 ? 'border-violet-400/40 text-violet-300 bg-violet-400/10' :
                  'border-white/10 text-slate-300 bg-white/[0.03]'
                }`}>
                  {p.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Mission log */}
        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 pb-4">
          <div className="text-[9px] uppercase tracking-[0.22em] text-slate-600 mb-3 sticky top-0 bg-gradient-to-b from-[#0b101a] to-transparent pb-1">{language === 'ru' ? 'Журнал миссии' : 'Mission Log'}</div>
          {storyLog.length === 0 ? (
            <div className="text-slate-600 text-xs italic text-center mt-8 whitespace-pre-wrap">{UI.empty_log}</div>
          ) : (
            <div className="relative space-y-5 pl-1">
              <div className="absolute left-[11px] top-1 bottom-1 w-px bg-white/[0.07]"></div>
              {storyLog.map((log, idx) => (
                <div key={idx} className="relative flex items-start gap-3 animate-fade-in-up">
                  {log.performance !== 'neutral' ? (
                    <div className={`relative flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold tabular-nums z-10 bg-[#0b101a] ring-1 ${
                      log.performance === 'good' ? 'ring-emerald-500/60 text-emerald-400' :
                      log.performance === 'average' ? 'ring-amber-500/60 text-amber-400' :
                      'ring-rose-500/60 text-rose-400'
                    }`}>
                      {log.score}
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-6 h-6 rounded-full ring-1 ring-white/10 bg-[#0b101a] z-10 flex items-center justify-center">
                      <span className="block w-1.5 h-1.5 bg-emerald-400/70 rounded-full"></span>
                    </div>
                  )}
                  <div className={`text-[13px] leading-relaxed py-0.5 ${
                    log.performance === 'neutral' ? 'text-emerald-300/70 italic' :
                    log.performance === 'bad' ? 'text-rose-200/90' : 'text-slate-300'
                  }`}>
                    {log.text}
                    {log.wpm > 0 && (
                      <span className="block text-[10px] text-slate-600 mt-1 tracking-wide">{UI.speed}: <span className="tabular-nums">{log.wpm}</span> {UI.wpm}</span>
                    )}
                    {log.meta && (
                      <span className="block text-[10px] text-emerald-500/60 mt-1">{log.meta}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={logEndRef} />
        </div>

        {/* Footer controls */}
        <div className="relative z-10 px-5 py-3 border-t border-white/[0.06] flex items-center gap-2">
          <button
            onClick={handleToggleMusic}
            className={`flex-1 h-8 text-[10px] font-bold uppercase tracking-[0.16em] rounded-lg border transition-all flex items-center justify-center gap-2 ${musicActive ? 'border-emerald-400/40 text-emerald-300 bg-emerald-400/10' : 'border-white/10 text-slate-500 bg-white/[0.02] hover:text-slate-300'}`}
          >
            <span>{musicActive ? UI.audio_active : UI.audio_muted}</span>
            {musicActive && (
              <div className="flex items-end gap-0.5 h-3">
                <div className="w-0.5 bg-emerald-400 animate-[pulse_0.4s_infinite]"></div>
                <div className="w-0.5 bg-emerald-400 animate-[pulse_0.6s_infinite]"></div>
                <div className="w-0.5 bg-emerald-400 animate-[pulse_0.3s_infinite]"></div>
              </div>
            )}
          </button>
          <button
            onClick={handleToggleLanguage}
            className="h-8 px-3 text-[10px] font-bold rounded-lg border border-white/10 bg-white/[0.02] text-slate-400 hover:text-white transition-colors"
          >
            {language === 'en' ? 'RU' : 'EN'}
          </button>
        </div>
      </aside>

      <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col relative md:h-screen overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none"
             style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center p-6 relative z-10">
            {gameState === GameState.MENU && (
                <div className="text-center space-y-7 max-w-md animate-fade-in-up">
                    <div className="space-y-5">
                        <SystemBeacon label={UI.system_online} />
                        <h2 className="font-display text-5xl font-bold text-white tracking-tight leading-[1.05]">{UI.main_title}</h2>
                        <p className="text-slate-400 text-base leading-relaxed">
                            {UI.intro_desc}<br/>
                            <span className="text-amber-400/90">{UI.mistakes_warn}</span>
                        </p>
                        <div className="text-xs text-slate-400 rounded-xl border border-white/[0.06] bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-4 text-left space-y-2">
                            <div className="flex gap-2.5"><span className="text-emerald-400/70 mt-px">◆</span><span>{UI.campaign_goal}</span></div>
                            <div className="flex gap-2.5"><span className="text-emerald-400/70 mt-px">◆</span><span>{UI.focus_hint}</span></div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3.5">
                        <button
                            onClick={initializeSession}
                            className="btn-cyber btn-cyber-primary px-8 py-4 font-display font-bold tracking-[0.06em] text-[#04120b]"
                        >
                            {UI.init_link}
                        </button>
                        <button
                            onClick={() => setGameState(GameState.BLACK_MARKET)}
                            className="btn-cyber btn-cyber-ghost px-8 py-3.5 font-display font-bold tracking-[0.06em] text-emerald-200 hover:text-white transition-colors"
                        >
                            {UI.black_market}
                        </button>
                    </div>
                    <div className="text-[11px] text-slate-600 pt-6">
                        {UI.powered_by}
                    </div>
                </div>
            )}

            {gameState === GameState.BLACK_MARKET && (
                <div className="w-full max-w-5xl h-[80vh] bg-slate-950 border border-purple-500/30 rounded-xl flex flex-col overflow-hidden animate-fade-in-up shadow-[0_0_50px_rgba(88,28,135,0.2)]">
                    <div className="p-6 border-b border-purple-900/50 bg-slate-900/50 flex justify-between items-center">
                        <div>
                            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">{UI.market_title}</h2>
                            <p className="text-purple-300/60 text-sm">{UI.market_subtitle}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-500 uppercase">{UI.avail_credits}</div>
                            <div className="text-2xl font-bold text-yellow-400">{Math.floor(userProfile.credits)} CR</div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(Object.entries(META_UPGRADES) as [keyof UserUpgrades, typeof META_UPGRADES.synapticWeave][]).map(([key, def], idx) => {
                            const currentLvl = userProfile.upgrades[key];
                            const nextCost = Math.floor(def.baseCost * (1 + (currentLvl * 0.5)));
                            const isMaxed = currentLvl >= def.maxLevel;
                            const canAfford = userProfile.credits >= nextCost;
                            return (
                                <div key={key} className="bg-slate-900/50 border border-slate-800 p-6 rounded-lg relative overflow-hidden group hover:border-purple-500/50 transition-colors">
                                    <div className="absolute top-2 right-2 text-[10px] text-slate-600 font-mono">[{idx + 1}]</div>
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-xl font-bold text-slate-200">{def.name[language]}</h3>
                                        <div className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-purple-400 border border-purple-500/30">
                                            Lvl {currentLvl}/{def.maxLevel}
                                        </div>
                                    </div>
                                    <p className="text-slate-400 text-sm mb-6 h-10">{def.desc[language]}</p>
                                    <div className="flex items-center justify-between mt-auto">
                                        <div className="text-xs text-slate-500">
                                            {UI.effect}: <span className="text-emerald-400">{describeUpgradeEffect(key, currentLvl)}</span>
                                        </div>
                                        {isMaxed ? (
                                            <button disabled className="px-4 py-2 bg-slate-800 text-slate-500 font-bold rounded cursor-not-allowed border border-slate-700">
                                                {UI.maxed_out}
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleBuyUpgrade(key)}
                                                disabled={!canAfford}
                                                className={`px-4 py-2 font-bold rounded flex items-center gap-2 transition-all ${canAfford ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                                            >
                                                <span>{UI.install}</span>
                                                <span className={canAfford ? 'text-yellow-300' : ''}>{nextCost} CR</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="absolute bottom-0 left-0 h-1 bg-purple-500/20 w-full">
                                        <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${(currentLvl / def.maxLevel) * 100}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-center">
                        <button 
                            onClick={() => setGameState(GameState.MENU)}
                            className="px-6 py-2 text-slate-400 hover:text-white transition-colors uppercase tracking-widest text-sm font-bold"
                        >
                            {UI.return_menu}
                        </button>
                    </div>
                </div>
            )}

            {gameState === GameState.STARTER_PERK_SELECTION && (
                 <div className="w-full max-w-4xl bg-slate-900/95 border border-cyan-500/30 rounded-xl p-8 backdrop-blur-xl shadow-2xl animate-fade-in-up">
                    <div className="border-b border-slate-700 pb-4 mb-6 text-center">
                        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">{UI.loadout_title}</h2>
                        <p className="text-slate-400 text-sm">{UI.loadout_subtitle}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {offeredPerks.map((perk, index) => renderPerkCard(perk, index, true))}
                    </div>
                 </div>
            )}

            {gameState === GameState.LEVEL_COMPLETE && lastLevelReport && (
                <div className="w-full max-w-3xl bg-slate-900/95 border border-cyan-500/30 rounded-xl p-8 backdrop-blur-xl shadow-2xl animate-fade-in-up">
                    <div className="border-b border-slate-700 pb-4 mb-6">
                        <div className="flex justify-between items-start mb-2">
                            <h2 className="text-3xl font-bold text-white">{UI.seq_complete}</h2>
                            <div className="text-right">
                                <span className="text-xs text-slate-500 uppercase block">{UI.xp_gained}</span>
                                <span className="text-xl font-bold text-purple-400">+{levelXpGained} XP</span>
                            </div>
                        </div>
                        <p className="text-cyan-400 text-lg font-mono italic">
                            "{lastLevelReport.narrativeSummary}"
                        </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
                        <div className="bg-slate-800 p-4 rounded text-center">
                            <div className="text-xs text-slate-500 uppercase">{UI.avg_speed}</div>
                            <div className="text-2xl font-bold text-white">{Math.round(lastLevelReport.avgWpm)} <span className="text-xs text-slate-500">{UI.wpm}</span></div>
                        </div>
                        <div className="bg-slate-800 p-4 rounded text-center">
                             <div className="text-xs text-slate-500 uppercase">{UI.credits}</div>
                             <div className="text-2xl font-bold text-yellow-400">+{lastLevelReport.creditsEarned}</div>
                        </div>
                        <div className="bg-slate-800 p-4 rounded text-center">
                             <div className="text-xs text-slate-500 uppercase">{UI.heat}</div>
                             <div className="text-2xl font-bold text-red-300">{Math.floor(lastLevelReport.traceLevel)}%</div>
                        </div>
                        <div className="bg-slate-800 p-4 rounded text-center">
                             <div className="text-xs text-slate-500 uppercase">{UI.health}</div>
                             <div className="text-2xl font-bold text-emerald-400">{lastLevelReport.finalHealth}</div>
                        </div>
                        <div className="bg-slate-800 p-4 rounded text-center">
                             <div className="text-xs text-slate-500 uppercase">{UI.evidence}</div>
                             <div className="text-2xl font-bold text-emerald-300">{lastLevelReport.mission?.evidence ?? campaignState.evidence}</div>
                        </div>
                        <div className="bg-slate-800 p-4 rounded text-center">
                             <div className="text-xs text-slate-500 uppercase">{UI.trust}</div>
                             <div className="text-2xl font-bold text-cyan-300">{lastLevelReport.mission?.trust ?? campaignState.trust}</div>
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <span className="w-2 h-8 bg-purple-500 rounded-sm"></span>
                        {UI.select_upgrade}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {offeredPerks.map((perk, index) => renderPerkCard(perk, index, false))}
                    </div>
                </div>
            )}

            {gameState === GameState.LOADING && (
                <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                    <p className="text-emerald-400 animate-pulse tracking-widest text-sm">
                        {currentLevel > 1 ? UI.generating_sector : UI.generating_scenario}
                    </p>
                </div>
            )}

            {gameState === GameState.PLAYING && initialSegment && (
                <TypingEngine 
                    key={currentLevel}
                    initialSegment={initialSegment}
                    currentLevel={currentLevel}
                    modifiers={currentModifiers}
                    onGameOver={handleGameOver}
                    addToLog={addToLog}
                    fullHistory={storyLog.map(l => l.text)}
                    characterDescription={characterDesc}
                    stealthLevel={userProfile.stealthLevel}
                    onLevelComplete={handleLevelComplete}
                    prevLevelSummary={narrativeContext}
                    currentRoundHealth={currentLevel === 1 ? currentModifiers.maxHealth : currentHealth}
                    language={language}
                    missionSeed={campaignState}
                    onMissionUpdate={setCampaignState}
                    onCaptureFrame={captureComicFrame}
                />
            )}

            {gameState === GameState.VICTORY && victoryReport && (
                <div className="w-full max-w-3xl bg-slate-900/90 p-10 rounded-2xl border border-emerald-500/40 backdrop-blur-xl shadow-[0_0_60px_rgba(16,185,129,0.18)] animate-fade-in-up">
                    <div className="text-center border-b border-slate-700 pb-6 mb-6">
                        <div className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-full text-xs tracking-widest mb-4">
                            {UI.victory_title}
                        </div>
                        <h2 className="text-4xl font-bold text-white mb-3">{victoryReport.endingTitle}</h2>
                        <p className="text-slate-300 text-lg italic">"{victoryReport.narrativeSummary}"</p>
                        <p className="text-slate-500 text-sm mt-3">{UI.victory_subtitle}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-slate-800/70 p-4 rounded text-center border border-slate-700"><div className="text-xs text-slate-500 uppercase">{UI.evidence}</div><div className="text-2xl font-bold text-emerald-300">{victoryReport.mission?.evidence ?? campaignState.evidence}</div></div>
                        <div className="bg-slate-800/70 p-4 rounded text-center border border-slate-700"><div className="text-xs text-slate-500 uppercase">{UI.heat}</div><div className="text-2xl font-bold text-red-300">{victoryReport.mission?.heat ?? campaignState.heat}%</div></div>
                        <div className="bg-slate-800/70 p-4 rounded text-center border border-slate-700"><div className="text-xs text-slate-500 uppercase">{UI.trust}</div><div className="text-2xl font-bold text-cyan-300">{victoryReport.mission?.trust ?? campaignState.trust}</div></div>
                        <div className="bg-slate-800/70 p-4 rounded text-center border border-slate-700"><div className="text-xs text-slate-500 uppercase">{UI.route}</div><div className="text-xl font-bold text-white uppercase">{victoryReport.route}</div></div>
                    </div>
                    <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 mb-6">
                        <div className="text-xs text-slate-500 uppercase mb-2">{UI.operation_dossier}</div>
                        <div className="space-y-1 text-sm text-slate-400">
                            {(victoryReport.mission?.consequenceLog || campaignState.consequenceLog).slice(0, 4).map((line, index) => (
                                <div key={index} className="border-l border-emerald-500/30 pl-3">{line}</div>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        {comicFrames.length > 0 && (
                            <button
                                onClick={() => setShowComic(true)}
                                className="btn-cyber btn-cyber-ghost flex-1 py-3.5 font-display font-bold tracking-[0.06em] text-emerald-200 hover:text-white transition-colors"
                            >
                                {UI.share_comic}
                            </button>
                        )}
                        <button
                            onClick={() => setGameState(GameState.MENU)}
                            className="btn-cyber btn-cyber-primary flex-1 py-3.5 font-display font-bold tracking-[0.06em] text-[#04120b]"
                        >
                            {UI.new_run}
                        </button>
                    </div>
                </div>
            )}

            {gameState === GameState.GAME_OVER && (
                <div className="text-center space-y-6 bg-slate-900/80 p-10 rounded-2xl border border-red-900/50 backdrop-blur-xl max-w-lg w-full shadow-2xl animate-fade-in-up">
                    <h2 className="text-5xl font-bold text-red-500 tracking-tighter">{UI.critical_failure}</h2>
                    <p className="text-slate-300">{UI.connection_severed}</p>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
                            <div className="text-xs text-slate-500 uppercase">{UI.reached}</div>
                            <div className="text-xl font-bold text-white">{UI.level} {finalStats?.level || 1}</div>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
                            <div className="text-xs text-slate-500 uppercase">{UI.score}</div>
                            <div className="text-2xl font-bold text-emerald-400">{finalStats?.score || 0}</div>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
                            <div className="text-xs text-slate-500 uppercase">{UI.evidence}</div>
                            <div className="text-2xl font-bold text-emerald-300">{finalStats?.mission?.evidence ?? campaignState.evidence}</div>
                        </div>
                        <div className="bg-slate-800/50 p-4 rounded border border-slate-700">
                            <div className="text-xs text-slate-500 uppercase">{UI.heat}</div>
                            <div className="text-2xl font-bold text-red-300">{finalStats?.mission?.heat ?? campaignState.heat}%</div>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        {comicFrames.length > 0 && (
                            <button
                                onClick={() => setShowComic(true)}
                                className="btn-cyber btn-cyber-ghost flex-1 py-3.5 font-display font-bold tracking-[0.06em] text-emerald-200 hover:text-white transition-colors"
                            >
                                {UI.share_comic}
                            </button>
                        )}
                        <button
                            onClick={() => setGameState(GameState.MENU)}
                            className="btn-cyber btn-cyber-danger flex-1 py-3.5 font-display font-bold tracking-[0.06em] text-rose-200 hover:text-white transition-colors"
                        >
                            {UI.main_menu}
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>

      {showComic && (comicFrames.length > 0) && (() => {
        const data = buildComicData();
        return (
          <RunComic
            frames={comicFrames}
            title={UI.game_title}
            endingTitle={data.endingTitle}
            outcome={data.outcome}
            tagline={data.tagline}
            stats={data.stats}
            shareText={data.shareText}
            language={language}
            ui={{
              building: UI.comic_building,
              ready: UI.share_comic,
              error: UI.comic_error,
              share: UI.comic_share,
              download: UI.comic_download,
              close: UI.comic_close,
              copied: UI.comic_copied,
              replay_label: UI.comic_replay,
              watermark: UI.comic_watermark
            }}
            onClose={() => setShowComic(false)}
          />
        );
      })()}
    </div>
  );
};

export default App;
