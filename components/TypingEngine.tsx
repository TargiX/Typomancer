import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { StorySegment, BranchingStory, GameStats, StoryMood, GameModifiers, SegmentType, DecisionPoint, Language, MissionState, DecisionImpact, ComicFrame, StoryGenreId } from '../types';
import {
  generateNextSegments,
  generateSceneImage,
  generateStrategicDecision,
  getDeterministicStoryBranch,
  getDeterministicStrategicDecision
} from '../services/geminiService';
import { audioEngine } from '../services/audioEngine';
import {
  DECISION_ROUND,
  SECTOR_ROUNDS,
  calculateSegmentCredits,
  calculateSegmentScore,
  getCursorSkillStack,
  getReadyActiveSkills,
  getTypingAccuracy,
  isLowHealth
} from '../services/gameRules';
import { captureProductEvent, getDeviceClass } from '../services/productAnalytics';
import type { TypingObservation } from '../services/typingTraining';

const CRACK_PATHS = [
    "M 10,10 L 30,30 L 25,45", 
    "M 90,10 L 70,25 L 75,40", 
    "M 50,5 L 50,25 L 40,35",  
    "M 10,90 L 25,75 L 15,60", 
    "M 95,95 L 80,80 L 85,65", 
    "M 30,50 L 45,55 L 40,65 L 50,70", 
    "M 70,50 L 55,55 L 60,65 L 50,70", 
    "M 50,50 L 60,40 L 70,45 L 80,30", 
    "M 50,50 L 40,40 L 30,45 L 20,30", 
    "M 0,0 L 100,100 M 100,0 L 0,100" 
];

const SHAKE_CLASSES = ['shake-mild', 'shake-medium', 'shake-heavy'];

interface Debris {
  id: string; 
  left: number;
  size: number;
  delay: number;
  color: string;
}

interface Spark {
  id: string;
  left: number;
  top: number;
  tx: string;
  ty: string;
  size: number;
  color: string;
}

interface DeltaPopup {
  id: string;
  label: string;
  value: number;
  suffix: string;
  color: string;
  left: number; // percent within the scene
}

interface TypingEngineProps {
  initialSegment: StorySegment;
  currentLevel: number; 
  currentRoundHealth: number; 
  modifiers: GameModifiers; 
  onGameOver: (finalStats: GameStats) => void;
  addToLog: (text: string, performance: 'good' | 'average' | 'bad' | 'neutral', score: number, wpm: number, mistakes: number, meta?: string, type?: SegmentType) => void;
  fullHistory: string[]; 
  characterDescription: string;
  stealthLevel: number; 
  onLevelComplete: (stats: GameStats, tracePercent: number, missionState: MissionState) => void;
  prevLevelSummary?: string; 
  language: Language;
  missionSeed: MissionState;
  onMissionUpdate?: (missionState: MissionState) => void;
  onCaptureFrame?: (frame: ComicFrame) => void;
  genre: StoryGenreId;
  strictCase?: boolean;
  deterministicStory?: boolean;
  onTypingObservation?: (observation: TypingObservation) => void;
}

const TYPE_CUE_MS = 1500;
const SKILL_BRIEFING_STORAGE_KEY = 'narrativeFlowSkillBriefingSeen';

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const normalizeMissionState = (mission?: MissionState): MissionState => ({
  heat: mission?.heat ?? 18,
  trust: mission?.trust ?? 44,
  evidence: mission?.evidence ?? 0,
  corruption: mission?.corruption ?? 0,
  signal: mission?.signal ?? 55,
  route: mission?.route ?? 'balanced',
  flags: mission?.flags ? [...mission.flags] : [],
  consequenceLog: mission?.consequenceLog ? [...mission.consequenceLog] : [],
  lastDecision: mission?.lastDecision
});

const skillIcon: Record<string, string> = {
  flow: '≈',
  precision: '⌖',
  symbols: '</>',
  numbers: '#',
  punctuation: '“,”'
};

const normalizeTypingChar = (char: string) => {
  if ('«»“”„‟'.includes(char)) return '"';
  if ('‘’‚‛'.includes(char)) return "'";
  if ('—–−'.includes(char)) return '-';
  if (char === 'ё') return 'е';
  if (char === 'Ё') return 'Е';
  if (char === ' ') return ' ';
  return char;
};

// By default typing is case-insensitive so the player never needs Shift/CapsLock.
// Perfectionist mode (strict=true) demands exact case for a bigger XP reward.
// Smart-quote / dash / ё normalization always applies (fairness, not difficulty).
const charsMatch = (typed: string, expected: string, strict = false) => {
  if (typed === expected) return true;
  const nt = normalizeTypingChar(typed);
  const ne = normalizeTypingChar(expected);
  if (nt === ne) return true;
  if (strict) return false;
  return nt.toLowerCase() === ne.toLowerCase();
};

const TypingEngine: React.FC<TypingEngineProps> = ({ 
    initialSegment, 
    currentLevel,
    modifiers,
    onGameOver, 
    addToLog, 
    characterDescription,
    stealthLevel,
    onLevelComplete,
    prevLevelSummary,
    fullHistory,
    currentRoundHealth,
    language,
    missionSeed,
    onMissionUpdate,
    onCaptureFrame,
    genre,
    strictCase = false,
    deterministicStory = false,
    onTypingObservation
}) => {
  const [history, setHistory] = useState<StorySegment[]>([]);
  const [activeSegment, setActiveSegment] = useState<StorySegment>(initialSegment);
  const [nextBranch, setNextBranch] = useState<BranchingStory | null>(null);
  const [nextDecision, setNextDecision] = useState<DecisionPoint | null>(null);
  const [isDecisionActive, setIsDecisionActive] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const currentImageRef = useRef<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [debris, setDebris] = useState<Debris[]>([]);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [showFlash, setShowFlash] = useState(false);
  const [isCriticalHack, setIsCriticalHack] = useState(false); 
  const [overclockCharge, setOverclockCharge] = useState(0);
  const [isOverclockActive, setIsOverclockActive] = useState(false);
  const overclockTimerRef = useRef<number | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isWaitingForAi, setIsWaitingForAi] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [mistakesInSegment, setMistakesInSegment] = useState(0);
  const [currentWPM, setCurrentWPM] = useState(0); 
  const [health, setHealth] = useState(currentRoundHealth); 
  const [credits, setCredits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboPulse, setComboPulse] = useState(0);
  const [deltaPopups, setDeltaPopups] = useState<DeltaPopup[]>([]);
  const [typeCueActive, setTypeCueActive] = useState(true);
  // Remember WHICH segment got the TYPE cue (not a boolean) — StrictMode re-runs the
  // effect for the same segment, and a plain flag would cancel the cue instantly.
  const typeCueShownRef = useRef<StorySegment | null>(null);
  const deltaCounter = useRef(0);
  const [round, setRound] = useState(1);
  const [totalWPM, setTotalWPM] = useState(0);
  const [tracePercent, setTracePercent] = useState(0);
  const [missionState, setMissionState] = useState<MissionState>(() => normalizeMissionState(missionSeed));
  const missionRef = useRef<MissionState>(normalizeMissionState(missionSeed));
  const timerRef = useRef<number | null>(null);
  const debrisCounter = useRef(0);
  const sparkCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLSpanElement>(null); 
  const cursorRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusHintPos, setFocusHintPos] = useState<{ left: number; top: number } | null>(null);
  const transitionLockRef = useRef(false); 
  const gameOverTriggeredRef = useRef(false);
  const forgivenMistakesRef = useRef(0);
  const forgivenIndicesRef = useRef<Set<number>>(new Set());
  // Active-skill: Firewall grants a stock of "shield" charges that soak the next
  // mistakes (persists across segments until spent). Purge Trace is instant.
  const firewallGraceRef = useRef(0);
  const [firewallGrace, setFirewallGrace] = useState(0);
  const [showSkillBriefing, setShowSkillBriefing] = useState(() => {
    try {
      return window.localStorage.getItem(SKILL_BRIEFING_STORAGE_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const skipTypeCueRef = useRef(false);
  const trackedReadySkillsRef = useRef<Set<string>>(new Set());
  const lastKeystrokeAtRef = useRef<number | null>(null);

  useEffect(() => {
      lastKeystrokeAtRef.current = null;
  }, [activeSegment]);

  const captureSkillEvent = (event: 'typomancer_skill_became_ready' | 'typomancer_skill_used', skill: string) => {
      captureProductEvent(event, {
          language,
          device_class: getDeviceClass(typeof window !== 'undefined' ? window.innerWidth : 1280),
          skill,
          level: currentLevel
      });
  };

  // Operator deck chrome — always cyberpunk (Animus frame). Genre only changes the story feed.
  const T = {
      en: {
          overclock_active: "FOCUS MODE ACTIVE",
          tactical_intervention: "TACTICAL INTERVENTION REQUIRED",
          aggressive: "AGGRESSIVE",
          stealth: "STEALTH",
          press_1: "Press [1] to Commit",
          press_2: "Press [2] to Commit",
          critical_override: "CRITICAL OVERRIDE",
          hp: "HP",
          level: "LEVEL",
          round: "ROUND",
          credits: "CREDITS",
          wpm: "WPM",
          chg: "FOCUS",
          security: "SECURITY TRACE",
          err: "ERR",
          init_visual: "INITIALIZING VISUAL FEED...",
          breach_init: ">> BREACH_PROTOCOL_INITIATED // EXACT_INPUT_REQUIRED",
          dialog_init: "DIALOGUE CHANNEL // PUNCTUATION MATTERS",
          signal_init: "SIGNAL DECODE // NUMBERS AND SYMBOLS",
          objective: "OBJECTIVE",
          heat: "HEAT",
          trust: "TRUST",
          evidence: "EVIDENCE",
          corruption: "CORRUPTION",
          route: "ROUTE",
          consequence: "CONSEQUENCE",
          clean: "clean",
          messy: "messy",
          compromised: "compromised",
          focus_ready: "TAB ⚡ FOCUS",
          focus_title: "Type correctly to build Focus. Press TAB when full.",
          skill_focus: "FOCUS — pause trace, soften mistakes, 2x rewards (TAB, full Energy)",
          skill_firewall: "FIREWALL — shield the next 3 mistakes (costs Energy)",
          skill_purge: "PURGE TRACE — instantly cut Security Trace by 25% (costs Energy)",
          skills_title: "ACTIVE PROTOCOLS",
          skills_intro: "Clean typing charges Energy. Spend it without leaving the typing line.",
          skill_focus_short: "Pause trace · soften mistakes · 2x rewards",
          skill_firewall_short: "Shield the next 3 mistakes",
          skill_purge_short: "Cut Security Trace by 25%",
          shield_active: "SHIELD",
          skill_briefing_start: "GOT IT · START TYPING",
          route_balanced: "BALANCED",
          route_silent: "SILENT",
          route_loud: "LOUD",
          type_cue: "TYPE",
          type_subcue: "BEGIN INPUT"
      },
      ru: {
          overclock_active: "ФОКУС-МОД АКТИВЕН",
          tactical_intervention: "ТРЕБУЕТСЯ ТАКТИЧЕСКОЕ ВМЕШАТЕЛЬСТВО",
          aggressive: "АГРЕССИЯ",
          stealth: "СКРЫТНОСТЬ",
          press_1: "Нажмите [1] для подтверждения",
          press_2: "Нажмите [2] для подтверждения",
          critical_override: "КРИТИЧЕСКИЙ ВЗЛОМ",
          hp: "ОЗ",
          level: "УРОВЕНЬ",
          round: "РАУНД",
          credits: "КРЕДИТЫ",
          wpm: "СЛ/М",
          chg: "ФОКУС",
          security: "ТРАССИРОВКА",
          err: "ОШБ",
          init_visual: "ИНИЦИАЛИЗАЦИЯ ВИЗУАЛЬНОГО ПОТОКА...",
          breach_init: ">> ПРОТОКОЛ_ВЗЛОМА // НУЖЕН ТОЧНЫЙ ВВОД",
          dialog_init: "КАНАЛ ДИАЛОГА // ВАЖНА ПУНКТУАЦИЯ",
          signal_init: "ДЕКОД СИГНАЛА // ЧИСЛА И СИМВОЛЫ",
          objective: "ЦЕЛЬ",
          heat: "УГРОЗА",
          trust: "ДОВЕРИЕ",
          evidence: "УЛИКИ",
          corruption: "КОРРУПЦИЯ",
          route: "МАРШРУТ",
          consequence: "ПОСЛЕДСТВИЕ",
          clean: "чисто",
          messy: "грязно",
          compromised: "скомпрометировано",
          focus_ready: "TAB ⚡ ФОКУС",
          focus_title: "Печатай верно, чтобы зарядить Фокус. Нажми TAB при полном заряде.",
          skill_focus: "ФОКУС — пауза трассы, мягче ошибки, x2 награды (TAB, вся Energy)",
          skill_firewall: "FIREWALL — щит на следующие 3 ошибки (тратит Energy)",
          skill_purge: "СБРОС ТРАССЫ — мгновенно −25% к трассировке (тратит Energy)",
          skills_title: "АКТИВНЫЕ ПРОТОКОЛЫ",
          skills_intro: "Точная печать заряжает Energy. Трать её, не отрывая взгляд от строки.",
          skill_focus_short: "Пауза трассы · мягче ошибки · x2 награды",
          skill_firewall_short: "Щит на следующие 3 ошибки",
          skill_purge_short: "Снизить трассировку на 25%",
          shield_active: "ЩИТ",
          skill_briefing_start: "ПОНЯТНО · НАЧАТЬ ПЕЧАТЬ",
          route_balanced: "БАЛАНС",
          route_silent: "ТИХО",
          route_loud: "ГРОМКО",
          type_cue: "TYPE",
          type_subcue: "НАЧИНАЙ ВВОД"
      }
  };

  const UI = T[language];

  const dismissSkillBriefing = () => {
      try {
          window.localStorage.setItem(SKILL_BRIEFING_STORAGE_KEY, '1');
      } catch {
          // Storage can be unavailable in privacy-restricted browser contexts.
      }
      skipTypeCueRef.current = true;
      setShowSkillBriefing(false);
      setStartTime(Date.now());
      window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
      const normalized = normalizeMissionState(missionSeed);
      missionRef.current = normalized;
      setMissionState(normalized);
  }, [currentLevel]);

  useEffect(() => {
      missionRef.current = missionState;
      onMissionUpdate?.(missionState);
  }, [missionState, onMissionUpdate]);

  useEffect(() => {
      if (showSkillBriefing) {
          setTypeCueActive(false);
          return;
      }
      if (skipTypeCueRef.current) {
          skipTypeCueRef.current = false;
          typeCueShownRef.current = activeSegment;
          setTypeCueActive(false);
          setStartTime(Date.now());
          inputRef.current?.focus();
          return;
      }
      // Show the TYPE cue only once — on the first segment of the level. Repeating
      // it on every segment interrupts the flow and blocks input for 1.5s each round.
      if (typeCueShownRef.current && typeCueShownRef.current !== activeSegment) {
          setTypeCueActive(false);
          setStartTime(Date.now());
          inputRef.current?.focus();
          return;
      }
      typeCueShownRef.current = activeSegment;
      setTypeCueActive(true);
      inputRef.current?.focus();
      const cueTimer = window.setTimeout(() => {
          setTypeCueActive(false);
          setStartTime(Date.now());
          inputRef.current?.focus();
      }, TYPE_CUE_MS);
      return () => window.clearTimeout(cueTimer);
  }, [activeSegment, showSkillBriefing]);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeydown = (e: KeyboardEvent) => {
        if (showSkillBriefing) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dismissSkillBriefing();
            }
            return;
        }
        if (e.key === 'Tab') {
            e.preventDefault(); 
            if (!isOverclockActive && overclockCharge >= modifiers.maxOverclock) {
                activateOverclock();
            }
            return;
        }
        if (!isDecisionActive && e.key === 'ArrowUp') {
            e.preventDefault();
            useFirewall();
            return;
        }
        if (!isDecisionActive && e.key === 'ArrowDown') {
            e.preventDefault();
            usePurgeTrace();
            return;
        }
        if (isDecisionActive && nextDecision) {
            if (e.key === '1') handleDecisionSelect(0);
            if (e.key === '2') handleDecisionSelect(1);
            return;
        }
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
        if (isWaitingForAi || transitionLockRef.current || isCriticalHack) return;

        if (e.key === 'Backspace') {
            e.preventDefault();
            applyInputValue(inputValue.slice(0, -1));
            return;
        }

        if (e.key.length === 1 && inputValue.length < activeSegment.text.length) {
            e.preventDefault();
            applyInputValue(inputValue + e.key);
        }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [
    overclockCharge,
    isOverclockActive,
    isDecisionActive,
    nextDecision,
    modifiers,
    inputValue,
    activeSegment,
    isWaitingForAi,
    isCriticalHack,
    mistakesInSegment,
    health,
    showSkillBriefing
  ]);

  const activateOverclock = () => {
      if (isOverclockActive || overclockCharge < modifiers.maxOverclock) return;
      captureSkillEvent('typomancer_skill_used', 'focus');
      setIsOverclockActive(true);
      setOverclockCharge(0);
      if (overclockTimerRef.current) clearTimeout(overclockTimerRef.current);
      overclockTimerRef.current = window.setTimeout(() => {
          setIsOverclockActive(false);
      }, modifiers.focusDurationMs);
  };

  // Active skills share the Energy bar (overclockCharge). Focus costs the full bar;
  // the instant skills cost a fraction, so you choose what to spend Energy on.
  const skillCost = (fraction: number) => Math.round(modifiers.maxOverclock * fraction);
  const FIREWALL_COST = () => skillCost(0.4);
  const PURGE_COST = () => skillCost(0.55);

  const useFirewall = () => {
      const cost = FIREWALL_COST();
      if (isOverclockActive || isDecisionActive || overclockCharge < cost) return;
      captureSkillEvent('typomancer_skill_used', 'firewall');
      setOverclockCharge(c => Math.max(0, c - cost));
      firewallGraceRef.current += 3;
      setFirewallGrace(firewallGraceRef.current);
      triggerShieldEffect();
      inputRef.current?.focus();
  };

  const usePurgeTrace = () => {
      const cost = PURGE_COST();
      if (isOverclockActive || isDecisionActive || overclockCharge < cost) return;
      captureSkillEvent('typomancer_skill_used', 'purge');
      setOverclockCharge(c => Math.max(0, c - cost));
      setTracePercent(p => clamp(p - 25));
      inputRef.current?.focus();
  };

  useEffect(() => {
      const readySkills = getReadyActiveSkills(overclockCharge, modifiers.maxOverclock, isOverclockActive);
      for (const skill of readySkills) {
          const key = `${currentLevel}:${skill}`;
          if (trackedReadySkillsRef.current.has(key)) continue;
          trackedReadySkillsRef.current.add(key);
          captureSkillEvent('typomancer_skill_became_ready', skill);
      }
  }, [currentLevel, isOverclockActive, modifiers.maxOverclock, overclockCharge]);

  useLayoutEffect(() => {
    if (activeRef.current) {
        activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (textContainerRef.current) {
        textContainerRef.current.scrollTop = textContainerRef.current.scrollHeight;
    }

    const hasContextualSkill = firewallGrace > 0 || getCursorSkillStack(overclockCharge, modifiers.maxOverclock, isOverclockActive).length > 0;
    if (hasContextualSkill && cursorRef.current) {
        const rect = cursorRef.current.getBoundingClientRect();
        setFocusHintPos({ left: rect.left + rect.width / 2, top: rect.top - 6 });
    } else {
        setFocusHintPos(null);
    }
  }, [inputValue, activeSegment, isWaitingForAi, history, mistakesInSegment, overclockCharge, isOverclockActive, modifiers.maxOverclock, firewallGrace]);

  useEffect(() => {
    let isMounted = true;
    const fetchImage = async () => {
        setIsImageLoading(true);
        const isStoryBeat = round === 1 || round === DECISION_ROUND + 1 || round === SECTOR_ROUNDS;
        const base64 = await generateSceneImage(activeSegment.text, characterDescription, genre, isStoryBeat);
        if (isMounted && base64) { setCurrentImage(base64); currentImageRef.current = base64; }
        if (isMounted) setIsImageLoading(false);
    };
    fetchImage();
    return () => { isMounted = false; };
  }, [activeSegment, characterDescription, genre, round]);

  useEffect(() => {
    if (isWaitingForAi || transitionLockRef.current || isDecisionActive || typeCueActive) return;
    if (isOverclockActive) return;

    const BASE_INCREMENT = 0.065; 
    const stealthDivisor = 1 + (stealthLevel * 0.1);
    const missionPressure = 1 + (missionRef.current.heat / 140) + (missionRef.current.corruption / 200) - (missionRef.current.trust / 320);
    const segmentPressure = 1 + ((activeSegment.pressure || 0) * 0.06);
    const perkMultiplier = modifiers.traceSpeedMultiplier * Math.max(0.45, missionPressure) * segmentPressure; 

    timerRef.current = window.setInterval(() => {
        setTracePercent(prev => {
            const increment = (BASE_INCREMENT * perkMultiplier) / stealthDivisor;
            const newVal = prev + increment;
            audioEngine.setIntensity(newVal);
            if (newVal >= 100) {
                clearInterval(timerRef.current!);
                return 100;
            }
            return newVal;
        });
        const chars = inputValue.length;
        const timeMin = (Date.now() - startTime) / 1000 / 60;
        if (timeMin > 0 && chars > 0) {
            setCurrentWPM(Math.round((chars / 5) / timeMin));
        }
    }, 100);

    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isWaitingForAi, transitionLockRef.current, stealthLevel, modifiers.traceSpeedMultiplier, inputValue.length, startTime, isOverclockActive, isDecisionActive, activeSegment.pressure, typeCueActive]); 

  useEffect(() => {
    let isMounted = true;
    const bufferNext = async () => {
      setNextBranch(null); 
      setNextDecision(null);
      setIsWaitingForAi(false);
      const context = [...fullHistory, ...history.map(h => h.text), activeSegment.text];
      let nextRound = round + 1;
      let nextLevel = currentLevel;
      if (round >= SECTOR_ROUNDS) return;
      try {
        if (nextRound === DECISION_ROUND) {
             const decision = deterministicStory
               ? getDeterministicStrategicDecision(genre, language, currentLevel, missionRef.current)
               : await generateStrategicDecision(context, currentLevel, language, missionRef.current, genre);
             if (isMounted) setNextDecision(decision);
        } else {
             const branch = deterministicStory
               ? getDeterministicStoryBranch(genre, nextLevel, nextRound, language, missionRef.current)
               : await generateNextSegments(context, nextLevel, nextRound, language, prevLevelSummary, missionRef.current, genre);
             if (isMounted) setNextBranch(branch);
        }
      } catch (e) {
        console.error("Critical Buffering Error", e);
      }
    };
    bufferNext();
    return () => { isMounted = false; };
  }, [activeSegment, history, currentLevel, round, prevLevelSummary, language, genre, deterministicStory]);

  useEffect(() => {
      if (inputValue.length === 0 && !transitionLockRef.current && round <= SECTOR_ROUNDS && !isCriticalHack && !isDecisionActive && !typeCueActive) {
          if (!deterministicStory && Math.random() < modifiers.criticalHackChance) {
             performCriticalHack(); 
          }
      }
  }, [activeSegment, round, isDecisionActive, typeCueActive]);

  const performCriticalHack = () => {
      setIsCriticalHack(true);
      let i = 0;
      const target = activeSegment.text;
      const interval = setInterval(() => {
          i += 3;
          if (i >= target.length) {
              i = target.length;
              clearInterval(interval);
              setInputValue(target);
              setTimeout(() => {
                  setIsCriticalHack(false);
              }, 500);
          } else {
              setInputValue(target.substring(0, i));
          }
      }, 30);
  };

  const describeImpact = (impact?: DecisionImpact): string => {
      if (!impact) return '';
      const parts: string[] = [];
      const fmt = (label: string, value?: number, suffix = '') => {
          if (!value) return;
          parts.push(`${label} ${value > 0 ? '+' : ''}${value}${suffix}`);
      };
      fmt(UI.heat, impact.heat, '%');
      fmt(UI.trust, impact.trust);
      fmt(UI.evidence, impact.evidence);
      fmt(UI.corruption, impact.corruption);
      fmt(UI.security, impact.trace, '%');
      fmt(UI.hp, impact.health);
      fmt(UI.credits, impact.credits);
      return parts.join(' · ');
  };

  const routeLabel = (route = missionRef.current.route) => {
      if (route === 'silent') return UI.route_silent;
      if (route === 'loud') return UI.route_loud;
      return UI.route_balanced;
  };

  const comboMultiplier = combo >= 50 ? 3 : combo >= 25 ? 2 : combo >= 10 ? 1.5 : 1;

  const comboAccent = () => {
    if (combo >= 50) return { text: 'text-emerald-200', glow: 'rgba(52,211,153,0.95)' };
    if (combo >= 25) return { text: 'text-emerald-300', glow: 'rgba(52,211,153,0.82)' };
    if (combo >= 10) return { text: 'text-emerald-400', glow: 'rgba(52,211,153,0.68)' };
    return { text: 'text-slate-200', glow: 'rgba(148,163,184,0.5)' };
  };

  const spawnDelta = (label: string, value: number, color: string, suffix = '') => {
    if (!value) return;
    deltaCounter.current += 1;
    const popup: DeltaPopup = {
      id: `delta-${deltaCounter.current}-${label}`,
      label,
      value,
      suffix,
      color,
      left: 10 + ((deltaCounter.current * 23) % 70)
    };
    setDeltaPopups(prev => [...prev, popup]);
    setTimeout(() => {
      setDeltaPopups(prev => prev.filter(p => p.id !== popup.id));
    }, 1900);
  };

  // Scene atmosphere driven by mission meters: hostile heat/corruption tints the
  // frame red/violet, a calm clean run cools it toward emerald. This is the
  // "consequences you can feel" layer over the generated art.
  const atmosphere = () => {
    const heat = missionState.heat;
    const corruption = missionState.corruption;
    if (corruption >= 45) return { color: 'rgba(126,34,206,0.32)', label: 'compromised' };
    if (heat >= 70) return { color: 'rgba(220,38,38,0.34)', label: 'burning' };
    if (heat >= 50) return { color: 'rgba(234,88,12,0.22)', label: 'hot' };
    if (heat <= 28 && missionState.trust >= 50) return { color: 'rgba(16,185,129,0.20)', label: 'ghost' };
    return { color: 'rgba(2,6,23,0.0)', label: 'balanced' };
  };

  const commitMission = (impact: DecisionImpact, note: string, decisionId?: string): MissionState => {
      const prev = missionRef.current;
      const next: MissionState = {
          ...prev,
          heat: clamp(prev.heat + (impact.heat || 0)),
          trust: clamp(prev.trust + (impact.trust || 0)),
          evidence: clamp(prev.evidence + (impact.evidence || 0)),
          corruption: clamp(prev.corruption + (impact.corruption || 0)),
          signal: clamp(prev.signal + (impact.signal || 0)),
          route: impact.route || prev.route,
          flags: impact.flag && !prev.flags.includes(impact.flag) ? [...prev.flags, impact.flag] : prev.flags,
          consequenceLog: [note, ...prev.consequenceLog].slice(0, 7),
          lastDecision: decisionId || prev.lastDecision
      };
      missionRef.current = next;
      setMissionState(next);
      return next;
  };

  const applyDecisionImpact = (impact: DecisionImpact | undefined, choiceText: string, choiceId: string) => {
      const safeImpact = impact || {};
      const meta = describeImpact(safeImpact);
      const note = language === 'ru'
          ? `Решение: ${choiceText}${meta ? ` (${meta})` : ''}`
          : `Decision: ${choiceText}${meta ? ` (${meta})` : ''}`;
      commitMission(safeImpact, note, choiceId);
      if (safeImpact.trace) setTracePercent(p => clamp(p + safeImpact.trace!));
      if (safeImpact.health) setHealth(h => clamp(h + safeImpact.health!, 0, modifiers.maxHealth));
      if (safeImpact.credits) setCredits(c => c + safeImpact.credits!);
      spawnDelta(UI.evidence, safeImpact.evidence || 0, '#34d399');
      spawnDelta(UI.heat, safeImpact.heat || 0, '#fbbf24', '%');
      spawnDelta(UI.trust, safeImpact.trust || 0, '#38bdf8');
      return meta;
  };

  const getErrorReport = () => {
      let uncorrectedTypos = 0;
      let forgivenTypos = 0;
      inputValue.split('').forEach((char, i) => {
          if (!charsMatch(char, activeSegment.text[i], strictCase)) {
              if (forgivenIndicesRef.current.has(i)) forgivenTypos += 1;
              else uncorrectedTypos += 1;
          }
      });
      return {
          uncorrectedTypos,
          forgivenTypos,
          // Every non-forgiven typo is already counted when the key is pressed.
          // Remaining wrong characters describe the current buffer; adding them again
          // would double-charge both the branch result and the typing debrief.
          totalErrors: mistakesInSegment
      };
  };

  const applySegmentOutcome = (
      performance: 'good' | 'average' | 'bad',
      totalErrors: number,
      wpm: number,
      segment: StorySegment
  ) => {
      const isBreach = segment.type === SegmentType.BREACH;
      const isDialog = segment.type === SegmentType.DIALOG;
      const isSignal = segment.type === SegmentType.SIGNAL;
      let evidenceDelta = 0;
      let heatDelta = 0;
      let trustDelta = 0;
      let corruptionDelta = 0;
      let signalDelta = 0;
      let traceDelta = 0;
      const pressure = segment.pressure || 1;

      if (performance === 'good') {
          evidenceDelta = Math.ceil((isBreach ? 5 : isSignal ? 4 : isDialog ? 3 : 2) * modifiers.evidenceMultiplier);
          heatDelta = -3 - (isBreach ? 2 : 0);
          trustDelta = isDialog ? 3 : 1;
          signalDelta = 2;
          traceDelta = isBreach ? -14 : -5;
      } else if (performance === 'average') {
          evidenceDelta = Math.ceil((isBreach ? 2 : 1) * modifiers.evidenceMultiplier);
          heatDelta = 2 + pressure;
          trustDelta = isDialog ? -1 : 0;
          corruptionDelta = 1;
          signalDelta = -1;
          traceDelta = isBreach ? -4 : 2;
      } else {
          evidenceDelta = isBreach ? 1 : 0;
          heatDelta = 6 + Math.min(10, totalErrors) + pressure;
          trustDelta = -3;
          corruptionDelta = 3 + Math.floor(totalErrors / 2);
          signalDelta = -5;
          traceDelta = 8 + pressure;
      }

      if (wpm >= 70 && totalErrors <= 1) {
          trustDelta += 1;
          evidenceDelta += 1;
      }

      const meta = `${UI.evidence} ${evidenceDelta >= 0 ? '+' : ''}${evidenceDelta} · ${UI.heat} ${heatDelta >= 0 ? '+' : ''}${heatDelta}% · ${UI.trust} ${trustDelta >= 0 ? '+' : ''}${trustDelta}`;
      const note = language === 'ru'
          ? `${performance === 'good' ? 'Чистый' : performance === 'average' ? 'Шумный' : 'Сорванный'} сегмент: ${meta}`
          : `${performance === 'good' ? 'Clean' : performance === 'average' ? 'Messy' : 'Compromised'} segment: ${meta}`;
      commitMission({ heat: heatDelta, trust: trustDelta, evidence: evidenceDelta, corruption: corruptionDelta, signal: signalDelta }, note);
      setTracePercent(p => clamp(p + traceDelta));

      spawnDelta(UI.evidence, evidenceDelta, '#34d399');
      spawnDelta(UI.heat, heatDelta, '#fbbf24', '%');
      spawnDelta(UI.trust, trustDelta, '#38bdf8');
      if (corruptionDelta) spawnDelta(UI.corruption, corruptionDelta, '#a78bfa');

      return { meta, evidenceDelta, heatDelta, traceDelta };
  };


  const applyInputValue = (val: string) => {
    if (isCriticalHack || isDecisionActive) return;
    if (typeCueActive) {
      setTypeCueActive(false);
      setStartTime(Date.now());
      inputRef.current?.focus();
    }
    if (val.length > activeSegment.text.length) return;
    // Typing is the game mechanic: reject paste, drop, autofill, and scripted
    // multi-character insertion instead of awarding a whole line for one event.
    if (val.length > inputValue.length + 1) return;
    if (val.length === inputValue.length + 1 && !val.startsWith(inputValue)) return;
    if (inputValue.length === 0 && val.length > 0) setStartTime(Date.now());
    const charIndex = val.length - 1;

    if (charIndex >= 0 && val.length > inputValue.length) {
       const expectedChar = activeSegment.text[charIndex];
       const typedChar = val[charIndex];
       const keyTime = Date.now();
       onTypingObservation?.({
         expected: expectedChar,
         previousExpected: charIndex > 0 ? activeSegment.text[charIndex - 1] : undefined,
         correct: charsMatch(typedChar, expectedChar, strictCase),
         latencyMs: lastKeystrokeAtRef.current === null ? 0 : keyTime - lastKeystrokeAtRef.current
       });
       lastKeystrokeAtRef.current = keyTime;

       if (!charsMatch(typedChar, expectedChar, strictCase)) {
         // Firewall shield charges soak mistakes first (persist across segments).
         if (firewallGraceRef.current > 0) {
             firewallGraceRef.current -= 1;
             setFirewallGrace(firewallGraceRef.current);
             forgivenIndicesRef.current.add(charIndex);
             triggerShieldEffect();
             setInputValue(val);
             return;
         }
         const forgivenessBudget = modifiers.mistakeGraceCount + (isOverclockActive ? modifiers.focusMistakeForgiveness : 0);
         if (forgivenMistakesRef.current < forgivenessBudget) {
             forgivenMistakesRef.current += 1;
             forgivenIndicesRef.current.add(charIndex);
             triggerShieldEffect();
         } else {
             const newMistakes = mistakesInSegment + 1;
             setMistakesInSegment(newMistakes);
             setCombo(0);
             setOverclockCharge(c => Math.min(modifiers.maxOverclock, Math.max(0, c - 5 + modifiers.errorChargeGain)));
             const newHealth = Math.max(0, health - 1);
             setHealth(newHealth);
             triggerImpact(newMistakes);
             if (newHealth <= 0 || newMistakes >= 10) {
                triggerGameOver(newHealth, newMistakes);
                return;
             }
         }
       } else {
           setCombo(c => c + 1);
           setComboPulse(p => p + 1);
           if (!isOverclockActive) {
               setOverclockCharge(c => Math.min(modifiers.maxOverclock, c + 1));
           } else {
               spawnOverclockSparkBurst(charIndex);
           }
       }
    } 
    else if (val.length < inputValue.length) {
         for (const idx of forgivenIndicesRef.current) {
             if (idx >= val.length) {
                 forgivenIndicesRef.current.delete(idx);
             }
         }
    }
    setInputValue(val);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyInputValue(e.target.value);
  };

  const handleDecisionSelect = (index: number) => {
      if (!nextDecision) return;
      const choice = nextDecision.options[index];
      const meta = applyDecisionImpact(choice.impact, choice.text, choice.id || choice.type);
      addToLog(`[DECISION] ${nextDecision.introText}`, 'neutral', 0, 0, 0, choice.preview || meta);
      addToLog(`> ${choice.text}`, 'neutral', 0, 0, 0, meta, choice.outcome.type);
      setIsDecisionActive(false);
      setRound(r => r + 1);
      setActiveSegment(choice.outcome);
      setInputValue('');
      setMistakesInSegment(0);
      forgivenMistakesRef.current = 0;
      forgivenIndicesRef.current.clear();
      setStartTime(Date.now());
      setTimeout(() => {
          transitionLockRef.current = false;
          inputRef.current?.focus();
      }, 50);
  };

  const spawnOverclockSparkBurst = (charIndex: number) => {
      const charEl = document.querySelector(`span[data-index="${charIndex}"]`);
      if (!charEl) return;
      const rect = charEl.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const count = 6 + Math.floor(Math.random() * 3);
      const newSparks: Spark[] = [];
      for (let i = 0; i < count; i++) {
          sparkCounter.current += 1;
          const angle = Math.random() * Math.PI * 2;
          const dist = 30 + Math.random() * 50; 
          newSparks.push({
              id: `spk-${Date.now()}-${sparkCounter.current}`,
              left: centerX,
              top: centerY,
              tx: `${Math.cos(angle) * dist}px`,
              ty: `${Math.sin(angle) * dist}px`,
              size: 2 + Math.random() * 4,
              color: Math.random() > 0.5 ? '#34d399' : '#ffffff'
          });
      }
      setSparks(prev => [...prev, ...newSparks]);
      setTimeout(() => {
          setSparks(prev => prev.filter(s => !newSparks.find(ns => ns.id === s.id)));
      }, 600);
  };

  const triggerShieldEffect = () => {
      if (containerRef.current) {
          containerRef.current.classList.add('shadow-[inset_0_0_20px_rgba(52,211,153,0.5)]');
          setTimeout(() => {
              containerRef.current?.classList.remove('shadow-[inset_0_0_20px_rgba(52,211,153,0.5)]');
          }, 200);
      }
  };

  const triggerGameOver = (finalHealth: number, totalErrorsOverride?: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (overclockTimerRef.current) clearTimeout(overclockTimerRef.current);
    const { totalErrors: recordedErrors } = getErrorReport();
    const totalErrors = totalErrorsOverride ?? recordedErrors;
    const typedCharacters = inputValue.length + (totalErrorsOverride === undefined ? 0 : 1);
    onGameOver({
        wpm: Math.round((totalWPM + currentWPM) / Math.max(1, round)),
        accuracy: getTypingAccuracy(totalErrors, typedCharacters),
        health: finalHealth,
        level: currentLevel,
        round,
        score: 0,
        credits: Math.floor(credits),
        mistakes: totalErrors,
        characters: typedCharacters,
        mission: missionRef.current
    });
  };

  useEffect(() => {
    if (tracePercent < 100 || gameOverTriggeredRef.current) return;
    gameOverTriggeredRef.current = true;
    triggerGameOver(0);
  }, [tracePercent]);

  const triggerImpact = (currentMistakes: number) => {
    let intensity = 'shake-mild';
    if (currentMistakes >= 4) intensity = 'shake-medium';
    if (currentMistakes >= 7) intensity = 'shake-heavy';
    if (containerRef.current) {
        containerRef.current.classList.remove(...SHAKE_CLASSES);
        void containerRef.current.offsetWidth; 
        containerRef.current.classList.add(intensity);
        setTimeout(() => {
            if (containerRef.current) containerRef.current.classList.remove(intensity);
        }, 500);
    }
    setShowFlash(false);
    setTimeout(() => setShowFlash(true), 10);
    setTimeout(() => setShowFlash(false), 210);
    spawnDebris(currentMistakes);
  };

  const spawnDebris = (severity: number) => {
      const count = 5 + Math.floor(severity * 1.5); 
      const newDebris: Debris[] = [];
      for(let i=0; i<count; i++) {
          debrisCounter.current += 1;
          newDebris.push({
              id: `deb-${Date.now()}-${debrisCounter.current}`,
              left: 5 + Math.random() * 90, 
              size: 2 + Math.random() * 6, 
              delay: Math.random() * 0.1,
              color: Math.random() > 0.6 ? '#cbd5e1' : '#94a3b8' 
          });
      }
      setDebris(prev => [...prev, ...newDebris]);
      setTimeout(() => {
          setDebris(prev => prev.filter(d => !newDebris.includes(d)));
      }, 1000);
  };

  useEffect(() => {
    const isTypingComplete = inputValue.length === activeSegment.text.length;
    if (isTypingComplete && !transitionLockRef.current && !isDecisionActive) {
        if (nextDecision && round + 1 === DECISION_ROUND) {
             transitionLockRef.current = true;
             setTimeout(() => {
                 setIsDecisionActive(true);
             }, 200);
        } else if (nextBranch || round >= SECTOR_ROUNDS) {
            transitionLockRef.current = true;
            setTimeout(() => {
                if (round >= SECTOR_ROUNDS) {
                    finalizeLevel(nextBranch);
                } else {
                    advanceStory(nextBranch!);
                }
            }, 200);
        } else {
            setIsWaitingForAi(true);
        }
    }
  }, [inputValue, activeSegment, nextBranch, nextDecision, round, isDecisionActive]); 

  const advanceStory = (branch: BranchingStory) => {
    const durationSec = (Date.now() - startTime) / 1000;
    const wpm = Math.round((activeSegment.text.length / 5) / (durationSec / 60 || 0.01));
    setTotalWPM(prev => prev + wpm);
    const { totalErrors } = getErrorReport();
    const segmentScore = calculateSegmentScore({
      errors: totalErrors,
      type: activeSegment.type,
      wpm,
      overclock: isOverclockActive,
      breachMultiplier: modifiers.breachRewardMultiplier
    });
    const segmentCredits = calculateSegmentCredits({
      errors: totalErrors,
      type: activeSegment.type,
      overclock: isOverclockActive,
      breachMultiplier: modifiers.breachRewardMultiplier,
      creditMultiplier: modifiers.creditMultiplier
    });
    setCredits(current => current + segmentCredits);

    let healthChange = 0;
    if (totalErrors === 0) healthChange += 1;
    if (modifiers.healthRegenWpmThreshold > 0 && wpm > modifiers.healthRegenWpmThreshold) {
      healthChange += modifiers.healthRegenAmount;
    }
    if (healthChange > 0) setHealth(h => Math.min(modifiers.maxHealth, h + healthChange));

    let nextSeg: StorySegment;
    let performanceType: 'good' | 'average' | 'bad';
    if (totalErrors <= 1) {
        nextSeg = branch.goodPath;
        performanceType = 'good';
    } else if (totalErrors <= 4) {
        nextSeg = branch.mediumPath;
        performanceType = 'average';
    } else {
        nextSeg = branch.badPath;
        performanceType = 'bad';
    }

    const outcome = applySegmentOutcome(performanceType, totalErrors, wpm, activeSegment);
    addToLog(activeSegment.text, performanceType, segmentScore, wpm, totalErrors, outcome.meta, activeSegment.type);
    onCaptureFrame?.({ image: currentImageRef.current, caption: activeSegment.text, performance: performanceType, level: currentLevel });
    setHistory(prev => [...prev, { ...activeSegment, performance: performanceType }]);
    setRound(r => r + 1);
    setActiveSegment(nextSeg);
    setInputValue('');
    setMistakesInSegment(0); 
    forgivenMistakesRef.current = 0; 
    forgivenIndicesRef.current.clear(); 
    setStartTime(Date.now());
    setTimeout(() => {
        transitionLockRef.current = false;
        inputRef.current?.focus();
    }, 50);
  };

  const finalizeLevel = (branch: BranchingStory | null) => {
      const durationSec = (Date.now() - startTime) / 1000;
      const wpm = Math.round((activeSegment.text.length / 5) / (durationSec / 60 || 0.01));
      const { totalErrors } = getErrorReport();
      let performanceType: 'good' | 'average' | 'bad' = 'average';
      if (totalErrors <= 1) performanceType = 'good';
      else if (totalErrors >= 5) performanceType = 'bad';
      const score = calculateSegmentScore({
        errors: totalErrors,
        type: activeSegment.type,
        wpm,
        overclock: isOverclockActive,
        breachMultiplier: modifiers.breachRewardMultiplier
      });
      const segmentCredits = calculateSegmentCredits({
        errors: totalErrors,
        type: activeSegment.type,
        overclock: isOverclockActive,
        breachMultiplier: modifiers.breachRewardMultiplier,
        creditMultiplier: modifiers.creditMultiplier
      });
      const outcome = applySegmentOutcome(performanceType, totalErrors, wpm, activeSegment);
      addToLog(activeSegment.text, performanceType, score, wpm, totalErrors, outcome.meta, activeSegment.type);
      onCaptureFrame?.({ image: currentImageRef.current, caption: activeSegment.text, performance: performanceType, level: currentLevel });
      const stats: GameStats = {
             wpm,
             accuracy: Math.max(0, 100 - (totalErrors * 8)), 
             health,
             level: currentLevel,
             round,
             score,
             credits: Math.floor(credits + segmentCredits),
             mistakes: totalErrors,
             characters: activeSegment.text.length,
             mission: missionRef.current
        };
        onLevelComplete(stats, clamp(tracePercent + outcome.traceDelta), missionRef.current);
  };

  const renderActive = () => {
    return activeSegment.text.split('').map((char, index) => {
      // Focus mode = clarity: the UPCOMING text turns bright and crisp (easier to read
      // ahead), instead of dimming. Typed chars stay saturated so progress is obvious.
      let className = isOverclockActive ? "text-emerald-50 drop-shadow-[0_0_6px_rgba(52,211,153,0.35)]" : activeSegment.type === SegmentType.BREACH ? "text-emerald-500/60" : "text-slate-500";
      const isCursor = index === inputValue.length;
      if (index < inputValue.length) {
        if (charsMatch(inputValue[index], char, strictCase)) {
          className = isOverclockActive || activeSegment.type === SegmentType.BREACH ? "text-emerald-400" : activeSegment.type === SegmentType.DIALOG ? "text-sky-400" : activeSegment.type === SegmentType.SIGNAL ? "text-amber-400" : "text-slate-200";
        } else {
          if (forgivenIndicesRef.current.has(index)) {
             className = "text-white bg-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.45)]";
          } else {
             className = "text-white bg-rose-600";
          }
        }
      } else if (isCursor) {
        className = isCriticalHack ? "text-white bg-rose-500 animate-ping" :
                    isOverclockActive ? "text-white bg-emerald-400 animate-pulse shadow-[0_0_15px_rgba(52,211,153,0.8)]" :
                    "text-white bg-slate-700 animate-pulse";
      }
      return (
        <span key={index} ref={isCursor ? cursorRef : undefined} data-index={index} className={`${className} relative`}>
            {char}
        </span>
      );
    });
  };

  const getContainerStyles = () => {
    // Wrapper only (border/surface). Padding, scroll and text sizing live on the
    // inner scroll element so the HP/EN edge-rails can sit still (scrollbar-style).
    let base = "engine-type-panel relative flex-1 min-h-0 border-x border-b bg-[#0b101a]/95";

    // Trace effect logic
    if (tracePercent > 80) base += " shadow-[inset_0_0_50px_rgba(244,63,94,0.2)]";

    let borderColor = "border-slate-800";
    if (isOverclockActive) {
        borderColor = "border-emerald-400/70";
        // Shadow is handled by overlay now
    } else if (activeSegment.type === SegmentType.BREACH) {
        borderColor = "border-emerald-500/50";
    } else if (mistakesInSegment >= 8) {
        borderColor = "border-rose-500/80";
    } else if (mistakesInSegment >= 3) {
        borderColor = "border-rose-500/40";
    } else if (isLowHealth(health, modifiers.maxHealth)) {
        borderColor = "border-rose-900/70";
    } else {
        if (activeSegment.mood === StoryMood.DARK) borderColor = "border-rose-900/50";
        if (activeSegment.mood === StoryMood.HOPEFUL) borderColor = "border-emerald-900/50";
        if (isWaitingForAi) borderColor = "border-white/[0.08]";
    }
    return `${base} ${borderColor}`;
  };

  const getHealthColor = () => {
    const pct = (health / modifiers.maxHealth) * 100;
    if (pct > 60) return "bg-emerald-500";
    if (pct > 30) return "bg-amber-400";
    return "bg-rose-500 animate-pulse";
  };
  
  const getTraceColor = () => {
      if (isOverclockActive) return "bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.85)]";
      if (tracePercent < 50) return "bg-emerald-400";
      if (tracePercent < 80) return "bg-amber-400";
      return "bg-rose-500 animate-pulse";
  };

  const getSceneInnerGlow = () => {
    if (isOverclockActive) return "rgba(52,211,153,0.42)";
    if (mistakesInSegment >= 8) return "rgba(244,63,94,0.48)";
    if (mistakesInSegment >= 3) return "rgba(244,63,94,0.28)";
    if (isLowHealth(health, modifiers.maxHealth)) return "rgba(244,63,94,0.22)";
    if (isWaitingForAi) return "rgba(251,191,36,0.22)";
    if (activeSegment.mood === StoryMood.HOPEFUL) return "rgba(52,211,153,0.22)";
    if (activeSegment.mood === StoryMood.DARK) return "rgba(244,63,94,0.22)";
    if (activeSegment.type === SegmentType.BREACH) return "rgba(52,211,153,0.24)";
    return "rgba(7,10,17,0.2)";
  };

  return (
    <div ref={containerRef} className="w-full max-w-5xl mx-auto flex flex-col gap-0 h-full min-h-0 relative">
      {showFlash && <div className="absolute inset-0 z-[60] pointer-events-none flash-overlay"></div>}
      
      {isOverclockActive && (
           <>
               <div className="absolute inset-0 z-[5] pointer-events-none bg-emerald-950/10 backdrop-contrast-125"></div>
               <div className="absolute -top-8 right-0 z-50 pointer-events-none flex items-center gap-3 animate-fade-in-up">
                   <div className="h-px w-12 bg-gradient-to-l from-emerald-400/50 to-transparent"></div>
                   <div className="font-display text-emerald-400 font-bold text-lg animate-pulse tracking-widest drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]">
                       {UI.overclock_active}
                   </div>
               </div>
           </>
      )}

      {isDecisionActive && nextDecision && (
           <div className="engine-decision-overlay absolute inset-0 z-[80] bg-[#070a11]/95 backdrop-blur-md flex flex-col items-center justify-center p-5 md:p-8 animate-fade-in-up">
               <div className="w-full max-w-3xl space-y-8">
                   <div className="text-center border-b border-white/[0.06] pb-6">
                        <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400 animate-pulse">{UI.tactical_intervention}</div>
                        <h2 className="font-display text-2xl md:text-3xl font-bold text-white leading-relaxed">"{nextDecision.introText}"</h2>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <button type="button" className="engine-decision-card engine-decision-card--aggressive group relative p-6 bg-white/[0.02] border border-rose-500/35 hover:border-rose-400/75 transition-all cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400" onClick={() => handleDecisionSelect(0)}>
                           <h3 className="font-display text-xl font-bold text-rose-400 mb-2 group-hover:text-rose-300">{UI.aggressive}</h3>
                           <p className="text-slate-300 text-lg">"{nextDecision.options[0].text}"</p>
                           <div className="mt-4 text-xs text-rose-300/80 font-mono">{nextDecision.options[0].preview || describeImpact(nextDecision.options[0].impact)}</div>
                           <div className="mt-5 flex items-center gap-2.5 font-mono uppercase tracking-[0.18em]">
                               <span className="keycap text-lg">1</span>
                               <span className="text-[12px] text-slate-300 group-hover:text-white transition-colors">{UI.press_1.replace('[1]', '').trim()}</span>
                           </div>
                       </button>
                       <button type="button" className="engine-decision-card engine-decision-card--stealth group relative p-6 bg-white/[0.02] border border-emerald-500/35 hover:border-emerald-400/75 transition-all cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400" onClick={() => handleDecisionSelect(1)}>
                           <h3 className="font-display text-xl font-bold text-emerald-400 mb-2 group-hover:text-emerald-300">{UI.stealth}</h3>
                           <p className="text-slate-300 text-lg">"{nextDecision.options[1].text}"</p>
                           <div className="mt-4 text-xs text-emerald-300/80 font-mono">{nextDecision.options[1].preview || describeImpact(nextDecision.options[1].impact)}</div>
                           <div className="mt-5 flex items-center gap-2.5 font-mono uppercase tracking-[0.18em]">
                               <span className="keycap text-lg">2</span>
                               <span className="text-[12px] text-slate-300 group-hover:text-white transition-colors">{UI.press_2.replace('[2]', '').trim()}</span>
                           </div>
                       </button>
                   </div>
               </div>
           </div>
      )}
      {showSkillBriefing && (
          <div className="engine-skill-briefing absolute inset-0 z-[85] flex items-center justify-center p-5 md:p-8">
              <div className="engine-skill-briefing-panel w-full max-w-3xl">
                  <div className="text-center">
                      <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-cyan-300">{UI.skills_title}</div>
                      <h2 className="mt-2 font-display text-2xl md:text-3xl font-bold text-white">{UI.skills_intro}</h2>
                  </div>
                  <div className="engine-skill-briefing-grid mt-6">
                      {[
                        { key: 'TAB', name: 'FOCUS', cost: '100%', effect: UI.skill_focus_short },
                        { key: '↑', name: 'FIREWALL', cost: '40%', effect: UI.skill_firewall_short },
                        { key: '↓', name: language === 'ru' ? 'СБРОС' : 'PURGE', cost: '55%', effect: UI.skill_purge_short }
                      ].map((skill) => (
                        <div key={skill.name} className="engine-skill-briefing-card">
                            <div className="flex items-center justify-between gap-3">
                                <span className="keycap">{skill.key}</span>
                                <span className="text-[9px] uppercase tracking-[0.18em] text-cyan-300">Energy {skill.cost}</span>
                            </div>
                            <strong>{skill.name}</strong>
                            <p>{skill.effect}</p>
                        </div>
                      ))}
                  </div>
                  <button type="button" onClick={dismissSkillBriefing} className="engine-skill-briefing-start mt-6">
                      <span className="keycap">ENTER</span>
                      <span>{UI.skill_briefing_start}</span>
                  </button>
              </div>
          </div>
      )}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
          {debris.map(d => (
              <div key={d.id} className="debris rounded-sm shadow-sm" style={{ left: `${d.left}%`, top: '45%', width: `${d.size}px`, height: `${d.size}px`, backgroundColor: d.color, animationDelay: `${d.delay}s` }} />
          ))}
      </div>
      <div className="fixed inset-0 pointer-events-none z-[100]">
          {sparks.map(s => (
              <div key={s.id} className="char-particle bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]" style={{ left: `${s.left}px`, top: `${s.top}px`, width: `${s.size}px`, height: `${s.size}px`, backgroundColor: s.color, '--tx': s.tx, '--ty': s.ty } as any} />
          ))}
      </div>
      {focusHintPos && (
          <div
              className="engine-cursor-skills fixed z-[110] -translate-x-1/2 -translate-y-full"
              style={{ left: focusHintPos.left, top: focusHintPos.top }}
          >
              {firewallGrace > 0 && (
                  <span className="engine-cursor-skill engine-cursor-skill--active" aria-live="polite">
                      <span className="engine-cursor-skill-label">{UI.shield_active} ×{firewallGrace}</span>
                  </span>
              )}
              {getCursorSkillStack(overclockCharge, modifiers.maxOverclock, isOverclockActive).map((skill) => {
                  const details = skill === 'focus'
                    ? { key: 'TAB', label: 'FOCUS', effect: UI.skill_focus_short, use: activateOverclock }
                    : skill === 'firewall'
                      ? { key: '↑', label: 'FIREWALL', effect: UI.skill_firewall_short, use: useFirewall }
                      : { key: '↓', label: language === 'ru' ? 'СБРОС' : 'PURGE', effect: UI.skill_purge_short, use: usePurgeTrace };
                  const isFocus = skill === 'focus';
                  const isReady = !isOverclockActive && (
                    isFocus
                      ? overclockCharge >= modifiers.maxOverclock
                      : getReadyActiveSkills(overclockCharge, modifiers.maxOverclock).includes(skill)
                  );
                  return (
                    <button
                        key={skill}
                        type="button"
                        onClick={details.use}
                        disabled={!isReady}
                        aria-label={`${details.label}: ${details.effect}`}
                        className={`engine-cursor-skill ${isFocus ? 'engine-cursor-skill--focus' : ''} ${isOverclockActive && isFocus ? 'engine-cursor-skill--active' : isReady ? 'engine-cursor-skill--ready' : 'engine-cursor-skill--charging'}`}
                    >
                        <span className="keycap">{details.key}</span>
                        <span className="engine-cursor-skill-label">{details.label}</span>
                        <span className="engine-cursor-skill-effect" role="tooltip">{details.effect}</span>
                    </button>
                  );
              })}
          </div>
      )}
      {isCriticalHack && (
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 z-[70] pointer-events-none">
              <div className="engine-critical-alert bg-rose-500 text-[#16070b] font-bold px-4 py-1 shadow-[0_0_20px_rgba(244,63,94,0.55)] animate-bounce">{UI.critical_override}</div>
          </div>
      )}
      <div className="engine-hud flex flex-col font-mono px-4 py-3 bg-white/[0.02] border border-white/[0.06] mb-2 gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-4 w-full">
            <div className="flex flex-wrap items-end gap-5 md:gap-7">
                <div className="flex items-end gap-6">
                    <div>
                        <div className="text-[9px] uppercase tracking-[0.22em] text-slate-500">{UI.level}</div>
                        <div className="font-display mt-1 text-xl font-bold tabular-nums leading-none text-slate-100">{currentLevel}</div>
                    </div>
                    <div>
                        <div className="text-[9px] uppercase tracking-[0.22em] text-slate-500">{UI.round}</div>
                        <div className="font-display mt-1 text-xl font-bold tabular-nums leading-none text-slate-100">{round}<span className="ml-1 text-[10px] font-mono text-slate-600">/{SECTOR_ROUNDS}</span></div>
                    </div>
                </div>
                <div className="border-l border-white/[0.06] pl-5">
                    <div className="text-[9px] uppercase tracking-[0.22em] text-slate-500">{UI.credits}</div>
                    <div className="font-display mt-1 text-2xl font-bold tabular-nums leading-none text-emerald-400">
                        {Math.floor(credits)}
                        {isOverclockActive && <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-300 animate-pulse">2x</span>}
                    </div>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-3 w-full">
             <span className={`text-[9px] uppercase tracking-[0.18em] whitespace-nowrap w-24 ${tracePercent > 80 ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`}>{UI.security}</span>
            <div className="engine-meter-track flex-1 h-1.5 bg-white/[0.05] overflow-hidden relative">
                <div className={`h-full transition-all duration-100 ease-linear ${getTraceColor()}`} style={{ width: `${tracePercent}%` }}></div>
            </div>
             <span className="w-10 text-right text-[10px] tabular-nums text-slate-400 font-mono">{Math.floor(tracePercent)}%</span>
            <div className={`flex items-center gap-2 border-l border-white/[0.06] pl-3 ml-1 text-[9px] uppercase tracking-[0.18em] ${mistakesInSegment >= 7 ? 'text-rose-500 animate-pulse' : mistakesInSegment >= 4 ? 'text-amber-400' : 'text-slate-500'}`}>
                <span>{UI.err}</span>
                <span className="font-display text-sm tabular-nums tracking-normal text-slate-200">{mistakesInSegment}<span className="font-mono text-[9px] text-slate-600">/10</span></span>
            </div>
        </div>
      </div>
      {/* Scene wants 56% of the deck, but never at the expense of the typing panel:
          cap it so HUD + at least ~5 lines of text always fit on short windows. */}
      <div className="engine-scene-bezel relative h-[52%] min-h-[130px] max-h-[calc(100%-360px)] w-full bg-black overflow-hidden border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="absolute left-2 top-2 z-[55] h-5 w-5 border-l border-t border-emerald-400/80 pointer-events-none"></div>
        <div className="absolute right-2 top-2 z-[55] h-5 w-5 border-r border-t border-emerald-400/80 pointer-events-none"></div>
        <div className="absolute bottom-2 left-2 z-[55] h-5 w-5 border-b border-l border-emerald-400/80 pointer-events-none"></div>
        <div className="absolute bottom-2 right-2 z-[55] h-5 w-5 border-b border-r border-emerald-400/80 pointer-events-none"></div>
        {/* Live real-time card next to where you type: combo + current WPM */}
        <div className="absolute bottom-4 right-4 z-50 pointer-events-none select-none">
            <div
                className="engine-telemetry-card border backdrop-blur-sm bg-[#0b101a]/90 px-3.5 py-2 text-center transition-colors duration-300"
                style={{
                    borderColor: combo >= 3 ? comboAccent().glow : 'rgba(255,255,255,0.10)',
                    boxShadow: combo >= 3 ? `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 ${Math.min(22, 6 + combo / 2)}px ${comboAccent().glow}` : 'inset 0 1px 0 rgba(255,255,255,0.04)'
                }}
            >
                {combo >= 3 && (
                    <div key={comboPulse} className="combo-pop">
                        <span
                            className={`block font-black leading-none ${comboAccent().text}`}
                            style={{ fontSize: `${Math.min(2.4, 1.3 + combo * 0.022).toFixed(2)}rem`, textShadow: `0 0 ${Math.min(18, 4 + combo / 2)}px ${comboAccent().glow}` }}
                        >
                            {combo}
                        </span>
                        <span className={`block mt-1 text-[10px] font-bold tracking-[0.18em] ${comboAccent().text}`}>
                            COMBO{comboMultiplier > 1 ? ` ·${comboMultiplier}×` : ''}
                        </span>
                        <span className="block my-1.5 h-px bg-white/10"></span>
                    </div>
                )}
                <div className="flex items-baseline justify-center gap-1">
                    <span className="font-display font-bold tabular-nums text-slate-100 text-lg leading-none">{currentWPM}</span>
                    <span className="text-[9px] uppercase tracking-[0.15em] text-slate-500">{UI.wpm}</span>
                </div>
            </div>
        </div>
        <div className="absolute inset-0 pointer-events-none z-20">
            <svg className="w-full h-full opacity-90" viewBox="0 0 100 100" preserveAspectRatio="none">
                {CRACK_PATHS.map((d, i) => {
                    if (i < mistakesInSegment) return <path key={i} d={d} className={`crack-path ${mistakesInSegment > 7 ? 'deep' : ''}`} />;
                    return null;
                })}
            </svg>
        </div>
        {currentImage ? (
             <img src={currentImage} alt="Narrative Visualization" className={`engine-scene-image w-full h-full object-cover transition-opacity duration-700 ${isImageLoading ? 'engine-scene-image--loading opacity-80 grayscale' : 'opacity-100'} ${isOverclockActive ? 'contrast-125 brightness-125 saturate-0 sepia hue-rotate-180' : ''}`} />
        ) : (
             <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-700">
                <div className="flex flex-col items-center gap-2">
                     <div className="w-8 h-8 border-2 border-slate-700 border-t-slate-400 rounded-full animate-spin"></div>
                     <span className="text-xs tracking-widest">{UI.init_visual}</span>
                </div>
             </div>
        )}
        {isImageLoading && (
            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] pointer-events-none opacity-50">
                <div className="absolute inset-0 bg-emerald-500/10 animate-pulse"></div>
            </div>
        )}
        <div className="absolute inset-0 ring-1 ring-inset ring-white/[0.04] pointer-events-none shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]"></div>
        {!isOverclockActive && (
            <div
                className="absolute inset-0 pointer-events-none mix-blend-soft-light transition-all duration-1000"
                style={{ background: `radial-gradient(120% 90% at 50% 40%, transparent 30%, ${atmosphere().color} 100%)` }}
            ></div>
        )}
        <div
            className="absolute inset-0 z-10 pointer-events-none transition-[box-shadow] duration-700"
            style={{ boxShadow: `inset 0 0 76px 8px ${getSceneInnerGlow()}` }}
        ></div>
        {isOverclockActive && <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay pointer-events-none shadow-[inset_0_0_30px_rgba(52,211,153,0.4)]"></div>}
        <div className="absolute inset-x-0 top-0 h-2/3 pointer-events-none z-40 overflow-hidden">
            {deltaPopups.map(p => (
                <span
                    key={p.id}
                    className="delta-float absolute top-1/2 font-bold text-sm md:text-base drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
                    style={{ left: `${p.left}%`, color: p.color }}
                >
                    {p.value > 0 ? '+' : ''}{p.value}{p.suffix} {p.label}
                </span>
            ))}
        </div>
        <div className="absolute left-4 bottom-4 right-4 z-30 flex flex-wrap items-center gap-2">
            <span className="engine-chip engine-chip--skill bg-[#0b101a]/90 border border-white/[0.08] px-2.5 py-1 text-[9px] text-slate-300 uppercase tracking-[0.18em]">{skillIcon[activeSegment.skill || 'flow']} {activeSegment.skill || 'flow'}</span>
            <span className="engine-chip engine-chip--objective bg-[#0b101a]/90 border border-white/[0.08] px-2.5 py-1 text-[9px] text-slate-300 uppercase tracking-[0.18em]">{UI.objective}: <span className="normal-case tracking-normal text-slate-200">{activeSegment.objective}</span></span>
            {activeSegment.consequenceHint && <span className="engine-chip engine-chip--consequence bg-[#0b101a]/90 border border-white/[0.08] px-2.5 py-1 text-[9px] text-slate-300 uppercase tracking-[0.18em]">{UI.consequence}: <span className="normal-case tracking-normal text-slate-200">{activeSegment.consequenceHint}</span></span>}
        </div>
      </div>
      <div className={getContainerStyles()}>
        {/* HP rail — left edge, scrollbar-style vertical health */}
        <div className="engine-vrail engine-vrail-left" title={`${UI.hp} ${health}/${modifiers.maxHealth}`}>
          <div
            className={`engine-vrail-fill ${health < 6 ? 'animate-pulse' : ''}`}
            style={{
              height: `${Math.max(0, (health / modifiers.maxHealth) * 100)}%`,
              background: (health / modifiers.maxHealth) > 0.6 ? '#34d399' : (health / modifiers.maxHealth) > 0.3 ? '#fbbf24' : '#f43f5e',
              boxShadow: `0 0 10px ${(health / modifiers.maxHealth) > 0.3 ? 'rgba(52,211,153,0.5)' : 'rgba(244,63,94,0.65)'}`
            }}
          ></div>
        </div>
        {/* EN rail — right edge, replaces the scrollbar */}
        <div className={`engine-vrail engine-vrail-right ${overclockCharge >= modifiers.maxOverclock && !isOverclockActive ? 'focus-ready-pulse' : ''}`} title={UI.chg}>
          {isOverclockActive ? (
            <div className="focus-holo absolute inset-0"></div>
          ) : (
            <div
              className="engine-vrail-fill"
              style={{
                height: `${Math.min(100, (overclockCharge / modifiers.maxOverclock) * 100)}%`,
                background: overclockCharge >= modifiers.maxOverclock ? '#22d3ee' : 'linear-gradient(0deg, #0e7490, #22d3ee)',
                boxShadow: overclockCharge >= modifiers.maxOverclock ? '0 0 12px rgba(34,211,238,0.8)' : '0 0 6px rgba(34,211,238,0.35)'
              }}
            ></div>
          )}
        </div>
        <div ref={textContainerRef} onClick={() => inputRef.current?.focus()} className="engine-type-scroll no-scrollbar absolute inset-0 overflow-y-auto px-8 md:px-10 py-6 md:py-8 leading-relaxed cursor-text font-mono text-xl md:text-2xl">
        {isOverclockActive && <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(52,211,153,0.2)]"></div>}
        {typeCueActive && !isDecisionActive && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-slate-950/45 backdrop-blur-[1px]">
                <div className="type-cue-lockup text-center">
                    <div className="type-cue-glyph mx-auto mb-3">✦</div>
                    <div className="type-cue-word font-display">{UI.type_cue}</div>
                    <div className="type-cue-sub mt-2">{UI.type_subcue}</div>
                </div>
            </div>
        )}
        <div className={`whitespace-pre-wrap break-words min-h-full pb-24 max-w-4xl mx-auto relative z-10 transition-all duration-300 ${typeCueActive ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'}`}>
            {activeSegment.type === SegmentType.BREACH && <div className="text-emerald-400 text-[10px] mb-4 font-bold uppercase tracking-[0.2em] border-b border-emerald-400/30 pb-2">{UI.breach_init}</div>}
            {activeSegment.type === SegmentType.DIALOG && <div className="text-sky-400 text-[10px] mb-4 font-bold uppercase tracking-[0.2em] border-b border-sky-400/30 pb-2">{UI.dialog_init}</div>}
            {activeSegment.type === SegmentType.SIGNAL && <div className="text-amber-400 text-[10px] mb-4 font-bold uppercase tracking-[0.2em] border-b border-amber-400/30 pb-2">{UI.signal_init}</div>}
            {history.map((seg, i) => (
                <span key={i} className={`mr-2 transition-colors duration-500 ${seg.performance === 'good' ? 'text-emerald-400' : seg.performance === 'average' ? 'text-amber-400' : 'text-rose-400'}`}>
                    {seg.text}
                </span>
            ))}
            <span ref={activeRef} className="relative inline-block">
                {renderActive()}
                {isWaitingForAi && (
                    <span className="ml-2 inline-flex gap-1 align-baseline opacity-50">
                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                        <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                    </span>
                )}
            </span>
        </div>
        {!isOverclockActive && activeSegment.mood === StoryMood.DARK && <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-rose-900/20 via-transparent to-transparent z-0 transition-opacity duration-1000"></div>}
        {!isOverclockActive && activeSegment.mood === StoryMood.HOPEFUL && <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-emerald-500/5 to-transparent z-0 transition-opacity duration-1000"></div>}
        </div>
      </div>

      <input ref={inputRef} type="text" value={inputValue} onChange={handleInput} onPaste={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()} aria-label={language === 'ru' ? 'Поле тренировки печати' : 'Typing practice input'} className="fixed opacity-0 top-0 left-0 w-px h-px overflow-hidden -z-10 pointer-events-none" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} autoFocus disabled={isWaitingForAi || isCriticalHack || isDecisionActive || showSkillBriefing} />
    </div>
  );
};

export default TypingEngine;
