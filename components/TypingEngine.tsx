import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { StorySegment, BranchingStory, GameStats, StoryMood, GameModifiers, SegmentType, DecisionPoint, Language, MissionState, DecisionImpact, ComicFrame } from '../types';
import { generateNextSegments, generateSceneImage, generateStrategicDecision } from '../services/geminiService';
import { audioEngine } from '../services/audioEngine';

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
}

const DECISION_ROUND = 5;
const TYPE_CUE_MS = 1500;

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

const charsMatch = (typed: string, expected: string) => typed === expected || normalizeTypingChar(typed) === normalizeTypingChar(expected);

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
    onCaptureFrame
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
  const forgivenMistakesRef = useRef(0);
  const forgivenIndicesRef = useRef<Set<number>>(new Set());

  // Localization Dictionary for Engine
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
          route_balanced: "БАЛАНС",
          route_silent: "ТИХО",
          route_loud: "ГРОМКО",
          type_cue: "TYPE",
          type_subcue: "НАЧИНАЙ ВВОД"
      }
  };

  const UI = T[language];

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
      setTypeCueActive(true);
      inputRef.current?.focus();
      const cueTimer = window.setTimeout(() => {
          setTypeCueActive(false);
          setStartTime(Date.now());
          inputRef.current?.focus();
      }, TYPE_CUE_MS);
      return () => window.clearTimeout(cueTimer);
  }, [activeSegment]);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
            e.preventDefault(); 
            if (!isOverclockActive && overclockCharge >= modifiers.maxOverclock) {
                activateOverclock();
            }
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
    health
  ]);

  const activateOverclock = () => {
      setIsOverclockActive(true);
      setOverclockCharge(0);
      if (overclockTimerRef.current) clearTimeout(overclockTimerRef.current);
      overclockTimerRef.current = window.setTimeout(() => {
          setIsOverclockActive(false);
      }, modifiers.focusDurationMs); 
  };

  useLayoutEffect(() => {
    if (activeRef.current) {
        activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (textContainerRef.current) {
        textContainerRef.current.scrollTop = textContainerRef.current.scrollHeight;
    }

    const showFocusHint = !isOverclockActive && overclockCharge >= modifiers.maxOverclock;
    if (showFocusHint && cursorRef.current) {
        const rect = cursorRef.current.getBoundingClientRect();
        setFocusHintPos({ left: rect.left + rect.width / 2, top: rect.top - 6 });
    } else {
        setFocusHintPos(null);
    }
  }, [inputValue, activeSegment, isWaitingForAi, history, mistakesInSegment, overclockCharge, isOverclockActive, modifiers.maxOverclock]);

  useEffect(() => {
    let isMounted = true;
    const fetchImage = async () => {
        setIsImageLoading(true);
        const base64 = await generateSceneImage(activeSegment.text, characterDescription);
        if (isMounted && base64) { setCurrentImage(base64); currentImageRef.current = base64; }
        if (isMounted) setIsImageLoading(false);
    };
    fetchImage();
    return () => { isMounted = false; };
  }, [activeSegment, characterDescription]);

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
                triggerGameOver(0);
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
      if (round >= 10) return;
      try {
        if (nextRound === DECISION_ROUND) {
             const decision = await generateStrategicDecision(context, currentLevel, language, missionRef.current);
             if (isMounted) setNextDecision(decision);
        } else {
             const branch = await generateNextSegments(context, nextLevel, nextRound, language, prevLevelSummary, missionRef.current);
             if (isMounted) setNextBranch(branch);
        }
      } catch (e) {
        console.error("Critical Buffering Error", e);
      }
    };
    bufferNext();
    return () => { isMounted = false; };
  }, [activeSegment, history, currentLevel, round, prevLevelSummary, language]); 

  useEffect(() => {
      if (inputValue.length === 0 && !transitionLockRef.current && round <= 10 && !isCriticalHack && !isDecisionActive && !typeCueActive) {
          if (Math.random() < modifiers.criticalHackChance) {
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
    if (combo >= 50) return { text: 'text-yellow-300', glow: 'rgba(234,179,8,0.95)' };
    if (combo >= 25) return { text: 'text-fuchsia-300', glow: 'rgba(232,121,249,0.9)' };
    if (combo >= 10) return { text: 'text-cyan-300', glow: 'rgba(34,211,238,0.85)' };
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
      spawnDelta(UI.evidence, safeImpact.evidence || 0, '#6ee7b7');
      spawnDelta(UI.heat, safeImpact.heat || 0, '#fca5a5', '%');
      spawnDelta(UI.trust, safeImpact.trust || 0, '#67e8f9');
      return meta;
  };

  const getErrorReport = () => {
      let uncorrectedTypos = 0;
      let forgivenTypos = 0;
      inputValue.split('').forEach((char, i) => {
          if (!charsMatch(char, activeSegment.text[i])) {
              if (forgivenIndicesRef.current.has(i)) forgivenTypos += 1;
              else uncorrectedTypos += 1;
          }
      });
      return {
          uncorrectedTypos,
          forgivenTypos,
          totalErrors: mistakesInSegment + uncorrectedTypos
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

      spawnDelta(UI.evidence, evidenceDelta, '#6ee7b7');
      spawnDelta(UI.heat, heatDelta, '#fca5a5', '%');
      spawnDelta(UI.trust, trustDelta, '#67e8f9');
      if (corruptionDelta) spawnDelta(UI.corruption, corruptionDelta, '#d8b4fe');

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
    const charIndex = val.length - 1;

    if (charIndex >= 0 && val.length > inputValue.length) {
       const expectedChar = activeSegment.text[charIndex];
       const typedChar = val[charIndex];

       if (!charsMatch(typedChar, expectedChar)) {
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
                triggerGameOver(newHealth);
                return;
             }
         }
       } else {
           setCombo(c => c + 1);
           setComboPulse(p => p + 1);
           const baseCredit = isOverclockActive ? 2 : 1;
           const earned = baseCredit * modifiers.creditMultiplier * comboMultiplier * (activeSegment.type === SegmentType.BREACH ? modifiers.breachRewardMultiplier : 1);
           setCredits(c => c + earned);
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
              color: Math.random() > 0.5 ? '#22d3ee' : '#ffffff'
          });
      }
      setSparks(prev => [...prev, ...newSparks]);
      setTimeout(() => {
          setSparks(prev => prev.filter(s => !newSparks.find(ns => ns.id === s.id)));
      }, 600);
  };

  const triggerShieldEffect = () => {
      if (containerRef.current) {
          containerRef.current.classList.add('shadow-[inset_0_0_20px_rgba(56,189,248,0.5)]');
          setTimeout(() => {
              containerRef.current?.classList.remove('shadow-[inset_0_0_20px_rgba(56,189,248,0.5)]');
          }, 200);
      }
  };

  const triggerGameOver = (finalHealth: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (overclockTimerRef.current) clearTimeout(overclockTimerRef.current);
    onGameOver({
        wpm: Math.round(totalWPM / Math.max(1, (currentLevel - 1) * 10 + round)),
        accuracy: 0,
        health: finalHealth,
        level: currentLevel,
        round,
        score: 0,
        credits: Math.floor(credits),
        mission: missionRef.current
    });
  };

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
        } else if (nextBranch || round >= 10) {
            transitionLockRef.current = true;
            setTimeout(() => {
                if (round >= 10) {
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
    const { totalErrors, forgivenTypos } = getErrorReport();
    let segmentScore = Math.max(0, 12 - (totalErrors * 2));
    if (activeSegment.type === SegmentType.BREACH && totalErrors <= 2) segmentScore += Math.round(5 * modifiers.breachRewardMultiplier);
    if (activeSegment.type === SegmentType.SIGNAL && totalErrors <= 1) segmentScore += 3;
    if (wpm > 70 && totalErrors <= 1) segmentScore += 4;
    if (isOverclockActive) segmentScore *= 2;
    if (forgivenTypos > 0) segmentScore += Math.min(3, forgivenTypos);

    let healthChange = 0;
    if (totalErrors === 0) healthChange += 1;
    if (modifiers.healthRegenWpmThreshold > 0 && wpm > modifiers.healthRegenWpmThreshold) healthChange += 2;
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
      const score = Math.max(0, 12 - (totalErrors * 2)) + (activeSegment.type === SegmentType.BREACH && totalErrors <= 2 ? 5 : 0);
      const outcome = applySegmentOutcome(performanceType, totalErrors, wpm, activeSegment);
      addToLog(activeSegment.text, performanceType, score, wpm, totalErrors, outcome.meta, activeSegment.type);
      onCaptureFrame?.({ image: currentImageRef.current, caption: activeSegment.text, performance: performanceType, level: currentLevel });
      const stats: GameStats = {
             wpm,
             accuracy: Math.max(0, 100 - (totalErrors * 8)), 
             health,
             level: currentLevel,
             round,
             score: 0,
             credits: Math.floor(credits),
             mission: missionRef.current
        };
        onLevelComplete(stats, clamp(tracePercent + outcome.traceDelta), missionRef.current);
  };

  const renderActive = () => {
    return activeSegment.text.split('').map((char, index) => {
      let className = isOverclockActive ? "text-cyan-900" : activeSegment.type === SegmentType.BREACH ? "text-emerald-900" : "text-slate-500";
      const isCursor = index === inputValue.length;
      if (index < inputValue.length) {
        if (charsMatch(inputValue[index], char)) {
          className = isOverclockActive ? "text-cyan-500" : activeSegment.type === SegmentType.BREACH ? "text-emerald-400" : "text-blue-400";
        } else {
          if (forgivenIndicesRef.current.has(index)) {
             className = "text-white bg-purple-500 rounded-sm shadow-[0_0_10px_rgba(168,85,247,0.5)]";
          } else {
             className = "text-white bg-red-600 rounded-sm";
          }
        }
      } else if (isCursor) {
        className = isCriticalHack ? "text-white bg-yellow-400 animate-ping" : 
                    isOverclockActive ? "text-white bg-cyan-400 animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.8)]" :
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
    let base = "relative flex-1 min-h-0 p-6 md:p-8 rounded-b-xl border-x-2 border-b-2 overflow-y-auto leading-relaxed cursor-text bg-slate-950/80";
    if (activeSegment.type === SegmentType.BREACH) base += " font-mono text-xl md:text-2xl"; 
    else base += " font-mono text-xl md:text-2xl"; 
    
    // Trace effect logic
    if (tracePercent > 80) base += " shadow-[inset_0_0_50px_rgba(220,38,38,0.2)]";

    let borderColor = "border-slate-800";
    if (isOverclockActive) {
        borderColor = "border-cyan-400";
        // Shadow is handled by overlay now
    } else if (activeSegment.type === SegmentType.BREACH) {
        borderColor = "border-emerald-500/50";
    } else if (mistakesInSegment >= 8) {
        borderColor = "border-red-600";
    } else if (mistakesInSegment >= 3) {
        borderColor = "border-red-600/50";
    } else if (health < 30) {
        borderColor = "border-red-900";
    } else {
        if (activeSegment.mood === StoryMood.DARK) borderColor = "border-red-900/50";
        if (activeSegment.mood === StoryMood.HOPEFUL) borderColor = "border-emerald-900/50";
        if (isWaitingForAi) borderColor = "border-yellow-500/50";
    }
    return `${base} ${borderColor}`;
  };

  const getHealthColor = () => {
    const pct = (health / modifiers.maxHealth) * 100;
    if (pct > 60) return "bg-emerald-500";
    if (pct > 30) return "bg-yellow-500";
    return "bg-red-500 animate-pulse";
  };
  
  const getTraceColor = () => {
      if (isOverclockActive) return "bg-cyan-400 shadow-[0_0_20px_rgba(34,211,238,1)]";
      if (tracePercent < 50) return "bg-emerald-500";
      if (tracePercent < 80) return "bg-yellow-500";
      return "bg-red-500 animate-pulse";
  };

  const getImageBorderColor = () => {
    if (isOverclockActive) return "border-cyan-400"; // Shadow moved to overlay
    if (mistakesInSegment >= 8) return "border-red-600";
    if (activeSegment.type === SegmentType.BREACH) return "border-emerald-500/50";
    if (mistakesInSegment >= 3) return "border-red-600/50";
    if (health < 30) return "border-red-900";
    if (isWaitingForAi) return "border-yellow-500/50";
    if (activeSegment.mood === StoryMood.HOPEFUL) return "border-emerald-900/50";
    if (activeSegment.mood === StoryMood.DARK) return "border-red-900/50";
    return "border-slate-800";
  };

  return (
    <div ref={containerRef} className="w-full max-w-5xl mx-auto flex flex-col gap-0 h-full min-h-0 relative">
      {showFlash && <div className="absolute inset-0 z-[60] pointer-events-none flash-overlay rounded-xl"></div>}
      
      {isOverclockActive && (
           <>
               <div className="absolute inset-0 z-[5] pointer-events-none rounded-xl bg-cyan-900/10 backdrop-contrast-125"></div>
               <div className="absolute -top-8 right-0 z-50 pointer-events-none flex items-center gap-3 animate-fade-in-up">
                   <div className="h-px w-12 bg-gradient-to-l from-cyan-400/50 to-transparent"></div>
                   <div className="text-cyan-400 font-bold text-lg animate-pulse tracking-widest drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">
                       {UI.overclock_active}
                   </div>
               </div>
           </>
      )}

      {isDecisionActive && nextDecision && (
           <div className="absolute inset-0 z-[80] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 rounded-xl animate-fade-in-up">
               <div className="w-full max-w-3xl space-y-8">
                   <div className="text-center border-b border-slate-700 pb-6">
                        <div className="inline-block px-3 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded-full text-xs font-bold tracking-widest mb-4 animate-pulse">{UI.tactical_intervention}</div>
                        <h2 className="text-2xl md:text-3xl font-bold text-white leading-relaxed">"{nextDecision.introText}"</h2>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="group relative p-6 bg-red-900/20 border border-red-500/30 rounded-lg hover:bg-red-900/40 hover:border-red-500 transition-all cursor-pointer" onClick={() => handleDecisionSelect(0)}>
                           <div className="absolute -top-3 -left-3 w-8 h-8 bg-red-500 text-white font-bold flex items-center justify-center rounded-full shadow-lg ring-4 ring-slate-950">1</div>
                           <h3 className="text-xl font-bold text-red-400 mb-2 group-hover:text-red-300">{UI.aggressive}</h3>
                           <p className="text-slate-300 text-lg">"{nextDecision.options[0].text}"</p>
                           <div className="mt-4 text-xs text-red-300/80 font-mono">{nextDecision.options[0].preview || describeImpact(nextDecision.options[0].impact)}</div>
                           <div className="mt-3 text-xs text-red-500/70 font-mono uppercase tracking-widest">{UI.press_1}</div>
                       </div>
                       <div className="group relative p-6 bg-cyan-900/20 border border-cyan-500/30 rounded-lg hover:bg-cyan-900/40 hover:border-cyan-500 transition-all cursor-pointer" onClick={() => handleDecisionSelect(1)}>
                           <div className="absolute -top-3 -left-3 w-8 h-8 bg-cyan-500 text-white font-bold flex items-center justify-center rounded-full shadow-lg ring-4 ring-slate-950">2</div>
                           <h3 className="text-xl font-bold text-cyan-400 mb-2 group-hover:text-cyan-300">{UI.stealth}</h3>
                           <p className="text-slate-300 text-lg">"{nextDecision.options[1].text}"</p>
                           <div className="mt-4 text-xs text-cyan-300/80 font-mono">{nextDecision.options[1].preview || describeImpact(nextDecision.options[1].impact)}</div>
                           <div className="mt-3 text-xs text-cyan-500/70 font-mono uppercase tracking-widest">{UI.press_2}</div>
                       </div>
                   </div>
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
              <div key={s.id} className="char-particle bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,1)]" style={{ left: `${s.left}px`, top: `${s.top}px`, width: `${s.size}px`, height: `${s.size}px`, backgroundColor: s.color, '--tx': s.tx, '--ty': s.ty } as any} />
          ))}
      </div>
      {focusHintPos && (
          <div
              className="fixed pointer-events-none z-[110] flex flex-col items-center -translate-x-1/2 -translate-y-full"
              style={{ left: focusHintPos.left, top: focusHintPos.top }}
          >
              <span
                  className="bg-gradient-to-r from-cyan-400 to-lime-400 text-slate-950 text-[9px] font-black tracking-wider px-2 py-0.5 rounded whitespace-nowrap animate-bounce"
                  style={{ boxShadow: '0 0 12px rgba(132,204,22,0.75)' }}
              >
                  {UI.focus_ready}
              </span>
              <span className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-lime-400 animate-bounce"></span>
          </div>
      )}
      {isCriticalHack && (
          <div className="absolute top-[20%] left-1/2 -translate-x-1/2 z-[70] pointer-events-none">
              <div className="bg-yellow-400 text-black font-bold px-4 py-1 rounded shadow-[0_0_20px_rgba(250,204,21,0.8)] animate-bounce">{UI.critical_override}</div>
          </div>
      )}
      <div className="flex flex-col text-xs font-mono px-4 py-3 bg-slate-900/90 rounded-t-lg border border-slate-700 mb-2 gap-2">
        <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 w-40 md:w-48">
                    <span className={`font-bold ${health < 6 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>{UI.hp}</span>
                    <div className="flex-1 h-3 bg-slate-800 rounded-sm border border-slate-700 overflow-hidden relative">
                        <div className="absolute inset-0 flex">
                            {Array.from({length: 10}).map((_, i) => (
                                <div key={i} className="flex-1 border-r border-slate-900/30 h-full"></div>
                            ))}
                        </div>
                        <div className={`h-full transition-all duration-300 ${getHealthColor()}`} style={{ width: `${(health / modifiers.maxHealth) * 100}%` }}></div>
                    </div>
                    <span className="text-[10px] text-slate-500">{health}/{modifiers.maxHealth}</span>
                </div>
                <div className="text-blue-400 font-bold hidden md:block border-l border-slate-700 pl-6">{UI.level} {currentLevel} <span className="text-slate-600 mx-2">|</span> {UI.round} {round}/10</div>
                <div className="flex items-center gap-1.5 border-l border-slate-700 pl-4">
                    <span className="text-yellow-400 font-bold">{UI.credits}:</span>
                    <span className="text-slate-200">{Math.floor(credits)}</span>
                    {isOverclockActive && <span className="text-cyan-400 text-[10px] animate-pulse">(2x)</span>}
                </div>
            </div>
        </div>
        <div className="flex items-center gap-3 w-full">
             <span className={`font-bold whitespace-nowrap w-24 ${tracePercent > 80 ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>{UI.security}</span>
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                <div className={`h-full transition-all duration-100 ease-linear ${getTraceColor()}`} style={{ width: `${tracePercent}%` }}></div>
            </div>
             <span className="w-8 text-right text-slate-500 font-mono">{Math.floor(tracePercent)}%</span>
            <div className={`flex items-center gap-2 border-l border-slate-700 pl-3 ml-2 font-bold ${mistakesInSegment >= 7 ? 'text-red-500 animate-pulse' : mistakesInSegment >= 4 ? 'text-yellow-500' : 'text-slate-500'}`}>
                <span>{UI.err}:</span>
                <span className="bg-slate-800 px-1.5 rounded">{mistakesInSegment}/10</span>
            </div>
        </div>
      </div>
      <div className={`relative h-[56%] w-full bg-black overflow-hidden rounded-t-xl border-2 border-b-0 transition-colors duration-500 ${getImageBorderColor()}`}>
        {/* Live real-time card next to where you type: combo + current WPM */}
        <div className="absolute bottom-4 right-4 z-50 pointer-events-none select-none">
            <div
                className="rounded-lg border backdrop-blur-sm bg-slate-950/85 px-3.5 py-2 text-center transition-colors duration-300"
                style={{
                    borderColor: combo >= 3 ? comboAccent().glow : 'rgba(255,255,255,0.10)',
                    boxShadow: combo >= 3 ? `0 0 ${Math.min(22, 6 + combo / 2)}px ${comboAccent().glow}` : 'none'
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
             <img src={currentImage} alt="Narrative Visualization" className={`w-full h-full object-cover transition-opacity duration-700 ${isImageLoading ? 'opacity-80 grayscale' : 'opacity-100'} ${isOverclockActive ? 'contrast-125 brightness-125 saturate-0 sepia hue-rotate-180' : ''}`} />
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
        <div className="absolute inset-0 ring-1 ring-inset ring-black/20 pointer-events-none shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]"></div>
        {!isOverclockActive && (
            <div
                className="absolute inset-0 pointer-events-none mix-blend-soft-light transition-all duration-1000"
                style={{ background: `radial-gradient(120% 90% at 50% 40%, transparent 30%, ${atmosphere().color} 100%)` }}
            ></div>
        )}
        {isOverclockActive && <div className="absolute inset-0 bg-cyan-500/10 mix-blend-overlay pointer-events-none shadow-[inset_0_0_30px_rgba(34,211,238,0.4)]"></div>}
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
            <span className="px-2 py-1 rounded bg-slate-950/80 border border-slate-700 text-[10px] text-slate-300 uppercase tracking-widest">{skillIcon[activeSegment.skill || 'flow']} {activeSegment.skill || 'flow'}</span>
            <span className="px-2 py-1 rounded bg-cyan-950/80 border border-cyan-500/30 text-[10px] text-cyan-200">{UI.objective}: {activeSegment.objective}</span>
            {activeSegment.consequenceHint && <span className="px-2 py-1 rounded bg-purple-950/80 border border-purple-500/30 text-[10px] text-purple-200">{UI.consequence}: {activeSegment.consequenceHint}</span>}
        </div>
      </div>
      <div ref={textContainerRef} className={getContainerStyles()} onClick={() => inputRef.current?.focus()}>
        {isOverclockActive && <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(34,211,238,0.2)]"></div>}
        {typeCueActive && !isDecisionActive && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-slate-950/45 backdrop-blur-[1px]">
                <div className="type-cue-lockup text-center">
                    <div className="type-cue-glyph mx-auto mb-3">✦</div>
                    <div className="type-cue-word font-display">{UI.type_cue}</div>
                    <div className="type-cue-sub mt-2">{UI.type_subcue}</div>
                </div>
            </div>
        )}
        <div className={`whitespace-pre-wrap break-words min-h-full pb-60 max-w-4xl mx-auto relative z-10 transition-all duration-300 ${typeCueActive ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'}`}>
            {activeSegment.type === SegmentType.BREACH && <div className="text-emerald-500/80 text-xs mb-4 font-bold tracking-widest border-b border-emerald-500/30 pb-1">{UI.breach_init}</div>}
            {activeSegment.type === SegmentType.DIALOG && <div className="text-cyan-500/80 text-xs mb-4 font-bold tracking-widest border-b border-cyan-500/30 pb-1">{UI.dialog_init}</div>}
            {activeSegment.type === SegmentType.SIGNAL && <div className="text-yellow-500/80 text-xs mb-4 font-bold tracking-widest border-b border-yellow-500/30 pb-1">{UI.signal_init}</div>}
            {history.map((seg, i) => (
                <span key={i} className={`mr-2 transition-colors duration-500 ${seg.performance === 'good' ? 'text-emerald-400' : seg.performance === 'average' ? 'text-yellow-400' : 'text-red-400'}`}>
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
        {!isOverclockActive && activeSegment.mood === StoryMood.DARK && <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-red-900/20 via-transparent to-transparent z-0 transition-opacity duration-1000"></div>}
        {!isOverclockActive && activeSegment.mood === StoryMood.HOPEFUL && <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-emerald-500/5 to-transparent z-0 transition-opacity duration-1000"></div>}
      </div>

      {/* FOCUS charge — full-width acid/holographic bar along the bottom edge of the typing card */}
      {(() => {
        const focusPct = Math.min(100, (overclockCharge / modifiers.maxOverclock) * 100);
        const focusFull = overclockCharge >= modifiers.maxOverclock;
        const acidGradient = 'linear-gradient(90deg, rgba(14,74,74,0.55) 0%, #0e7490 22%, #06b6d4 45%, #22d3ee 64%, #4ade80 82%, #bef264 100%)';
        return (
          <div className="pointer-events-none absolute bottom-[2px] left-[2px] right-[2px] z-30">
            <div className="flex items-center justify-between px-5 pb-1.5 text-[9px] font-bold uppercase tracking-[0.22em]">
              <span className={isOverclockActive ? 'text-lime-200' : focusFull ? 'text-lime-300 animate-pulse' : 'text-slate-500'} title={UI.focus_title}>
                {isOverclockActive ? UI.overclock_active : focusFull ? `${UI.chg} · TAB ⚡` : UI.chg}
              </span>
              <span className="tabular-nums text-slate-600">{Math.round(focusPct)}%</span>
            </div>
            <div
              className={`relative h-2 w-full overflow-hidden rounded-b-[10px] bg-white/[0.05] ${(isOverclockActive || focusFull) ? 'focus-ready-pulse' : ''}`}
            >
              {isOverclockActive ? (
                <div className="focus-holo absolute inset-0" style={{ filter: 'brightness(1.35) saturate(0.85)' }}></div>
              ) : (
                <div
                  className="absolute inset-0 transition-[clip-path] duration-200 ease-out"
                  style={{ backgroundImage: acidGradient, clipPath: `inset(0 ${100 - focusPct}% 0 0)` }}
                ></div>
              )}
            </div>
          </div>
        );
      })()}
      <input ref={inputRef} type="text" value={inputValue} onChange={handleInput} className="fixed opacity-0 top-0 left-0 w-px h-px overflow-hidden -z-10 pointer-events-none" autoComplete="off" autoFocus disabled={isWaitingForAi || isCriticalHack || isDecisionActive} />
    </div>
  );
};

export default TypingEngine;
