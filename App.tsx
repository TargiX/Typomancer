import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GameState, StorySegment, GameStats, StoryLogItem, UserProfile, Perk, GameModifiers, LevelReport, UserUpgrades, StoryMood, SegmentType, Language, MissionState, ComicFrame, StoryGenreId } from './types';
import { generateStoryStart, generateCharacterProfile, generateLevelSummary, generateNextLevelStart } from './services/geminiService';
import { GENRE_ORDER, getGenrePack } from './services/genreConfig';
import { getGenreSkin, PerkGroupId, UpgradeId } from './services/genreSkin';
import { DAILY_MAX_ATTEMPTS, DailyBrief, getDailyBrief, getDailyState, pickDailyItems, recordDailyAttempt } from './services/dailyMode';
import { CAMPAIGN_SECTORS, getStealthLevel, getTypingAccuracy, getTypingFocus, summarizeSector } from './services/gameRules';
import { RunCheckpoint, clearRunCheckpoint, loadRunCheckpoint, saveRunCheckpoint } from './services/runCheckpoint';
import {
  createBalancedCalibration,
  getAdaptiveDifficulty,
  getLocalDateKey,
  loadPlayerProgress,
  recordRun,
  savePlayerProgress,
  setCalibration,
  type CalibrationResult
} from './services/playerProgress';
import { audioEngine } from './services/audioEngine';
import TypingEngine from './components/TypingEngine';
import RunComic from './components/RunComic';
import CalibrationPanel from './components/CalibrationPanel';
import OperatorRecord from './components/OperatorRecord';
import {
  captureProductEvent,
  getAccuracyBucket,
  getDeviceClass,
  getDurationBucket,
  getMetricBucket
} from './services/productAnalytics';
import {
  buildTargetedDrill,
  getWeakPatterns,
  loadTypingTraining,
  recordTypingSession,
  saveTypingTraining,
  snapshotTypingObservations,
  type TypingObservation
} from './services/typingTraining';
import { buildChallengeUrl, getChallengeVerdict, parseChallenge } from './services/challenge';

// --- TRANSLATIONS ---
const TRANSLATIONS = {
    en: {
        game_title: "NARRATIVE FLOW",
        subtitle: "Consequence-Driven RPG Typer",
        score: "SCORE",
        wallet: "WALLET",
        audio_active: "AUDIO ACTIVE",
        audio_muted: "AUDIO MUTED",
        empty_log: "Mission log is empty.\nAwaiting system initialization...",
        speed: "SPEED",
        system_online: "SYSTEM ONLINE",
        main_title: "Operation Black Ledger",
        intro_desc: "Type to move, decide to bend the city, survive to publish the proof.",
        mistakes_warn: "Every typo changes heat, trust, evidence, and the ending.",
        init_link: "[1] INITIALIZE LINK",
        quick_session: "A complete sector takes about 5–7 minutes. Continue only when you want a longer training run.",
        resume_run: "RESUME OPERATION",
        resume_sector: "Sector",
        daily_sector: "DAILY SECTOR",
        daily_left: "LEFT",
        daily_best: "BEST",
        daily_tomorrow: "BACK TOMORROW",
        daily_severed: "SEVERED",
        challenge_title: "INCOMING PLAYER CHALLENGE",
        challenge_target: "TARGET SCORE",
        challenge_accept: "ACCEPT SAME DAILY SECTOR",
        challenge_expired: "This challenge belongs to an older Daily Sector. Today’s sector is ready instead.",
        challenge_share: "CHALLENGE A FRIEND",
        challenge_copied: "CHALLENGE LINK COPIED",
        challenge_beaten: "TARGET BEATEN",
        challenge_missed: "TARGET MISSED",
        challenge_tied: "TARGET TIED",
        challenge_you: "YOUR SCORE",
        black_market: "[2] THE BLACK MARKET",
        operator_record: "[4] OPERATOR RECORD",
        powered_by: "Works with Gemini, but has a full local campaign fallback",
        privacy_note: "Anonymous play metrics only. Typed text never leaves this device for analytics.",
        perfectionist: "PERFECTIONIST · +30% XP",
        perfectionist_desc: "Case-sensitive typing. Typos are never forgiven.",
        accuracy_hook: "Most typing games shrug off mistakes. Here every typo bends your story — the ultimate accuracy trainer.",
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
        continue_hint: "Choose one upgrade to continue deeper.",
        bank_exit: "SAVE & EXIT",
        accuracy: "Accuracy",
        consistency: "Consistency",
        mistakes: "Mistakes",
        characters_typed: "Characters typed",
        typing_debrief: "Typing debrief",
        next_drill: "Next run target",
        signal_lost: "SIGNAL LOST",
        focus_accuracy: "Slow down slightly and keep accuracy above 96%.",
        focus_consistency: "Hold one rhythm instead of sprinting between pauses.",
        focus_speed: "Accuracy is stable. Push your average speed by 5 WPM.",
        focus_mastery: "Strong control. Keep this accuracy while increasing pressure.",
        generating_sector: "GENERATING NEW SECTOR...",
        generating_scenario: "GENERATING SCENARIO...",
        critical_failure: "CRITICAL FAILURE",
        connection_severed: "Your link was severed before the Ledger went live.",
        reached: "Reached",
        main_menu: "[SPACE] MAIN MENU",
        legendary_drop: "LEGENDARY DROP DETECTED",
        level: "Level",
        wpm: "WPM",
        operation_dossier: "OPERATION DOSSIER",
        campaign_goal: "Finish one sector in 5–7 minutes, then bank the result or continue through four.",
        focus_hint: "TAB activates Focus Mode when charged: trace pauses, mistakes hurt less, rewards double.",
        victory_title: "LEDGER PUBLISHED",
        victory_subtitle: "You won the run. The ending reflects your typing and choices.",
        final_ending: "Ending",
        new_run: "[SPACE] NEW RUN",
        focus: "Focus",
        effect: "Effect",
        currency_suffix: "CR",
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
        comic_watermark: "NARRATIVE FLOW · your run, generated live",
        genre_title: "SIMULATION LINK",
        genre_subtitle: "Jack into a different world through the same operator deck. Hardware stays yours — only the simulation behind the glass changes.",
        genre_back: "[ESC] MAIN MENU",
        genre_persists_note: "The Black Market and Focus protocols stay cyberpunk. Worlds change the story and art, not your gear.",
        sim_badge: "SIM LINK"
    },
    ru: {
        game_title: "НАРРАТИВНЫЙ ПОТОК",
        subtitle: "RPG-тайпер с последствиями",
        score: "СЧЕТ",
        wallet: "КОШЕЛЕК",
        audio_active: "ЗВУК ВКЛ",
        audio_muted: "ЗВУК ВЫКЛ",
        empty_log: "Журнал миссии пуст.\nОжидание инициализации системы...",
        speed: "СКОРОСТЬ",
        system_online: "СИСТЕМА В СЕТИ",
        main_title: "Операция Черный Реестр",
        intro_desc: "Печатай, чтобы двигаться; выбирай, чтобы менять город; выживи, чтобы опубликовать улики.",
        mistakes_warn: "Каждая опечатка меняет угрозу, доверие, улики и финал.",
        init_link: "[1] ИНИЦИАЛИЗАЦИЯ",
        quick_session: "Полный сектор занимает около 5–7 минут. Продолжай только если хочешь длинную тренировку.",
        resume_run: "ПРОДОЛЖИТЬ ОПЕРАЦИЮ",
        resume_sector: "Сектор",
        daily_sector: "ДНЕВНОЙ СЕКТОР",
        daily_left: "ОСТАЛОСЬ",
        daily_best: "ЛУЧШИЙ",
        daily_tomorrow: "ЗАВТРА НОВЫЙ СЕКТОР",
        daily_severed: "ОБРЫВ",
        challenge_title: "ВХОДЯЩИЙ ВЫЗОВ ИГРОКА",
        challenge_target: "ЦЕЛЕВОЙ СЧЁТ",
        challenge_accept: "ПРИНЯТЬ ТОТ ЖЕ ДНЕВНОЙ СЕКТОР",
        challenge_expired: "Этот вызов был для прошлого Дневного сектора. Сегодняшний уже готов.",
        challenge_share: "БРОСИТЬ ВЫЗОВ ДРУГУ",
        challenge_copied: "ССЫЛКА НА ВЫЗОВ СКОПИРОВАНА",
        challenge_beaten: "ЦЕЛЬ ПОБИТА",
        challenge_missed: "ЦЕЛЬ НЕ ДОСТИГНУТА",
        challenge_tied: "РАВНЫЙ СЧЁТ",
        challenge_you: "ТВОЙ СЧЁТ",
        black_market: "[2] ЧЕРНЫЙ РЫНОК",
        operator_record: "[4] ДОСЬЕ ОПЕРАТОРА",
        powered_by: "Работает с Gemini, но имеет полноценную локальную кампанию",
        privacy_note: "Только анонимные метрики игры. Набранный текст не уходит с устройства в аналитику.",
        perfectionist: "ПЕРФЕКЦИОНИСТ · +30% XP",
        perfectionist_desc: "Регистр важен. Опечатки не прощаются.",
        accuracy_hook: "Другие тайпинг-игры прощают ошибки. Здесь каждая опечатка гнёт твою историю — предельный тренажёр точности.",
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
        continue_hint: "Выбери один апгрейд, чтобы идти глубже.",
        bank_exit: "СОХРАНИТЬ И ВЫЙТИ",
        accuracy: "Точность",
        consistency: "Стабильность",
        mistakes: "Ошибки",
        characters_typed: "Напечатано знаков",
        typing_debrief: "Разбор печати",
        next_drill: "Цель следующего забега",
        signal_lost: "СИГНАЛ ПОТЕРЯН",
        focus_accuracy: "Чуть сбавь темп и удерживай точность выше 96%.",
        focus_consistency: "Держи один ритм вместо рывков между паузами.",
        focus_speed: "Точность стабильна. Подними среднюю скорость на 5 СЛ/М.",
        focus_mastery: "Сильный контроль. Сохрани точность под большим давлением.",
        generating_sector: "ГЕНЕРАЦИЯ НОВОГО СЕКТОРА...",
        generating_scenario: "ГЕНЕРАЦИЯ СЦЕНАРИЯ...",
        critical_failure: "КРИТИЧЕСКИЙ СБОЙ",
        connection_severed: "Связь оборвалась до публикации Реестра.",
        reached: "Достигнут",
        main_menu: "[SPACE] ГЛАВНОЕ МЕНЮ",
        legendary_drop: "ОБНАРУЖЕН ЛЕГЕНДАРНЫЙ МОДУЛЬ",
        level: "Уровень",
        wpm: "СЛ/М",
        operation_dossier: "ДОСЬЕ ОПЕРАЦИИ",
        campaign_goal: "Пройди сектор за 5–7 минут, затем сохрани результат или продолжай до четырёх.",
        focus_hint: "TAB включает Фокус-Мод при полном заряде: след заморожен, ошибки мягче, награды удвоены.",
        victory_title: "РЕЕСТР ОПУБЛИКОВАН",
        victory_subtitle: "Ты выиграл забег. Финал зависит от печати и решений.",
        final_ending: "Финал",
        new_run: "[SPACE] НОВЫЙ ЗАБЕГ",
        focus: "Фокус",
        effect: "Эффект",
        currency_suffix: "CR",
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
        comic_watermark: "NARRATIVE FLOW · твой забег, сгенерирован вживую",
        genre_title: "СВЯЗЬ С СИМУЛЯЦИЕЙ",
        genre_subtitle: "Подключись к другому миру через тот же операторский пульт. Железо остаётся твоим — меняется только симуляция за стеклом.",
        genre_back: "[ESC] В МЕНЮ",
        genre_persists_note: "Чёрный рынок и протоколы Фокуса остаются киберпанком. Миры меняют историю и арт, а не твой софт.",
        sim_badge: "СИМ-СВЯЗЬ"
    }
};

// --- TIERED PERK DEFINITIONS (mechanics only; display names come from genre skins) ---
const PERK_DEFINITIONS = [
    {
        groupId: 'neural_buffer' as PerkGroupId,
        type: 'defense',
        tiers: [
            { grace: 1 },
            { grace: 2 },
            { grace: 3 }
        ]
    },
    {
        groupId: 'ghost_protocol' as PerkGroupId,
        type: 'stealth',
        tiers: [
            { mult: 0.8 },
            { mult: 0.65 },
            { mult: 0.5 }
        ]
    },
    {
        groupId: 'adrenaline_spike' as PerkGroupId,
        type: 'offense',
        tiers: [
            { thresh: 80, regen: 2 },
            { thresh: 70, regen: 3 },
            { thresh: 60, regen: 4 }
        ]
    },
    {
        groupId: 'titanium_firewall' as PerkGroupId,
        type: 'defense',
        tiers: [
            { maxHp: 35 },
            { maxHp: 50 },
            { maxHp: 75 }
        ]
    },
    {
        groupId: 'critical_override' as PerkGroupId,
        type: 'utility',
        tiers: [
            { chance: 0.05 },
            { chance: 0.12 },
            { chance: 0.20 }
        ]
    },
    {
        groupId: 'focus_lattice' as PerkGroupId,
        type: 'utility',
        tiers: [
            { duration: 1000, forgiveness: 1 },
            { duration: 2000, forgiveness: 2 },
            { duration: 3000, forgiveness: 3 }
        ]
    },
    {
        groupId: 'error_siphon' as PerkGroupId,
        type: 'offense',
        tiers: [
            { charge: 2 },
            { charge: 4 },
            { charge: 7 }
        ]
    },
    {
        groupId: 'evidence_lens' as PerkGroupId,
        type: 'stealth',
        tiers: [
            { evidence: 0.15 },
            { evidence: 0.30 },
            { evidence: 0.50 }
        ]
    }
];

const DEFAULT_MODIFIERS: GameModifiers = {
    traceSpeedMultiplier: 1.0,
    mistakeGraceCount: 0,
    healthRegenWpmThreshold: 0,
    healthRegenAmount: 0,
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
    language: 'en',
    strictCase: false
};

// Perfectionist (strict-case) mode grants +30% XP as the "ultimate accuracy" reward.
const STRICT_CASE_XP_MULTIPLIER = 1.3;

const META_UPGRADES: Record<UpgradeId, { baseCost: number; effectPerLevel: number; maxLevel: number }> = {
    synapticWeave: { baseCost: 100, effectPerLevel: 2, maxLevel: 10 },
    cryptoMiner: { baseCost: 150, effectPerLevel: 0.1, maxLevel: 10 },
    signalDampener: { baseCost: 200, effectPerLevel: 0.05, maxLevel: 10 },
    bufferExpansion: { baseCost: 120, effectPerLevel: 5, maxLevel: 10 },
    focusLens: { baseCost: 180, effectPerLevel: 500, maxLevel: 8 },
    patternScanner: { baseCost: 220, effectPerLevel: 0.08, maxLevel: 8 }
};

const CAMPAIGN_FINAL_LEVEL = CAMPAIGN_SECTORS;

interface RoundData {
    wpm: number;
    mistakes: number;
    score: number;
    characters: number;
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

const stripKeyHint = (label: string): string => label.replace(/^\[[^\]]+\]\s*/, '');
const stripLeadingGlyph = (label: string): string => label.replace(/^[^\p{L}\p{N}]+/u, '');

const PerkTypeIcon: React.FC<{ type: Perk['type'] }> = ({ type }) => {
    const iconClass = 'h-5 w-5';

    if (type === 'defense') {
        return (
            <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 3 20 6v5c0 5.2-3.4 8.5-8 10-4.6-1.5-8-4.8-8-10V6l8-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="m9 12 2 2 4-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }

    if (type === 'stealth') {
        return (
            <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 3 21 21M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.7 10.7 0 0 1 12 4c5.2 0 8.5 4.5 9.5 6.2a3.5 3.5 0 0 1 0 3.6 14.4 14.4 0 0 1-2.2 2.8M6.2 6.2a14.4 14.4 0 0 0-3.7 4 3.5 3.5 0 0 0 0 3.6C3.5 15.5 6.8 20 12 20c1 0 1.9-.2 2.7-.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }

    if (type === 'utility') {
        return (
            <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="5" y="7" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="2" />
                <path d="M9 3v4m6-4v4M9 17v4m6-4v4M2 10h3m-3 4h3m14-4h3m-3 4h3m-8-4-3 4h4l-3 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }

    return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

const GenreIcon: React.FC<{ genre: StoryGenreId; className?: string }> = ({ genre, className = 'h-5 w-5' }) => {
    if (genre === 'space_horror') {
        return (
            <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 16.5a9 9 0 0 1 14 0M8 13a5 5 0 0 1 8 0M11 9.5a1.5 1.5 0 1 1 2 0M4 20h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        );
    }

    if (genre === 'noir') {
        return (
            <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="5.5" stroke="currentColor" strokeWidth="2" />
                <path d="m15 15 5 5M8.5 8.5h4M10.5 6.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
        );
    }

    if (genre === 'dark_fable') {
        return (
            <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v17H8.5A3.5 3.5 0 0 0 5 22V5.5ZM19 5.5A3.5 3.5 0 0 0 15.5 2H12v17h3.5A3.5 3.5 0 0 1 19 22V5.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                <path d="M8 6h1m6 0h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
        );
    }

    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

interface EmblemTileProps {
    src: string;
    fallback?: React.ReactNode;
    size: number;
    className?: string;
    style?: React.CSSProperties;
}

const EmblemTile: React.FC<EmblemTileProps> = ({ src, fallback, size, className = '', style }) => {
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        setImageFailed(false);
    }, [src]);

    if (imageFailed && fallback == null) return null;

    return (
        <span
            className={`screens-icon-tile screens-emblem-tile ${imageFailed ? 'screens-emblem-failed' : ''} ${className}`}
            style={{ width: size, height: size, ...style }}
            aria-hidden="true"
        >
            {imageFailed ? (
                <span className="screens-emblem-fallback">{fallback}</span>
            ) : (
                <img
                    src={src}
                    alt=""
                    loading="lazy"
                    className="screens-emblem-image"
                    onError={() => setImageFailed(true)}
                />
            )}
        </span>
    );
};

const App: React.FC = () => {
  const [dailyBrief, setDailyBrief] = useState(() => getDailyBrief());
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [storyLog, setStoryLog] = useState<StoryLogItem[]>([]);
  const [initialSegment, setInitialSegment] = useState<StorySegment | null>(null);
  const [characterDesc, setCharacterDesc] = useState<string>("");
  const [finalStats, setFinalStats] = useState<GameStats | null>(null);
  const [victoryReport, setVictoryReport] = useState<LevelReport | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentHealth, setCurrentHealth] = useState(20);
  const [musicActive, setMusicActive] = useState(() => audioEngine.isEnabled());
  const [language, setLanguage] = useState<Language>('en'); // Global Language State
  
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [activePerks, setActivePerks] = useState<Perk[]>([]);
  const [currentModifiers, setCurrentModifiers] = useState<GameModifiers>(DEFAULT_MODIFIERS);
  const [offeredPerks, setOfferedPerks] = useState<Perk[]>([]);
  
  const [levelBuffer, setLevelBuffer] = useState<RoundData[]>([]); 
  const [lastLevelReport, setLastLevelReport] = useState<LevelReport | null>(null);
  const [levelXpGained, setLevelXpGained] = useState(0);
  const [isSectorSummaryReady, setIsSectorSummaryReady] = useState(false);
  const [narrativeContext, setNarrativeContext] = useState<string>("");
  const [campaignState, setCampaignState] = useState<MissionState>(DEFAULT_MISSION_STATE);
  const [comicFrames, setComicFrames] = useState<ComicFrame[]>([]);
  const [showComic, setShowComic] = useState(false);
  const [deathSequenceActive, setDeathSequenceActive] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<StoryGenreId>('cyberpunk');
  const [dailyState, setDailyState] = useState(() => getDailyState(dailyBrief.dailyId));
  const [isDailyRun, setIsDailyRun] = useState(false);
  const [currentDailyId, setCurrentDailyId] = useState<string | null>(null);
  const [currentDailyDateLabel, setCurrentDailyDateLabel] = useState<string | null>(null);
  const [runCheckpoint, setRunCheckpoint] = useState<RunCheckpoint | null>(() => loadRunCheckpoint());
  const [playerProgress, setPlayerProgressState] = useState(() => loadPlayerProgress());
  const [typingTraining, setTypingTraining] = useState(() => loadTypingTraining());
  const [incomingChallenge] = useState(() => parseChallenge(typeof location !== 'undefined' ? location.search : ''));
  const [challengeShareStatus, setChallengeShareStatus] = useState(false);
  const runGenreRef = useRef<StoryGenreId>('cyberpunk');
  const isDailyRunRef = useRef(false);
  const currentDailyIdRef = useRef<string | null>(null);
  const activeDailyBriefRef = useRef<DailyBrief>(dailyBrief);
  const dailyAttemptRecordedRef = useRef(false);
  const runRecordedRef = useRef(false);
  const runStartedAtRef = useRef(Date.now());
  const calibrationNextRef = useRef<'campaign' | 'daily' | 'record'>('campaign');
  const calibrationModeRef = useRef<'calibration' | 'drill'>('calibration');
  const runTrainingObservationsRef = useRef<TypingObservation[]>([]);
  const totalScoreRef = useRef(0);
  const deathSequenceTimerRef = useRef<number | null>(null);
  const landingTrackedRef = useRef(false);
  const firstSegmentTrackedRef = useRef(false);
  const challengeTrackedRef = useRef(false);

  const logEndRef = useRef<HTMLDivElement>(null);

  const genrePack = getGenrePack(selectedGenre);
  const dailyGenrePack = getGenrePack(dailyBrief.genre);
  const dailyAttemptsLeft = Math.max(0, DAILY_MAX_ATTEMPTS - dailyState.attemptsUsed);
  const dailyAttemptsExhausted = dailyAttemptsLeft === 0;
  const isCurrentChallenge = incomingChallenge?.dailyId === dailyBrief.dailyId;
  const completedChallengeScore = gameState === GameState.GAME_OVER
    ? Math.max(totalScore, finalStats?.score || 0)
    : totalScore;
  const challengeVerdict = (gameState === GameState.VICTORY || gameState === GameState.GAME_OVER)
    ? getChallengeVerdict(incomingChallenge, currentDailyId, completedChallengeScore)
    : null;
  /** Operator deck chrome — always cyberpunk, Animus-style. */
  const hubSkin = getGenreSkin('cyberpunk');
  /** World behind the glass — endings/sim readout only. */
  const worldSkin = getGenreSkin(selectedGenre);
  const inSimulation =
    gameState === GameState.PLAYING ||
    gameState === GameState.LOADING ||
    gameState === GameState.LEVEL_COMPLETE ||
    gameState === GameState.STARTER_PERK_SELECTION ||
    gameState === GameState.VICTORY ||
    gameState === GameState.GAME_OVER;

  const UI = useMemo(() => {
    const base = TRANSLATIONS[language];
    // Hub/meta always stable. Only the simulation outcome layer borrows world copy.
    return {
      ...base,
      // Market & gear always from operator deck
      black_market: hubSkin.market.menuButton[language],
      market_title: hubSkin.market.title[language],
      market_subtitle: hubSkin.market.subtitle[language],
      install: hubSkin.market.install[language],
      avail_credits: hubSkin.market.availCredits[language],
      currency_suffix: hubSkin.market.currency[language],
      // While jacked in, show the simulation's campaign readout on end screens
      victory_title: inSimulation ? genrePack.ui.victoryTitle[language] : base.victory_title,
      connection_severed: inSimulation ? genrePack.ui.connectionSevered[language] : base.connection_severed
    };
  }, [language, hubSkin, genrePack, inSimulation]);

  const typingFocus = finalStats ? getTypingFocus({
    avgWpm: finalStats.wpm,
    accuracy: finalStats.accuracy,
    consistency: finalStats.consistency ?? 100,
    totalMistakes: finalStats.mistakes || 0,
    score: finalStats.score
  }) : 'accuracy';
  const typingCoachText = {
    accuracy: UI.focus_accuracy,
    consistency: UI.focus_consistency,
    speed: UI.focus_speed,
    mastery: UI.focus_mastery
  }[typingFocus];
  const challengeVerdictLabel = challengeVerdict
    ? challengeVerdict.outcome === 'beaten'
      ? UI.challenge_beaten
      : challengeVerdict.outcome === 'missed'
        ? UI.challenge_missed
        : UI.challenge_tied
    : '';
  const adaptiveDifficulty = useMemo(
    () => getAdaptiveDifficulty(playerProgress.calibration),
    [playerProgress.calibration]
  );

  const getAnalyticsContext = () => ({
    language,
    device_class: getDeviceClass(typeof window !== 'undefined' ? window.innerWidth : 1280)
  });

  useEffect(() => {
    if (landingTrackedRef.current) return;
    landingTrackedRef.current = true;
    captureProductEvent('typomancer_landing_viewed', getAnalyticsContext());
  }, []);

  useEffect(() => {
    if (!incomingChallenge || challengeTrackedRef.current) return;
    challengeTrackedRef.current = true;
    captureProductEvent('typomancer_challenge_opened', {
      ...getAnalyticsContext(),
      daily_id_present: true,
      target_score_bucket: getMetricBucket(incomingChallenge.targetScore, 500, 10_000)
    });
  }, [incomingChallenge]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('narrativeFlowProfile');
      if (saved) {
            const parsed = JSON.parse(saved);
            const totalXp = Number.isFinite(parsed.totalXp) ? Math.max(0, parsed.totalXp) : 0;
            setUserProfile({ 
                ...DEFAULT_PROFILE, 
                ...parsed, 
                totalXp,
                stealthLevel: getStealthLevel(totalXp),
                upgrades: { ...DEFAULT_PROFILE.upgrades, ...parsed.upgrades }
            });
            if (parsed.language) setLanguage(parsed.language);
            if (parsed.lastGenre && GENRE_ORDER.includes(parsed.lastGenre)) {
                setSelectedGenre(parsed.lastGenre);
                runGenreRef.current = parsed.lastGenre;
            }
      }
    } catch (e) { console.error("Profile load fail", e); }
  }, []);

  useEffect(() => {
    const profileToSave = { ...userProfile, language, lastGenre: selectedGenre };
    try {
      localStorage.setItem('narrativeFlowProfile', JSON.stringify(profileToSave));
    } catch (e) {
      console.error("Profile save fail", e);
    }
  }, [userProfile, language, selectedGenre]);

  useEffect(() => {
    const refreshDailyBrief = () => {
      const nextBrief = getDailyBrief();
      if (nextBrief.dailyId === dailyBrief.dailyId) return;
      setDailyBrief(nextBrief);
      setDailyState(getDailyState(nextBrief.dailyId));
    };
    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 100);
    const midnightTimer = window.setTimeout(refreshDailyBrief, nextMidnight.getTime() - Date.now());
    window.addEventListener('focus', refreshDailyBrief);
    return () => {
      window.clearTimeout(midnightTimer);
      window.removeEventListener('focus', refreshDailyBrief);
    };
  }, [dailyBrief.dailyId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [storyLog]);

  useEffect(() => {
    if (!isDailyRun || !currentDailyId || dailyAttemptRecordedRef.current) return;

    let finalScore: number | null = null;
    let endingTitle: string | null = null;
    if (gameState === GameState.VICTORY && victoryReport) {
      finalScore = totalScore;
      endingTitle = victoryReport.endingTitle || genrePack.ui.victoryTitle[language];
    } else if (gameState === GameState.GAME_OVER && finalStats) {
      finalScore = Math.max(totalScore, finalStats.score || 0);
      endingTitle = TRANSLATIONS[language].daily_severed;
    }

    if (finalScore === null || endingTitle === null) return;
    dailyAttemptRecordedRef.current = true;
    const recorded = recordDailyAttempt(currentDailyId, finalScore, endingTitle);
    if (currentDailyId === dailyBrief.dailyId) setDailyState(recorded);
  }, [currentDailyId, dailyBrief.dailyId, finalStats, gameState, genrePack, isDailyRun, language, totalScore, victoryReport]);

  useEffect(() => {
    if (runRecordedRef.current) return;

    let stats: {
      outcome: 'victory' | 'defeat';
      level: number;
      score: number;
      wpm: number;
      bestWpm: number;
      accuracy: number;
      consistency: number;
      mistakes: number;
      characters: number;
    } | null = null;

    if (gameState === GameState.GAME_OVER && finalStats) {
      stats = {
        outcome: 'defeat',
        level: finalStats.level,
        score: finalStats.score,
        wpm: finalStats.wpm,
        bestWpm: finalStats.bestWpm || finalStats.wpm,
        accuracy: finalStats.accuracy,
        consistency: finalStats.consistency ?? 100,
        mistakes: finalStats.mistakes || 0,
        characters: finalStats.characters || 0
      };
    } else if (gameState === GameState.VICTORY && victoryReport) {
      const metrics = storyLog
        .filter((item) => item.wpm > 0 && (item.characters || 0) > 0)
        .map((item) => ({
          wpm: item.wpm,
          mistakes: item.mistakes || 0,
          score: item.score,
          characters: item.characters || item.text.length
        }));
      const summary = summarizeSector(metrics);
      stats = {
        outcome: 'victory',
        level: victoryReport.level,
        score: totalScore,
        wpm: Math.round(summary.avgWpm || victoryReport.avgWpm),
        bestWpm: metrics.reduce((best, metric) => Math.max(best, metric.wpm), 0),
        accuracy: summary.accuracy,
        consistency: summary.consistency,
        mistakes: summary.totalMistakes,
        characters: metrics.reduce((sum, metric) => sum + metric.characters, 0)
      };
    }

    if (!stats) return;
    runRecordedRef.current = true;
    const endedAt = new Date();
    const runNumber = playerProgress.runs.length + 1;
    const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - runStartedAtRef.current) / 1000));
    const focus = getTypingFocus({
      avgWpm: stats.wpm,
      accuracy: stats.accuracy,
      consistency: stats.consistency,
      totalMistakes: stats.mistakes,
      score: stats.score
    });
    setPlayerProgressState((current) => savePlayerProgress(recordRun(current, {
      id: `${endedAt.toISOString()}-${Math.random().toString(36).slice(2, 8)}`,
      endedAt: endedAt.toISOString(),
      dateKey: getLocalDateKey(endedAt),
      outcome: stats.outcome,
      daily: isDailyRunRef.current,
      genre: runGenreRef.current,
      level: stats.level,
      score: stats.score,
      wpm: stats.wpm,
      bestWpm: stats.bestWpm,
      accuracy: stats.accuracy,
      consistency: stats.consistency,
      mistakes: stats.mistakes,
      characters: stats.characters,
      durationSeconds,
      focus
    })));
    const completedObservations = snapshotTypingObservations(runTrainingObservationsRef.current);
    runTrainingObservationsRef.current = [];
    setTypingTraining((current) => saveTypingTraining(recordTypingSession(
      current,
      completedObservations,
      {
        kind: 'run',
        wpm: stats.wpm,
        accuracy: stats.accuracy,
        completedAt: endedAt.toISOString()
      }
    )));
    const eventContext = getAnalyticsContext();
    captureProductEvent('typomancer_run_completed', {
      ...eventContext,
      daily: isDailyRunRef.current,
      genre: runGenreRef.current,
      level: stats.level,
      outcome: stats.outcome,
      wpm_bucket: getMetricBucket(stats.wpm),
      accuracy_bucket: getAccuracyBucket(stats.accuracy),
      consistency_bucket: getMetricBucket(stats.consistency),
      duration_bucket: getDurationBucket(durationSeconds),
      run_number: runNumber
    });
    captureProductEvent('typomancer_debrief_viewed', {
      ...eventContext,
      daily: isDailyRunRef.current,
      outcome: stats.outcome,
      focus,
      run_number: runNumber
    });
  }, [finalStats, gameState, playerProgress.runs.length, storyLog, totalScore, victoryReport]);

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
      mods.traceSpeedMultiplier *= adaptiveDifficulty.traceSpeedMultiplier;
      if (!userProfile.strictCase) mods.mistakeGraceCount += adaptiveDifficulty.mistakeGraceCount;
      mods.traceSpeedMultiplier = Math.max(0.1, mods.traceSpeedMultiplier);
      activePerks.forEach(perk => {
          mods = perk.apply(mods);
      });
      setCurrentModifiers(mods);
  }, [activePerks, adaptiveDifficulty, userProfile.strictCase, userProfile.upgrades]);

  useEffect(() => {
    return () => {
      if (deathSequenceTimerRef.current !== null) window.clearTimeout(deathSequenceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (deathSequenceActive) return;
        // Consuming a shortcut must also swallow the key. Otherwise the same
        // keypress that opens a screen is delivered again to whatever input that
        // screen focuses — pressing [1] on the menu used to type "1" as the first
        // character of the calibration prompt and score it as a miss.
        const consume = () => e.preventDefault();

        if (gameState === GameState.STARTER_PERK_SELECTION || gameState === GameState.LEVEL_COMPLETE) {
            const index = parseInt(e.key) - 1;
            if (index >= 0 && index < offeredPerks.length) {
                if (gameState === GameState.STARTER_PERK_SELECTION) {
                    handleStarterPerkSelect(offeredPerks[index]);
                    consume();
                } else if (isSectorSummaryReady) {
                    handleSelectPerk(offeredPerks[index]);
                    consume();
                }
            }
        } else if (gameState === GameState.GENRE_SELECTION) {
            if (e.key === 'Escape') { setGameState(GameState.MENU); consume(); }
            const index = parseInt(e.key) - 1;
            if (index >= 0 && index < GENRE_ORDER.length) {
                handleGenreSelect(GENRE_ORDER[index]);
                consume();
            }
        } else if (gameState === GameState.MENU) {
            if (e.key === '1' || e.key === 'Enter') { initializeSession(); consume(); }
            if (e.key === '2') { setGameState(GameState.BLACK_MARKET); consume(); }
            if (e.key === '3' && !dailyAttemptsExhausted) { initializeDailySession(); consume(); }
            if (e.key === '4') { setGameState(GameState.OPERATOR_RECORD); consume(); }
            if (e.key.toLowerCase() === 'r' && runCheckpoint) { resumeSession(); consume(); }
        } else if (gameState === GameState.OPERATOR_RECORD) {
            if (e.key === 'Escape') { setGameState(GameState.MENU); consume(); }
        } else if (gameState === GameState.GAME_OVER || gameState === GameState.VICTORY) {
            if (e.key === 'Enter' || e.key === ' ') { setGameState(GameState.MENU); consume(); }
        } else if (gameState === GameState.BLACK_MARKET) {
            if (e.key === 'Escape') { setGameState(GameState.MENU); consume(); }

            const index = parseInt(e.key) - 1;
            const upgradeKeys = Object.keys(META_UPGRADES) as (keyof UserUpgrades)[];
            if (index >= 0 && index < upgradeKeys.length) {
                handleBuyUpgrade(upgradeKeys[index]);
                consume();
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dailyAttemptsExhausted, deathSequenceActive, gameState, isSectorSummaryReady, offeredPerks, playerProgress.calibration, runCheckpoint, userProfile]);

  // Browsers refuse to open an AudioContext outside a user gesture, so the very
  // first click or keypress is what actually brings audio up — including on the
  // menu, which used to stay silent until a run started.
  useEffect(() => {
      const unlock = () => audioEngine.unlock();
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
      return () => {
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('keydown', unlock);
      };
  }, []);

  const handleToggleMusic = () => {
      const active = audioEngine.toggle();
      setMusicActive(active);
  };

  const handleToggleLanguage = () => {
      setLanguage(prev => prev === 'en' ? 'ru' : 'en');
  };

  const handleToggleStrictCase = () => {
      setUserProfile(prev => ({ ...prev, strictCase: !prev.strictCase }));
  };

  const generatePerkObject = (def: typeof PERK_DEFINITIONS[number], tierIndex: number, _genreOverride?: StoryGenreId): Perk => {
      const tierData = def.tiers[tierIndex] as any;
      // Perk firmware lives on the operator deck — always cyberpunk names.
      const perkSkin = hubSkin.perks[def.groupId];
      return {
          id: `${def.groupId}_${tierIndex + 1}`,
          groupId: def.groupId,
          name: `${perkSkin.name[language]} ${['I','II','III'][tierIndex]}`,
          description: perkSkin.tiers[tierIndex][language],
          type: def.type as any,
          rarity: tierIndex === 0 ? 'common' : tierIndex === 1 ? 'rare' : 'legendary',
          tier: tierIndex + 1,
          maxTier: def.tiers.length,
          apply: (mods) => {
              const newMods = { ...mods };
              if (def.groupId === 'neural_buffer') newMods.mistakeGraceCount = Math.max(newMods.mistakeGraceCount, tierData.grace);
              if (def.groupId === 'ghost_protocol') newMods.traceSpeedMultiplier *= tierData.mult;
              if (def.groupId === 'adrenaline_spike') {
                  newMods.healthRegenWpmThreshold = tierData.thresh;
                  newMods.healthRegenAmount = tierData.regen;
              }
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

  const prepareSession = (dailySeed?: string) => {
      runRecordedRef.current = false;
      runStartedAtRef.current = Date.now();
      setStoryLog([]);
      setTotalScore(0);
      totalScoreRef.current = 0;
      setFinalStats(null);
      setVictoryReport(null);
      setComicFrames([]);
      setShowComic(false);
      setDeathSequenceActive(false);
      if (deathSequenceTimerRef.current !== null) {
          window.clearTimeout(deathSequenceTimerRef.current);
          deathSequenceTimerRef.current = null;
      }
      setCampaignState(DEFAULT_MISSION_STATE);
      setNarrativeContext("");
      setCharacterDesc("");
      setActivePerks([]); 
      setLevelBuffer([]);
      setIsSectorSummaryReady(false);
      setCurrentLevel(1);
      const dailyStarterIds = dailySeed
          ? pickDailyItems(
              dailySeed,
              PERK_DEFINITIONS.filter((definition) => definition.groupId !== 'critical_override').map((definition) => definition.groupId),
              3
            )
          : [];
      const starterDefinitions = dailySeed
          ? dailyStarterIds.flatMap((id) => PERK_DEFINITIONS.find((definition) => definition.groupId === id) || [])
          : [...PERK_DEFINITIONS].sort(() => 0.5 - Math.random()).slice(0, 3);
      const starters = starterDefinitions
          .map(d => generatePerkObject(d, 0));
      setOfferedPerks(starters);
      dailyAttemptRecordedRef.current = false;
      firstSegmentTrackedRef.current = false;
      runTrainingObservationsRef.current = [];
  };

  const initializeSession = () => {
      calibrationModeRef.current = 'calibration';
      clearRunCheckpoint();
      setRunCheckpoint(null);
      prepareSession();
      setIsDailyRun(false);
      isDailyRunRef.current = false;
      setCurrentDailyId(null);
      currentDailyIdRef.current = null;
      setCurrentDailyDateLabel(null);
      if (!playerProgress.calibration) {
          calibrationNextRef.current = 'campaign';
          captureProductEvent('typomancer_calibration_started', {
              ...getAnalyticsContext(),
              recalibration: false
          });
          setGameState(GameState.CALIBRATION);
      } else {
          setGameState(GameState.GENRE_SELECTION);
      }
      audioEngine.unlock();
  };

  const resumeSession = async () => {
      const checkpoint = loadRunCheckpoint();
      if (!checkpoint) {
          setRunCheckpoint(null);
          return;
      }

      const restoredPerks = checkpoint.perks.flatMap((savedPerk) => {
          const definition = PERK_DEFINITIONS.find((candidate) => candidate.groupId === savedPerk.groupId);
          return definition ? [generatePerkObject(definition, savedPerk.tier - 1)] : [];
      });
      setStoryLog([]);
      runRecordedRef.current = false;
      runStartedAtRef.current = Date.now();
      runTrainingObservationsRef.current = [];
      setFinalStats(null);
      setVictoryReport(null);
      setComicFrames([]);
      setShowComic(false);
      setLevelBuffer([]);
      setActivePerks(restoredPerks);
      setCampaignState(checkpoint.mission);
      setNarrativeContext(checkpoint.narrativeContext);
      setCurrentHealth(checkpoint.health);
      setCurrentLevel(checkpoint.nextLevel);
      setTotalScore(checkpoint.totalScore);
      totalScoreRef.current = checkpoint.totalScore;
      setSelectedGenre(checkpoint.genre);
      runGenreRef.current = checkpoint.genre;
      setIsDailyRun(false);
      isDailyRunRef.current = false;
      setCurrentDailyId(null);
      currentDailyIdRef.current = null;
      setCurrentDailyDateLabel(null);
      setGameState(GameState.LOADING);
      audioEngine.unlock();
      captureProductEvent('typomancer_run_started', {
          ...getAnalyticsContext(),
          daily: false,
          genre: checkpoint.genre,
          preset: adaptiveDifficulty.preset,
          run_number: playerProgress.runs.length + 1,
          returning_player: playerProgress.runs.length > 0,
          resumed: true
      });

      try {
          const nextStart = await generateNextLevelStart(
              checkpoint.nextLevel,
              checkpoint.narrativeContext,
              language,
              checkpoint.mission,
              checkpoint.genre
          );
          setInitialSegment(nextStart);
      } catch {
          const fallback = getGenrePack(checkpoint.genre).local[language].levelStart[checkpoint.nextLevel - 1]
              || (language === 'ru' ? "Связь восстановлена. Операция продолжается." : "The link is restored. The operation continues.");
          setInitialSegment({ text: fallback, mood: StoryMood.TENSE, type: SegmentType.NARRATIVE, skill: 'flow' });
      }
      setGameState(GameState.PLAYING);
  };

  const initializeDailySession = () => {
      calibrationModeRef.current = 'calibration';
      const brief = getDailyBrief();
      const latestState = getDailyState(brief.dailyId);
      setDailyBrief(brief);
      setDailyState(latestState);
      if (latestState.attemptsUsed >= DAILY_MAX_ATTEMPTS) return;

      prepareSession(brief.dailyId);
      activeDailyBriefRef.current = brief;
      setIsDailyRun(true);
      isDailyRunRef.current = true;
      setCurrentDailyId(brief.dailyId);
      currentDailyIdRef.current = brief.dailyId;
      setCurrentDailyDateLabel(brief.dateLabel);
      setSelectedGenre(brief.genre);
      runGenreRef.current = brief.genre;
      if (!playerProgress.calibration) {
          calibrationNextRef.current = 'daily';
          captureProductEvent('typomancer_calibration_started', {
              ...getAnalyticsContext(),
              recalibration: false
          });
          setGameState(GameState.CALIBRATION);
      } else {
          setGameState(GameState.STARTER_PERK_SELECTION);
      }
      audioEngine.unlock();
  };

  const finishCalibration = (result: CalibrationResult, observations: TypingObservation[] = [], skipped = false) => {
      const mode = calibrationModeRef.current;
      setTypingTraining((current) => saveTypingTraining(recordTypingSession(
          current,
          observations,
          skipped ? undefined : {
              kind: mode === 'drill' ? 'drill' : 'calibration',
              wpm: result.wpm,
              accuracy: result.accuracy,
              completedAt: result.completedAt
          }
      )));
      if (mode === 'drill') {
          captureProductEvent('typomancer_drill_completed', {
              ...getAnalyticsContext(),
              wpm_bucket: getMetricBucket(result.wpm),
              accuracy_bucket: getAccuracyBucket(result.accuracy),
              samples_bucket: getMetricBucket(observations.length, 25, 500)
          });
          calibrationModeRef.current = 'calibration';
          setGameState(GameState.OPERATOR_RECORD);
          return;
      }
      setPlayerProgressState((current) => savePlayerProgress(setCalibration(current, result)));
      captureProductEvent('typomancer_calibration_completed', {
          ...getAnalyticsContext(),
          recalibration: calibrationNextRef.current === 'record',
          skipped,
          wpm_bucket: getMetricBucket(result.wpm),
          accuracy_bucket: getAccuracyBucket(result.accuracy),
          preset: result.preset
      });
      if (calibrationNextRef.current === 'daily') setGameState(GameState.STARTER_PERK_SELECTION);
      else if (calibrationNextRef.current === 'record') setGameState(GameState.OPERATOR_RECORD);
      else setGameState(GameState.GENRE_SELECTION);
  };

  const skipCalibration = () => {
      if (calibrationModeRef.current === 'drill') {
          calibrationModeRef.current = 'calibration';
          setGameState(GameState.OPERATOR_RECORD);
          return;
      }
      finishCalibration(createBalancedCalibration(), [], true);
  };

  const recalibrate = () => {
      calibrationModeRef.current = 'calibration';
      calibrationNextRef.current = 'record';
      captureProductEvent('typomancer_calibration_started', {
          ...getAnalyticsContext(),
          recalibration: true
      });
      setGameState(GameState.CALIBRATION);
  };

  const startTargetedDrill = () => {
      calibrationModeRef.current = 'drill';
      calibrationNextRef.current = 'record';
      captureProductEvent('typomancer_drill_started', {
          ...getAnalyticsContext(),
          samples_bucket: getMetricBucket(typingTraining.samples, 100, 2000),
          weak_pattern_count: getWeakPatterns(typingTraining, 5).length
      });
      setGameState(GameState.CALIBRATION);
  };

  const shareDailyChallenge = async (outcome: 'victory' | 'defeat', score: number) => {
      if (!isDailyRunRef.current || !currentDailyIdRef.current || typeof location === 'undefined') return;
      const url = buildChallengeUrl(location.origin + location.pathname, currentDailyIdRef.current, score);
      if (!url) return;
      const text = language === 'ru'
          ? `Я набрал ${score} в Дневном секторе Typomancer. Сможешь побить мой результат?`
          : `I scored ${score} in Typomancer's Daily Sector. Can you beat it?`;
      try {
          if (navigator.share) await navigator.share({ title: 'Typomancer Challenge', text, url });
          else await navigator.clipboard.writeText(`${text} ${url}`);
          setChallengeShareStatus(true);
          window.setTimeout(() => setChallengeShareStatus(false), 2400);
          captureProductEvent('typomancer_challenge_shared', {
              ...getAnalyticsContext(),
              daily: true,
              outcome,
              target_score_bucket: getMetricBucket(score, 500, 10_000)
          });
      } catch {
          // Closing the native share sheet is not an error state for the game.
      }
  };

  const handleGenreSelect = (genre: StoryGenreId) => {
      setSelectedGenre(genre);
      runGenreRef.current = genre;
      setGameState(GameState.STARTER_PERK_SELECTION);
  };

  const handleStarterPerkSelect = (perk: Perk) => {
      setActivePerks([perk]);
      beginStoryGeneration(runGenreRef.current);
  };

  const beginStoryGeneration = async (genre: StoryGenreId = runGenreRef.current) => {
    setGameState(GameState.LOADING);
    captureProductEvent('typomancer_run_started', {
      ...getAnalyticsContext(),
      daily: isDailyRunRef.current,
      genre,
      preset: adaptiveDifficulty.preset,
      run_number: playerProgress.runs.length + 1,
      returning_player: playerProgress.runs.length > 0
    });
    const activeBrief = activeDailyBriefRef.current;
    const startRequest = isDailyRunRef.current && currentDailyIdRef.current === activeBrief.dailyId
      ? Promise.resolve<StorySegment>({
          text: activeBrief.opening[language],
          mood: StoryMood.TENSE,
          type: SegmentType.NARRATIVE
        })
      : generateStoryStart(language, genre);
    const [start, charProfile] = await Promise.all([
        startRequest,
        generateCharacterProfile(language, genre)
    ]);
    setInitialSegment(start);
    setCharacterDesc(charProfile);
    setGameState(GameState.PLAYING);
  };

  const getEndingTitle = (report: LevelReport): string => {
      const mission = report.mission || campaignState;
      if (mission.evidence >= 55 && mission.heat < 55 && mission.trust >= 45) {
          return worldSkin.endings.ghost[language];
      }
      if (mission.evidence >= 55 && mission.route === 'loud') {
          return worldSkin.endings.loud[language];
      }
      if (mission.corruption >= 45 || mission.trust < 18) {
          return worldSkin.endings.broken[language];
      }
      return worldSkin.endings.survivor[language];
  };

  const handleLevelComplete = async (finalRoundStats: GameStats, finalTrace: number, finalMission?: MissionState) => {
      const allRounds = [
          ...levelBuffer,
          {
              wpm: finalRoundStats.wpm,
              mistakes: finalRoundStats.mistakes || 0,
              score: finalRoundStats.score,
              characters: finalRoundStats.characters || 0
          }
      ];
      const sectorSummary = summarizeSector(allRounds);
      const { avgWpm, totalMistakes, score: levelScore, accuracy, consistency } = sectorSummary;
      const strictBonus = userProfile.strictCase ? STRICT_CASE_XP_MULTIPLIER : 1;
      const xp = Math.floor(levelScore * (1 + (finalRoundStats.level * 0.1)) * strictBonus);
      setLevelXpGained(xp);
      const creditsEarned = finalRoundStats.credits || 0;
      const mission = finalMission || finalRoundStats.mission || campaignState;
      setCampaignState(mission);
      setUserProfile(prev => {
          const totalXp = prev.totalXp + xp;
          return {
              ...prev,
              totalXp,
              stealthLevel: getStealthLevel(totalXp),
              credits: Math.floor((prev.credits || 0) + creditsEarned)
          };
      });
      setCurrentHealth(finalRoundStats.health);
      let performanceRating: 'bad' | 'average' | 'good' | 'legendary' = 'average';
      if (finalTrace >= 90 || finalRoundStats.health <= 5 || mission.corruption > 55) performanceRating = 'bad';
      else if (avgWpm > 75 && totalMistakes < 3 && mission.heat < 45) performanceRating = 'legendary';
      else if (avgWpm > 55 && totalMistakes < 8) performanceRating = 'good';

      const report: LevelReport = {
          level: finalRoundStats.level,
          avgWpm,
          totalMistakes,
          accuracy,
          consistency,
          finalHealth: finalRoundStats.health,
          traceLevel: finalTrace,
          narrativeSummary: language === 'ru' ? "Анализ данных миссии..." : "Analyzing mission data...",
          creditsEarned,
          mission,
          route: mission.route
      };

      const isFinal = isDailyRunRef.current || finalRoundStats.level >= CAMPAIGN_FINAL_LEVEL;
      const upgradeOptions = isFinal ? [] : getUpgradeOptions(performanceRating);
      setLastLevelReport(report);
      if (isFinal) {
          const endingTitle = getEndingTitle(report);
          setVictoryReport({ ...report, endingTitle });
          setGameState(GameState.VICTORY);
      } else {
          setIsSectorSummaryReady(false);
          setOfferedPerks(upgradeOptions);
          setGameState(GameState.LEVEL_COMPLETE);
      }

      const summary = await generateLevelSummary(finalRoundStats.level, report, storyLog.map(l => l.text).join(" "), language, runGenreRef.current);
      const completedReport = { ...report, narrativeSummary: summary, endingTitle: getEndingTitle({ ...report, narrativeSummary: summary }) };
      setNarrativeContext(summary);
      addToLog(`[${UI.level.toUpperCase()} ${finalRoundStats.level} ${UI.seq_complete}]: ${summary}`, 'neutral', 0, 0, 0, `${UI.evidence}: ${mission.evidence} · ${UI.heat}: ${mission.heat}%`);

      if (isFinal) {
          clearRunCheckpoint();
          setRunCheckpoint(null);
          setVictoryReport(completedReport);
      } else {
          setLastLevelReport(completedReport);
          const checkpoint = saveRunCheckpoint({
              nextLevel: finalRoundStats.level + 1,
              health: finalRoundStats.health,
              genre: runGenreRef.current,
              narrativeContext: summary,
              totalScore: totalScoreRef.current,
              perks: activePerks.map((perk) => ({ groupId: perk.groupId, tier: perk.tier })),
              mission
          });
          setRunCheckpoint(checkpoint);
          setIsSectorSummaryReady(true);
      }
  };

  const handleSelectPerk = async (perk: Perk) => {
      const nextActivePerks = [
          ...activePerks.filter(existing => existing.groupId !== perk.groupId),
          perk
      ];
      setActivePerks(nextActivePerks);
      if (runCheckpoint) {
          const updatedCheckpoint = saveRunCheckpoint({
              nextLevel: runCheckpoint.nextLevel,
              health: runCheckpoint.health,
              genre: runCheckpoint.genre,
              narrativeContext: runCheckpoint.narrativeContext,
              totalScore: runCheckpoint.totalScore,
              mission: runCheckpoint.mission,
              perks: nextActivePerks.map(activePerk => ({ groupId: activePerk.groupId, tier: activePerk.tier }))
          });
          setRunCheckpoint(updatedCheckpoint);
      }
      setGameState(GameState.LOADING);
      const nextLvl = currentLevel + 1;
      setCurrentLevel(nextLvl);
      setLevelBuffer([]);
      try {
          const nextStartSegment = await generateNextLevelStart(nextLvl, narrativeContext, language, campaignState, runGenreRef.current);
          setInitialSegment(nextStartSegment);
          setGameState(GameState.PLAYING);
        } catch (e) {
          const fallback = getGenrePack(runGenreRef.current).local[language].levelStart[nextLvl - 1]
              || (language === 'ru' ? "Связь разорвана. Вы в новом секторе." : "The connection resets. You are in a new sector.");
          setInitialSegment({ 
              text: fallback,
              mood: StoryMood.TENSE, 
              type: SegmentType.NARRATIVE,
              skill: 'flow',
              objective: language === 'ru' ? 'Восстановить связь' : 'Recover connection'
          });
          setGameState(GameState.PLAYING);
      }
  };

  const handleBankExit = () => {
      if (!lastLevelReport || runRecordedRef.current) {
          setGameState(GameState.MENU);
          return;
      }

      runRecordedRef.current = true;
      const endedAt = new Date();
      const durationSeconds = Math.max(1, Math.round((endedAt.getTime() - runStartedAtRef.current) / 1000));
      const wpm = Math.round(lastLevelReport.avgWpm);
      const accuracy = lastLevelReport.accuracy ?? 100;
      const consistency = lastLevelReport.consistency ?? 100;
      const mistakes = lastLevelReport.totalMistakes;
      const characters = levelBuffer.reduce((sum, metric) => sum + metric.characters, 0);
      const score = levelBuffer.reduce((sum, metric) => sum + metric.score, 0);
      const bestWpm = levelBuffer.reduce((best, metric) => Math.max(best, metric.wpm), wpm);
      const focus = getTypingFocus({
          avgWpm: wpm,
          accuracy,
          consistency,
          totalMistakes: mistakes,
          score
      });
      const runNumber = playerProgress.runs.length + 1;

      setPlayerProgressState((current) => savePlayerProgress(recordRun(current, {
          id: `${endedAt.toISOString()}-${Math.random().toString(36).slice(2, 8)}`,
          endedAt: endedAt.toISOString(),
          dateKey: getLocalDateKey(endedAt),
          outcome: 'banked',
          daily: false,
          genre: runGenreRef.current,
          level: lastLevelReport.level,
          score,
          wpm,
          bestWpm,
          accuracy,
          consistency,
          mistakes,
          characters,
          durationSeconds,
          focus
      })));

      const completedObservations = snapshotTypingObservations(runTrainingObservationsRef.current);
      runTrainingObservationsRef.current = [];
      setTypingTraining((current) => saveTypingTraining(recordTypingSession(
          current,
          completedObservations,
          { kind: 'run', wpm, accuracy, completedAt: endedAt.toISOString() }
      )));

      const eventContext = getAnalyticsContext();
      captureProductEvent('typomancer_run_completed', {
          ...eventContext,
          daily: false,
          genre: runGenreRef.current,
          level: lastLevelReport.level,
          outcome: 'banked',
          wpm_bucket: getMetricBucket(wpm),
          accuracy_bucket: getAccuracyBucket(accuracy),
          consistency_bucket: getMetricBucket(consistency),
          duration_bucket: getDurationBucket(durationSeconds),
          run_number: runNumber
      });
      captureProductEvent('typomancer_debrief_viewed', {
          ...eventContext,
          daily: false,
          outcome: 'banked',
          focus,
          run_number: runNumber
      });
      setGameState(GameState.MENU);
  };

  const handleGameOver = (stats: GameStats) => {
    const finalScore = totalScoreRef.current;
    const mission = stats.mission || campaignState;
    const completedMetrics = storyLog
      .filter((item) => item.wpm > 0 && (item.characters || 0) > 0)
      .map((item) => ({
        wpm: item.wpm,
        mistakes: item.mistakes || 0,
        score: item.score,
        characters: item.characters || item.text.length
      }));
    const activeMetric = (stats.characters || 0) > 0
      ? [{ wpm: stats.wpm, mistakes: stats.mistakes || 0, score: 0, characters: stats.characters || 0 }]
      : [];
    const runMetrics = [...completedMetrics, ...activeMetric];
    const typingSummary = summarizeSector(runMetrics);
    const bestWpm = runMetrics.reduce((best, metric) => Math.max(best, metric.wpm), 0);
    const bonusXp = Math.floor(finalScore * (1 + (stats.level * 0.1))); 
    setFinalStats({
        ...stats,
        score: finalScore,
        wpm: Math.round(typingSummary.avgWpm),
        accuracy: typingSummary.accuracy,
        mistakes: typingSummary.totalMistakes,
        characters: runMetrics.reduce((sum, metric) => sum + metric.characters, 0),
        consistency: typingSummary.consistency,
        bestWpm,
        segments: runMetrics.length
    });
    if (stats.mission) setCampaignState(stats.mission);
    setUserProfile(prev => {
        const totalXp = prev.totalXp + bonusXp;
        return {
            ...prev,
            totalXp,
            stealthLevel: getStealthLevel(totalXp),
            credits: Math.floor((prev.credits || 0) + (stats.credits || 0))
        };
    });
    clearRunCheckpoint();
    setRunCheckpoint(null);
    setDeathSequenceActive(true);
    setGameState(GameState.GAME_OVER);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    deathSequenceTimerRef.current = window.setTimeout(() => {
        setDeathSequenceActive(false);
        deathSequenceTimerRef.current = null;
    }, reducedMotion ? 120 : 1150);
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
    totalScoreRef.current += score;
    setTotalScore(totalScoreRef.current);
    setStoryLog(prev => [...prev, { text, performance, score, wpm, mistakes, characters: performance === 'neutral' ? 0 : text.length, meta, type }]);
    if (performance !== 'neutral') {
      if (!firstSegmentTrackedRef.current) {
        firstSegmentTrackedRef.current = true;
        captureProductEvent('typomancer_first_segment_completed', {
          ...getAnalyticsContext(),
          daily: isDailyRunRef.current,
          genre: runGenreRef.current,
          level: currentLevel,
          wpm_bucket: getMetricBucket(wpm),
          accuracy_bucket: getAccuracyBucket(getTypingAccuracy(mistakes, text.length))
        });
      }
        setLevelBuffer(prev => [...prev, { wpm, mistakes, score, characters: text.length }]);
    }
  };

  const captureComicFrame = (frame: ComicFrame) => {
    setComicFrames(prev => [...prev, frame]);
  };

  const buildComicData = () => {
    const isVictory = gameState === GameState.VICTORY;
    const mission = (isVictory ? victoryReport?.mission : finalStats?.mission) || campaignState;
    const campaignTitle = genrePack.ui.mainTitle[language];
    const defeatScore = Math.max(totalScore, finalStats?.score || 0);
    const buildDailyShareText = (ending: string, score: number): string => language === 'ru'
      ? `Дневной сектор ${currentDailyDateLabel} — ${ending}, счёт ${score}. Напечатай свою судьбу:`
      : `Daily Sector ${currentDailyDateLabel} — ${ending}, score ${score}. Type your own fate:`;
    if (isVictory && victoryReport) {
      const ending = victoryReport.endingTitle || genrePack.ui.victoryTitle[language];
      return {
        outcome: 'victory' as const,
        endingTitle: ending,
        tagline: victoryReport.narrativeSummary,
        shareText: isDailyRun && currentDailyDateLabel
          ? buildDailyShareText(ending, totalScore)
          : language === 'ru'
            ? `Мой забег в Narrative Flow (${genrePack.name.ru}): «${ending}» — ${campaignTitle}`
            : `My Narrative Flow run (${genrePack.name.en}): “${ending}” — ${campaignTitle}`,
        stats: [
          { label: UI.wpm, value: String(Math.round(victoryReport.avgWpm)) },
          { label: UI.evidence, value: String(mission.evidence) },
          { label: UI.heat, value: `${Math.round(mission.heat)}%` },
          { label: UI.score, value: String(totalScore) }
        ]
      };
    }
    const defeatEnding = isDailyRun ? UI.daily_severed : UI.critical_failure;
    return {
      outcome: 'defeat' as const,
      endingTitle: defeatEnding,
      tagline: genrePack.ui.connectionSevered[language],
      shareText: isDailyRun && currentDailyDateLabel
        ? buildDailyShareText(defeatEnding, defeatScore)
        : language === 'ru'
          ? `Мой забег в Narrative Flow (${genrePack.name.ru}) оборвался на уровне ${finalStats?.level || 1}.`
          : `My Narrative Flow run (${genrePack.name.en}) was severed on level ${finalStats?.level || 1}.`,
      stats: [
        { label: UI.level, value: String(finalStats?.level || 1) },
        { label: UI.evidence, value: String(mission.evidence) },
        { label: UI.heat, value: `${Math.round(mission.heat)}%` },
        { label: UI.score, value: String(defeatScore) }
      ]
    };
  };

  const describeUpgradeEffect = (key: UpgradeId, level: number): string => {
      switch (key) {
          case 'synapticWeave': return `+${level * META_UPGRADES.synapticWeave.effectPerLevel} ${UI.health}`;
          case 'cryptoMiner': return `+${Math.round(level * META_UPGRADES.cryptoMiner.effectPerLevel * 100)}% ${UI.credits}`;
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
      const rarityClass = isLegendary
          ? 'screens-perk-legendary border-amber-400/60 shadow-[0_0_28px_rgba(251,191,36,0.12)] hover:shadow-[0_0_36px_rgba(251,191,36,0.2)]'
          : isRare
              ? 'border-violet-400/60 shadow-[0_0_24px_rgba(167,139,250,0.12)] hover:shadow-[0_0_32px_rgba(167,139,250,0.2)]'
              : 'border-white/10 hover:border-emerald-400/35 hover:shadow-[0_0_24px_rgba(52,211,153,0.1)]';
      const rarityColor = isLegendary ? 'text-amber-300' : isRare ? 'text-violet-300' : 'text-slate-300';

      return (
        <button
            key={perk.id}
            onClick={() => isStarter ? handleStarterPerkSelect(perk) : handleSelectPerk(perk)}
            disabled={!isStarter && !isSectorSummaryReady}
            className={`screens-cut-card screens-perk-card group relative overflow-hidden border bg-[#0b101a] ${rarityClass} transition-all duration-300 text-left h-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/70 disabled:cursor-wait disabled:opacity-55`}
        >
            <div className="screens-card-art-frame screens-card-banner screens-perk-card-banner">
                <EmblemTile
                    src={`/assets/perks/${perk.groupId}.png`}
                    size={60}
                    fallback={<PerkTypeIcon type={perk.type} />}
                    className={`screens-card-art border bg-black/20 ${
                    perk.type === 'defense' ? 'border-sky-400/25 text-sky-300' :
                    perk.type === 'stealth' ? 'border-violet-400/25 text-violet-300' :
                    perk.type === 'utility' ? 'border-emerald-400/25 text-emerald-300' :
                    'border-rose-400/25 text-rose-300'
                    }`}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
            <div className="screens-perk-meta flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="keycap opacity-70 group-hover:opacity-100">{index + 1}</span>
                    <span className={`truncate text-[9px] font-bold uppercase tracking-[0.2em] ${rarityColor}`}>{perk.rarity}</span>
                </div>
                 <div className="flex gap-1" aria-label={`${UI.level} ${perk.tier}`}>
                     {Array.from({ length: perk.maxTier }, (_, tierIndex) => (
                         <span
                             key={tierIndex}
                             className={`h-1.5 w-3 border ${tierIndex < perk.tier ? (isLegendary ? 'border-amber-300 bg-amber-300' : isRare ? 'border-violet-300 bg-violet-300' : 'border-emerald-300 bg-emerald-300') : 'border-white/10 bg-white/[0.03]'}`}
                         />
                     ))}
                 </div>
            </div>
            <h4 className="screens-perk-title font-display text-lg font-bold leading-tight text-white transition-colors">{perk.name}</h4>
            <p className="screens-perk-description text-sm text-slate-400 leading-relaxed">
                {perk.description}
            </p>
            {isLegendary && (
                <div className="screens-perk-legend text-[9px] text-amber-300 font-bold uppercase tracking-[0.2em]">
                    {stripLeadingGlyph(UI.legendary_drop)}
                </div>
            )}
        </button>
      );
  };

  const renderGenreCard = (genreId: StoryGenreId, index: number) => {
      const pack = getGenrePack(genreId);
      return (
        <button
            key={genreId}
            type="button"
            onClick={() => handleGenreSelect(genreId)}
            className="screens-cut-card screens-world-card group relative min-h-[286px] overflow-hidden border bg-[#0b101a] text-left h-full transition-all focus-visible:outline-none"
            style={{
                borderColor: `${pack.accent}55`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 24px ${pack.accent}0c`
            }}
        >
            <div className="screens-card-art-frame screens-card-banner screens-world-card-banner">
                <EmblemTile
                    src={`/assets/worlds/${genreId}.png`}
                    size={68}
                    fallback={<GenreIcon genre={genreId} className="h-7 w-7" />}
                    className="screens-card-art border bg-black/20"
                    style={{ width: '100%', height: '100%', borderColor: `${pack.accent}44`, color: pack.accent }}
                />
            </div>
            <div className="screens-world-heading flex min-w-0 items-start gap-3">
                <span className="keycap shrink-0 opacity-70 group-hover:opacity-100">{index + 1}</span>
                <div className="min-w-0">
                    <h4 className="font-display text-lg font-bold" style={{ color: pack.accent }}>{pack.name[language]}</h4>
                    <p className="text-[9px] mt-1 uppercase tracking-[0.18em] text-slate-500">{pack.ui.mainTitle[language]}</p>
                </div>
            </div>
            <p className="screens-world-description text-sm text-slate-400 leading-relaxed">{pack.tagline[language]}</p>
            <p className="screens-world-goal text-[11px] text-slate-500 border-t border-white/[0.06] pt-3">{pack.ui.campaignGoal[language]}</p>
        </button>
      );
  };

  return (
    <div className="screens-app-shell min-h-screen bg-[#070a11] text-slate-200 flex flex-col md:flex-row font-mono overflow-hidden">
      <div className="screens-living-backdrop" aria-hidden="true">
        <span className="screens-ambient-blob screens-ambient-blob-emerald" />
        <span className="screens-ambient-blob screens-ambient-blob-indigo" />
        <span className="screens-vignette" />
      </div>
      <div className="screens-deck-frame" aria-hidden="true">
        <span className="screens-deck-corner screens-deck-corner-tl" />
        <span className="screens-deck-corner screens-deck-corner-tr" />
        <span className="screens-deck-corner screens-deck-corner-bl" />
        <span className="screens-deck-corner screens-deck-corner-br" />
      </div>

      {deathSequenceActive && (
        <div className="screens-death-sequence" role="alert" aria-live="assertive">
          <div className="screens-death-flash" aria-hidden="true" />
          <svg className="screens-death-crack" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M51 48 L44 34 L46 23 L38 7" />
            <path d="M49 49 L34 44 L24 36 L4 31" />
            <path d="M49 51 L36 61 L29 75 L14 92" />
            <path d="M52 49 L66 37 L77 34 L96 18" />
            <path d="M52 51 L68 57 L77 70 L94 82" />
            <path d="M50 50 L55 66 L52 81 L58 100" />
            <path d="M44 34 L34 27 L29 13 M66 37 L68 22 L78 9 M36 61 L20 60 L8 68 M68 57 L84 52 L100 54" />
          </svg>
          <div className="screens-death-copy">
            <span>{UI.signal_lost}</span>
            <small>ERR // LINK_SEVERED</small>
          </div>
        </div>
      )}
      
      {/* Sidebar — operator console */}
      <aside className={`relative z-10 w-full md:w-1/3 lg:w-1/4 flex-col h-[30vh] md:h-screen bg-gradient-to-b from-[#0b101a] to-[#070a11] border-r border-white/[0.06] ${inSimulation ? 'hidden md:flex' : 'flex'}`}>
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
              <p className="mt-1.5 text-[9px] uppercase tracking-[0.22em] text-slate-500 truncate">
                {inSimulation ? genrePack.ui.mainTitle[language] : UI.subtitle}
              </p>
            </div>
          </div>

          {inSimulation && (
            <div
              className="inline-flex items-center gap-2 self-start px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-widest uppercase"
              style={{ borderColor: `${genrePack.accent}66`, color: genrePack.accent, background: `${genrePack.accent}14` }}
              title={language === 'ru' ? 'Активная симуляция за стеклом пульта' : 'Active simulation behind the operator glass'}
            >
              <GenreIcon genre={selectedGenre} className="h-3.5 w-3.5" />
              <span>{UI.sim_badge}</span>
              <span className="opacity-70">//</span>
              <span>{genrePack.name[language]}</span>
            </div>
          )}

          {/* Status panel */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-[9px] uppercase tracking-[0.22em] text-slate-500">{UI.wallet}</div>
                <div className="font-display mt-1 text-2xl font-bold tabular-nums text-white leading-none">
                  {Math.floor(userProfile.credits || 0)}<span className="text-sm text-emerald-400 ml-1 align-baseline">{UI.currency_suffix}</span>
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
            <span>{musicActive ? stripLeadingGlyph(UI.audio_active) : UI.audio_muted}</span>
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

      <div className={`relative z-10 w-full md:w-2/3 lg:w-3/4 flex flex-col md:h-screen overflow-hidden ${inSimulation ? 'h-[100dvh]' : ''}`}>
        <div className="absolute inset-0 opacity-5 pointer-events-none"
             style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        </div>

        <div className="flex-1 min-h-0 flex items-center justify-center p-2 sm:p-6 relative z-10">
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
                        {incomingChallenge && (
                            <div className={`screens-cut-card border p-4 text-left ${isCurrentChallenge ? 'border-amber-400/35 bg-amber-400/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
                                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-300">{UI.challenge_title}</div>
                                {isCurrentChallenge ? (
                                    <div className="mt-2 flex items-center justify-between gap-4">
                                        <div><span className="text-[10px] text-slate-500">{UI.challenge_target}</span><strong className="block text-2xl text-white tabular-nums">{incomingChallenge.targetScore}</strong></div>
                                        <button type="button" onClick={initializeDailySession} disabled={dailyAttemptsExhausted} className="btn-cyber btn-cyber-primary px-4 py-2.5 text-[10px] font-bold text-[#04120b]">{UI.challenge_accept}</button>
                                    </div>
                                ) : <p className="mt-2 text-xs leading-relaxed text-slate-400">{UI.challenge_expired}</p>}
                            </div>
                        )}
                        {runCheckpoint && (
                            <button
                                onClick={resumeSession}
                                className="btn-cyber btn-cyber-primary px-8 py-4 font-display font-bold tracking-[0.06em] text-[#04120b] flex items-center justify-center gap-3"
                            >
                                <span className="keycap">R</span>
                                <span>{UI.resume_run} · {UI.resume_sector} {runCheckpoint.nextLevel}</span>
                            </button>
                        )}
                        <button
                            onClick={initializeSession}
                            className={`${runCheckpoint ? 'btn-cyber btn-cyber-ghost text-emerald-200' : 'btn-cyber btn-cyber-primary text-[#04120b]'} px-8 py-4 font-display font-bold tracking-[0.06em] flex items-center justify-center gap-3`}
                        >
                            <span className="keycap">1</span>
                            <span>{stripKeyHint(UI.init_link)}</span>
                        </button>
                        <p className="px-3 text-[10px] leading-relaxed text-slate-500">{UI.quick_session}</p>
                        <button
                            onClick={initializeDailySession}
                            disabled={dailyAttemptsExhausted}
                            className="screens-daily-button btn-cyber btn-cyber-ghost group px-8 py-3.5 font-display font-bold text-emerald-200 hover:text-white transition-colors flex items-center justify-center gap-3"
                        >
                            <span className="keycap">3</span>
                            <EmblemTile
                                src={`/assets/worlds/${dailyBrief.genre}.png`}
                                size={28}
                                className="border bg-black/20"
                                style={{ borderColor: `${dailyGenrePack.accent}44` }}
                            />
                            <span className="flex min-w-0 flex-col items-start text-left">
                                <span className="tracking-[0.06em]">{UI.daily_sector}</span>
                                {dailyAttemptsExhausted ? (
                                    <>
                                        <span className="mt-1 max-w-full truncate font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-300/75 tabular-nums">
                                            {UI.daily_best}: {dailyState.bestScore} · {dailyState.bestEnding || UI.daily_severed}
                                        </span>
                                        <span className="mt-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-slate-500">
                                            {UI.daily_tomorrow}
                                        </span>
                                    </>
                                ) : (
                                    <span className="mt-1 max-w-full truncate font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-300/75 tabular-nums">
                                        {dailyGenrePack.name[language]} · {dailyAttemptsLeft}/{DAILY_MAX_ATTEMPTS} {UI.daily_left}
                                    </span>
                                )}
                            </span>
                        </button>
                        <button
                            onClick={() => setGameState(GameState.BLACK_MARKET)}
                            className="btn-cyber btn-cyber-ghost px-8 py-3.5 font-display font-bold tracking-[0.06em] text-emerald-200 hover:text-white transition-colors flex items-center justify-center gap-3"
                        >
                            <span className="keycap">2</span>
                            <span>{stripKeyHint(UI.black_market)}</span>
                        </button>
                        <button
                            onClick={() => setGameState(GameState.OPERATOR_RECORD)}
                            className="btn-cyber btn-cyber-ghost px-8 py-3.5 font-display font-bold tracking-[0.06em] text-sky-200 hover:text-white transition-colors flex items-center justify-center gap-3"
                        >
                            <span className="keycap">4</span>
                            <span>{stripKeyHint(UI.operator_record)}</span>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleToggleStrictCase}
                        aria-pressed={!!userProfile.strictCase}
                        className="mx-auto flex items-center gap-3 rounded-lg border bg-white/[0.02] px-4 py-2 transition-colors"
                        style={{ borderColor: userProfile.strictCase ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.1)' }}
                    >
                        <span className={`relative h-4 w-7 rounded-full transition-colors ${userProfile.strictCase ? 'bg-amber-400/80' : 'bg-white/15'}`}>
                            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all duration-200 ${userProfile.strictCase ? 'left-3.5' : 'left-0.5'}`}></span>
                        </span>
                        <span className="text-left">
                            <span className={`block text-[11px] font-bold uppercase tracking-[0.16em] ${userProfile.strictCase ? 'text-amber-300' : 'text-slate-400'}`}>{UI.perfectionist}</span>
                            <span className="block text-[9px] text-slate-500 tracking-wide">{UI.perfectionist_desc}</span>
                        </span>
                    </button>

                    <p className="text-[11px] leading-relaxed text-slate-500 max-w-sm mx-auto">
                        <span className="text-emerald-400/80">◆</span> {UI.accuracy_hook}
                    </p>

                    <div className="text-[11px] text-slate-600 pt-2">
                        {UI.powered_by}
                    </div>
                    <div className="text-[9px] leading-relaxed text-slate-700">
                        {UI.privacy_note}
                    </div>
                </div>
            )}

            {gameState === GameState.CALIBRATION && (
                <CalibrationPanel
                    language={language}
                    mode={calibrationModeRef.current}
                    drillPrompt={buildTargetedDrill(language, typingTraining)}
                    onComplete={finishCalibration}
                    onSkip={skipCalibration}
                />
            )}

            {gameState === GameState.OPERATOR_RECORD && (
                <OperatorRecord
                    language={language}
                    progress={playerProgress}
                    training={typingTraining}
                    onClose={() => setGameState(GameState.MENU)}
                    onRecalibrate={recalibrate}
                    onStartDrill={startTargetedDrill}
                />
            )}

            {gameState === GameState.BLACK_MARKET && (
                <div className="screens-cut-panel w-full max-w-5xl h-[80vh] bg-[#0b101a]/95 border border-white/[0.07] flex flex-col overflow-hidden animate-fade-in-up shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                    <div className="p-6 border-b border-white/[0.06] bg-white/[0.015] flex justify-between items-end gap-6">
                        <div>
                            <h2 className="font-display text-3xl font-bold text-white tracking-tight">{UI.market_title}</h2>
                            <p className="text-slate-500 text-sm mt-1">{UI.market_subtitle}</p>
                        </div>
                        <div className="text-right">
                            <div className="text-[9px] text-slate-500 uppercase tracking-[0.2em]">{UI.avail_credits}</div>
                            <div className="font-display text-4xl font-bold text-white tabular-nums leading-none mt-1">{Math.floor(userProfile.credits)} <span className="text-sm text-emerald-400">{UI.currency_suffix}</span></div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(Object.entries(META_UPGRADES) as [UpgradeId, typeof META_UPGRADES.synapticWeave][]).map(([key, def], idx) => {
                            const currentLvl = userProfile.upgrades[key];
                            const nextCost = Math.floor(def.baseCost * (1 + (currentLvl * 0.5)));
                            const isMaxed = currentLvl >= def.maxLevel;
                            const canAfford = userProfile.credits >= nextCost;
                            const copy = hubSkin.upgrades[key];
                            return (
                                <div key={key} className="screens-cut-card screens-upgrade-card bg-[#0b101a] border border-white/[0.07] relative overflow-hidden group hover:border-emerald-400/25 transition-colors min-h-[210px]">
                                    <div className="screens-card-art-frame screens-upgrade-art-rail">
                                        <EmblemTile
                                            src={`/assets/upgrades/${key}.png`}
                                            size={56}
                                            className="screens-card-art border-0 bg-black/20"
                                            style={{ width: '100%', height: '100%' }}
                                        />
                                    </div>
                                    <span className="keycap absolute top-3 right-3 opacity-60 group-hover:opacity-100">{idx + 1}</span>
                                    <div className="screens-upgrade-content">
                                        <div className="screens-upgrade-heading mb-3 pr-9">
                                            <h3 className="min-w-0 font-display text-lg font-bold text-slate-100 leading-tight">{copy.name[language]}</h3>
                                            <div className="flex shrink-0 gap-1 pt-1" aria-label={`${UI.level} ${currentLvl}/${def.maxLevel}`}>
                                                {Array.from({ length: 10 }, (_, levelIndex) => (
                                                    <span key={levelIndex} className={`h-2 w-2 border ${levelIndex < Math.round((currentLvl / def.maxLevel) * 10) ? 'border-emerald-300 bg-emerald-300 shadow-[0_0_5px_rgba(52,211,153,0.35)]' : 'border-white/10 bg-white/[0.025]'}`} />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-slate-400 text-sm mb-5 flex-1">{copy.desc[language]}</p>
                                        <div className="screens-upgrade-footer flex flex-col items-start gap-3 mt-auto">
                                            <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                                                {UI.effect}: <span className="text-emerald-400">{describeUpgradeEffect(key, currentLvl)}</span>
                                            </div>
                                            {isMaxed ? (
                                                <button disabled className="btn-cyber btn-cyber-ghost self-end px-4 py-2 text-[10px] font-bold tracking-[0.14em] text-slate-600 cursor-not-allowed opacity-50">
                                                    {UI.maxed_out}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleBuyUpgrade(key)}
                                                    disabled={!canAfford}
                                                    className={`btn-cyber btn-cyber-ghost self-end px-4 py-2 text-[10px] font-bold tracking-[0.12em] flex items-center gap-2 transition-all ${canAfford ? 'text-emerald-200 hover:text-white hover:shadow-[0_0_22px_rgba(52,211,153,0.12)]' : 'text-slate-600 cursor-not-allowed opacity-45'}`}
                                                >
                                                    <span>{UI.install}</span>
                                                    <span className={canAfford ? 'text-emerald-400 tabular-nums' : 'tabular-nums'}>{nextCost} {UI.currency_suffix}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="absolute bottom-0 left-0 h-px bg-emerald-500/10 w-full">
                                        <div className="h-full bg-emerald-400 transition-all duration-500 shadow-[0_0_7px_rgba(52,211,153,0.55)]" style={{ width: `${(currentLvl / def.maxLevel) * 100}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="p-4 border-t border-white/[0.06] bg-black/10 flex flex-col items-center gap-3">
                        <p className="text-[11px] text-slate-600 text-center max-w-xl">{UI.genre_persists_note}</p>
                        <button 
                            onClick={() => setGameState(GameState.MENU)}
                            className="btn-cyber btn-cyber-ghost px-6 py-2 text-slate-400 hover:text-white transition-colors uppercase tracking-[0.16em] text-[10px] font-bold flex items-center gap-2"
                        >
                            <span className="keycap">ESC</span>
                            <span>{stripKeyHint(UI.return_menu)}</span>
                        </button>
                    </div>
                </div>
            )}

            {gameState === GameState.GENRE_SELECTION && (
                <div className="screens-cut-panel w-full max-w-4xl max-h-[calc(100vh-3rem)] bg-[#0b101a]/95 border border-white/[0.07] p-8 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.4)] animate-fade-in-up flex flex-col overflow-hidden">
                    <div className="shrink-0 border-b border-white/[0.06] pb-5 mb-6 text-center">
                        <h2 className="font-display text-3xl font-bold text-white mb-2 tracking-tight">{UI.genre_title}</h2>
                        <p className="text-slate-400 text-sm">{UI.genre_subtitle}</p>
                        <p className="text-slate-600 text-[10px] uppercase tracking-[0.14em] mt-3">{UI.genre_persists_note}</p>
                    </div>
                    <div className="min-h-0 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4 pr-1">
                        {GENRE_ORDER.map((genreId, index) => renderGenreCard(genreId, index))}
                    </div>
                    <button
                        type="button"
                        onClick={() => setGameState(GameState.MENU)}
                        className="btn-cyber btn-cyber-ghost mt-6 shrink-0 w-full py-2.5 text-slate-500 hover:text-white transition-colors uppercase tracking-[0.16em] text-[10px] font-bold flex items-center justify-center gap-2"
                    >
                        <span className="keycap">ESC</span>
                        <span>{stripKeyHint(UI.genre_back)}</span>
                    </button>
                </div>
            )}

            {gameState === GameState.STARTER_PERK_SELECTION && (
                 <div className="screens-cut-panel w-full max-w-4xl max-h-[calc(100vh-3rem)] overflow-y-auto bg-[#0b101a]/95 border border-white/[0.07] p-8 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.4)] animate-fade-in-up">
                    <div className="border-b border-white/[0.06] pb-5 mb-6 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 border text-[9px] font-bold tracking-[0.2em] uppercase screens-cut-chip"
                             style={{ borderColor: `${genrePack.accent}66`, color: genrePack.accent, background: `${genrePack.accent}14` }}>
                            <GenreIcon genre={selectedGenre} className="h-3.5 w-3.5" />
                            <span>{UI.sim_badge}</span>
                            <span className="opacity-70">//</span>
                            <span>{genrePack.name[language]}</span>
                        </div>
                        <h2 className="font-display text-3xl font-bold text-white mb-2 tracking-tight">{UI.loadout_title}</h2>
                        <p className="text-slate-400 text-sm">{UI.loadout_subtitle}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {offeredPerks.map((perk, index) => renderPerkCard(perk, index, true))}
                    </div>
                 </div>
            )}

            {gameState === GameState.LEVEL_COMPLETE && lastLevelReport && (
                <div className="screens-cut-panel w-full max-w-4xl max-h-[calc(100vh-3rem)] overflow-y-auto bg-[#0b101a]/95 border border-white/[0.07] p-8 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.4)] animate-fade-in-up">
                    <div className="border-b border-white/[0.06] pb-5 mb-6">
                        <div className="flex justify-between items-start mb-2">
                            <h2 className="font-display text-3xl font-bold text-white">{UI.seq_complete}</h2>
                            <div className="text-right">
                                <span className="text-[9px] text-slate-500 uppercase tracking-[0.2em] block">{UI.xp_gained}</span>
                                <span className="font-display text-2xl font-bold text-emerald-300 tabular-nums">+{levelXpGained} XP</span>
                            </div>
                        </div>
                        <p className="text-slate-300 text-base leading-relaxed italic">
                            "{lastLevelReport.narrativeSummary}"
                        </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
                        <div className="screens-stat-tile p-4 text-center border border-white/[0.07] bg-white/[0.02]">
                            <div className="font-display text-3xl font-bold text-white tabular-nums leading-none">{Math.round(lastLevelReport.avgWpm)}</div>
                            <div className="mt-2 text-[9px] text-slate-500 uppercase tracking-[0.18em]">{UI.avg_speed} · {UI.wpm}</div>
                        </div>
                        <div className="screens-stat-tile p-4 text-center border border-white/[0.07] bg-white/[0.02]">
                             <div className="font-display text-3xl font-bold text-white tabular-nums leading-none">+{lastLevelReport.creditsEarned}</div>
                             <div className="mt-2 text-[9px] text-slate-500 uppercase tracking-[0.18em]">{UI.credits}</div>
                        </div>
                        <div className="screens-stat-tile p-4 text-center border border-amber-400/15 bg-amber-400/[0.025]">
                             <div className="font-display text-3xl font-bold text-amber-300 tabular-nums leading-none">{Math.round(lastLevelReport.mission?.heat ?? campaignState.heat)}%</div>
                             <div className="mt-2 text-[9px] text-slate-500 uppercase tracking-[0.18em]">{UI.heat}</div>
                        </div>
                        <div className="screens-stat-tile p-4 text-center border border-white/[0.07] bg-white/[0.02]">
                             <div className="font-display text-3xl font-bold text-white tabular-nums leading-none">{lastLevelReport.finalHealth}</div>
                             <div className="mt-2 text-[9px] text-slate-500 uppercase tracking-[0.18em]">{UI.health}</div>
                        </div>
                        <div className="screens-stat-tile p-4 text-center border border-emerald-400/15 bg-emerald-400/[0.025]">
                             <div className="font-display text-3xl font-bold text-emerald-300 tabular-nums leading-none">{lastLevelReport.mission?.evidence ?? campaignState.evidence}</div>
                             <div className="mt-2 text-[9px] text-slate-500 uppercase tracking-[0.18em]">{UI.evidence}</div>
                        </div>
                        <div className="screens-stat-tile p-4 text-center border border-sky-400/15 bg-sky-400/[0.025]">
                             <div className="font-display text-3xl font-bold text-sky-300 tabular-nums leading-none">{lastLevelReport.mission?.trust ?? campaignState.trust}</div>
                             <div className="mt-2 text-[9px] text-slate-500 uppercase tracking-[0.18em]">{UI.trust}</div>
                        </div>
                        <div className="screens-stat-tile p-4 text-center border border-emerald-400/15 bg-emerald-400/[0.025]">
                            <div className="font-display text-3xl font-bold text-emerald-300 tabular-nums leading-none">{Math.round(lastLevelReport.accuracy ?? 100)}%</div>
                            <div className="mt-2 text-[9px] text-slate-500 uppercase tracking-[0.18em]">{UI.accuracy}</div>
                        </div>
                        <div className="screens-stat-tile p-4 text-center border border-violet-400/15 bg-violet-400/[0.025]">
                            <div className="font-display text-3xl font-bold text-violet-300 tabular-nums leading-none">{Math.round(lastLevelReport.consistency ?? 100)}%</div>
                            <div className="mt-2 text-[9px] text-slate-500 uppercase tracking-[0.18em]">{UI.consistency}</div>
                        </div>
                    </div>
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h3 className="font-display text-lg font-bold text-white tracking-[0.04em]">{UI.select_upgrade}</h3>
                            <p className="mt-1 text-[10px] text-slate-500">{UI.continue_hint}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleBankExit}
                            disabled={!isSectorSummaryReady}
                            className="btn-cyber btn-cyber-ghost px-5 py-2.5 text-[10px] font-bold tracking-[0.12em] text-slate-300 hover:text-white disabled:cursor-wait disabled:opacity-45"
                        >
                            {UI.bank_exit}
                        </button>
                    </div>
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
                    genre={selectedGenre}
                    strictCase={!!userProfile.strictCase}
                    deterministicStory={isDailyRun}
                    onTypingObservation={(observation) => runTrainingObservationsRef.current.push(observation)}
                />
            )}

            {gameState === GameState.VICTORY && victoryReport && (
                <div className="screens-cut-panel w-full max-w-3xl bg-[#0b101a]/95 p-10 border border-emerald-400/35 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_60px_rgba(16,185,129,0.12)] animate-fade-in-up">
                    <div className="text-center border-b border-white/[0.07] pb-6 mb-6">
                        <div className="screens-cut-chip inline-block px-3 py-1 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[9px] uppercase tracking-[0.2em] mb-4">
                            {genrePack.ui.victoryTitle[language]}
                        </div>
                        <h2 className="font-display text-4xl font-bold text-white mb-3 tracking-tight">{victoryReport.endingTitle}</h2>
                        <p className="text-slate-300 text-lg italic">"{victoryReport.narrativeSummary}"</p>
                        <p className="text-slate-500 text-sm mt-3">{UI.victory_subtitle}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
                        <div className="screens-stat-tile p-4 text-center border border-emerald-400/15 bg-emerald-400/[0.025]"><div className="font-display text-3xl font-bold text-emerald-300 tabular-nums leading-none">{victoryReport.mission?.evidence ?? campaignState.evidence}</div><div className="mt-2 text-[9px] text-slate-500 uppercase tracking-[0.18em]">{UI.evidence}</div></div>
                        <div className="screens-stat-tile p-4 text-center border border-amber-400/15 bg-amber-400/[0.025]"><div className="font-display text-3xl font-bold text-amber-300 tabular-nums leading-none">{victoryReport.mission?.heat ?? campaignState.heat}%</div><div className="mt-2 text-[9px] text-slate-500 uppercase tracking-[0.18em]">{UI.heat}</div></div>
                        <div className="screens-stat-tile p-4 text-center border border-sky-400/15 bg-sky-400/[0.025]"><div className="font-display text-3xl font-bold text-sky-300 tabular-nums leading-none">{victoryReport.mission?.trust ?? campaignState.trust}</div><div className="mt-2 text-[9px] text-slate-500 uppercase tracking-[0.18em]">{UI.trust}</div></div>
                        <div className="screens-stat-tile p-4 text-center border border-white/[0.07] bg-white/[0.02]"><div className="font-display text-xl font-bold text-white uppercase leading-tight">{victoryReport.route}</div><div className="mt-2 text-[9px] text-slate-500 uppercase tracking-[0.18em]">{UI.route}</div></div>
                    </div>
                    <div className="screens-cut-card bg-black/20 border border-white/[0.07] p-4 mb-6">
                        <div className="text-[9px] text-slate-500 uppercase tracking-[0.2em] mb-3">{UI.operation_dossier}</div>
                        <div className="space-y-1 text-sm text-slate-400">
                            {(victoryReport.mission?.consequenceLog || campaignState.consequenceLog).slice(0, 4).map((line, index) => (
                                <div key={index} className="border-l border-emerald-500/30 pl-3">{line}</div>
                            ))}
                        </div>
                    </div>
                    {challengeVerdict && incomingChallenge && (
                        <div className={`screens-cut-card mb-6 flex items-center justify-between gap-4 border p-4 ${challengeVerdict.outcome === 'beaten' ? 'border-emerald-400/35 bg-emerald-400/[0.06]' : 'border-amber-400/35 bg-amber-400/[0.06]'}`}>
                            <div>
                                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">{challengeVerdictLabel}</div>
                                <div className="mt-1 text-xs text-slate-400">
                                    {challengeVerdict.outcome === 'tied'
                                        ? (language === 'ru' ? 'Точно в цель — попробуй ещё раз и выйди вперёд.' : 'Exactly on target — run it again to take the lead.')
                                        : `${Math.abs(challengeVerdict.delta)} ${language === 'ru' ? (challengeVerdict.delta > 0 ? 'очков сверху' : 'очков не хватило') : (challengeVerdict.delta > 0 ? 'points ahead' : 'points short')}`}
                                </div>
                            </div>
                            <div className="flex gap-5 text-right">
                                <div><span className="block text-[8px] uppercase tracking-[0.16em] text-slate-500">{UI.challenge_target}</span><strong className="text-xl text-white tabular-nums">{incomingChallenge.targetScore}</strong></div>
                                <div><span className="block text-[8px] uppercase tracking-[0.16em] text-slate-500">{UI.challenge_you}</span><strong className="text-xl text-emerald-300 tabular-nums">{completedChallengeScore}</strong></div>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-3">
                        {isDailyRun && currentDailyId && (
                            <button
                                onClick={() => shareDailyChallenge('victory', totalScore)}
                                className="btn-cyber btn-cyber-ghost flex-1 py-3.5 font-display font-bold tracking-[0.06em] text-amber-200 hover:text-white transition-colors"
                            >
                                {challengeShareStatus ? UI.challenge_copied : UI.challenge_share}
                            </button>
                        )}
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
                            className="btn-cyber btn-cyber-primary flex-1 py-3.5 font-display font-bold tracking-[0.06em] text-[#04120b] flex items-center justify-center gap-3"
                        >
                            <span className="keycap">SPACE</span>
                            <span>{stripKeyHint(UI.new_run)}</span>
                        </button>
                    </div>
                </div>
            )}

            {gameState === GameState.GAME_OVER && (
                <div className="screens-cut-panel screens-death-report bg-[#0b101a]/95 p-6 sm:p-8 border border-rose-500/40 backdrop-blur-xl max-w-3xl w-full shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_60px_rgba(244,63,94,0.12)] animate-fade-in-up">
                    <div className="text-center">
                        <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-rose-400/70">{UI.typing_debrief}</div>
                        <h2 className="mt-2 font-display text-4xl sm:text-5xl font-bold text-rose-500 tracking-tight">{UI.critical_failure}</h2>
                        <p className="mt-3 text-sm text-slate-400">{genrePack.ui.connectionSevered[language]}</p>
                    </div>

                    <div className="screens-debrief-grid mt-6" aria-label={UI.typing_debrief}>
                        <div className="screens-debrief-primary">
                            <strong>{Math.round(finalStats?.wpm || 0)}</strong>
                            <span>{UI.avg_speed} · {UI.wpm}</span>
                            <small>{language === 'ru' ? `Пик ${Math.round(finalStats?.bestWpm || 0)} СЛ/М` : `Peak ${Math.round(finalStats?.bestWpm || 0)} WPM`}</small>
                        </div>
                        <div className="screens-debrief-metric">
                            <strong>{Math.round(finalStats?.accuracy ?? 100)}%</strong>
                            <span>{UI.accuracy}</span>
                        </div>
                        <div className="screens-debrief-metric">
                            <strong>{finalStats?.mistakes || 0}</strong>
                            <span>{UI.mistakes}</span>
                        </div>
                        <div className="screens-debrief-metric">
                            <strong>{(finalStats?.segments || 0) > 1 ? `${Math.round(finalStats?.consistency ?? 100)}%` : '—'}</strong>
                            <span>{UI.consistency}</span>
                        </div>
                    </div>

                    <div className="screens-next-drill mt-4">
                        <span>{UI.next_drill}</span>
                        <p>{typingCoachText}</p>
                    </div>

                    {challengeVerdict && incomingChallenge && (
                        <div className={`screens-cut-card mt-4 flex items-center justify-between gap-4 border p-4 ${challengeVerdict.outcome === 'beaten' ? 'border-emerald-400/35 bg-emerald-400/[0.06]' : 'border-amber-400/35 bg-amber-400/[0.06]'}`}>
                            <div>
                                <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-300">{challengeVerdictLabel}</div>
                                <div className="mt-1 text-xs text-slate-400">
                                    {challengeVerdict.outcome === 'tied'
                                        ? (language === 'ru' ? 'Точно в цель — попробуй ещё раз и выйди вперёд.' : 'Exactly on target — run it again to take the lead.')
                                        : `${Math.abs(challengeVerdict.delta)} ${language === 'ru' ? (challengeVerdict.delta > 0 ? 'очков сверху' : 'очков не хватило') : (challengeVerdict.delta > 0 ? 'points ahead' : 'points short')}`}
                                </div>
                            </div>
                            <div className="flex gap-5 text-right">
                                <div><span className="block text-[8px] uppercase tracking-[0.16em] text-slate-500">{UI.challenge_target}</span><strong className="text-xl text-white tabular-nums">{incomingChallenge.targetScore}</strong></div>
                                <div><span className="block text-[8px] uppercase tracking-[0.16em] text-slate-500">{UI.challenge_you}</span><strong className="text-xl text-rose-200 tabular-nums">{completedChallengeScore}</strong></div>
                            </div>
                        </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-y border-white/[0.06] py-3 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                        <span>{UI.reached}: <b className="text-slate-200">{UI.level} {finalStats?.level || 1}</b></span>
                        <span>{UI.score}: <b className="text-slate-200">{finalStats?.score || 0}</b></span>
                        <span>{UI.characters_typed}: <b className="text-slate-200">{finalStats?.characters || 0}</b></span>
                        <span>{UI.evidence}: <b className="text-emerald-300">{finalStats?.mission?.evidence ?? campaignState.evidence}</b></span>
                        <span>{UI.heat}: <b className="text-amber-300">{finalStats?.mission?.heat ?? campaignState.heat}%</b></span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        {isDailyRun && currentDailyId && (
                            <button
                                onClick={() => shareDailyChallenge('defeat', Math.max(totalScore, finalStats?.score || 0))}
                                className="btn-cyber btn-cyber-ghost flex-1 py-3.5 font-display font-bold tracking-[0.06em] text-amber-200 hover:text-white transition-colors"
                            >
                                {challengeShareStatus ? UI.challenge_copied : UI.challenge_share}
                            </button>
                        )}
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
                            className="btn-cyber btn-cyber-danger flex-1 py-3.5 font-display font-bold tracking-[0.06em] text-rose-200 hover:text-white transition-colors flex items-center justify-center gap-3"
                        >
                            <span className="keycap">SPACE</span>
                            <span>{stripKeyHint(UI.main_menu)}</span>
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
            title={genrePack.ui.mainTitle[language]}
            endingTitle={data.endingTitle}
            outcome={data.outcome}
            tagline={data.tagline}
            stats={data.stats}
            shareText={data.shareText}
            dailyLabel={isDailyRun && currentDailyDateLabel ? `${UI.daily_sector} · ${currentDailyDateLabel}` : undefined}
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
