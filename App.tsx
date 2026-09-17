import React, { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { LAST_RELAY, RELAY_CHARACTER, RELAY_SECTORS, isLastRelay, getRelayStart, getRelaySummary, getRelayEnding } from './services/lastRelay';
import { GameState, StorySegment, GameStats, StoryLogItem, UserProfile, Perk, GameModifiers, LevelReport, UserUpgrades, StoryMood, SegmentType, Language, MissionState, ComicFrame, StoryGenreId } from './types';
import { generateStoryStart, generateCharacterProfile, generateLevelSummary, generateNextLevelStart } from './services/geminiService';
import { GENRE_ORDER, getGenrePack } from './services/genreConfig';
import { getGenreSkin } from './services/genreSkin';
import { TRANSLATIONS } from './services/i18n';
import { DAILY_MAX_ATTEMPTS, DailyBrief, getDailyBrief, getDailyState, pickDailyItems, recordDailyAttempt } from './services/dailyMode';
import { CAMPAIGN_SECTORS, DEFAULT_BRANCH_THRESHOLDS, getStealthLevel, getTypingAccuracy, getTypingFocus, summarizeSector } from './services/gameRules';
import { clampTraceSpeed, getComfortCreditMultiplier } from './services/riskReward';
import { getSkillHeadline } from './services/progressAnalytics';
import {
  EXACTING_AVERAGE_ACCURACY,
  EXACTING_GOOD_ACCURACY,
  HOT_START_HEAT,
  HUNTED_TRACE_MULTIPLIER,
  getPactRewardMultiplier,
  isPactClauseActive,
  normalizePact,
  togglePactClause,
  type PactClauseId
} from './services/pact';
import { RunCheckpoint, clearRunCheckpoint, loadRunCheckpoint, saveRunCheckpoint } from './services/runCheckpoint';
import {
  createBalancedCalibration,
  getAdaptiveDifficulty,
  getEffectiveBaseline,
  getLocalDateKey,
  loadPlayerProgress,
  summarizeProgress,
  recordRun,
  savePlayerProgress,
  setCalibration,
  type CalibrationResult
} from './services/playerProgress';
import { DEFAULT_MISSION_STATE, DEFAULT_PROFILE, PROFILE_STORAGE_KEY, loadStoredProfile } from './services/profile';
import {
  DEFAULT_MODIFIERS,
  META_UPGRADES,
  PERK_DEFINITIONS,
  createPerk,
  getUpgradeOptions
} from './services/perks';
import { audioEngine } from './services/audioEngine';
import { readSkillStackAnchor, toggleSkillStackAnchor, writeSkillStackAnchor, type SkillStackAnchor } from './services/skillStackAnchor';
import TypingEngine from './components/TypingEngine';
import HudStrip from './components/HudStrip';
import DeathSequence from './components/DeathSequence';
import MenuScreen from './components/screens/MenuScreen';
import BlackMarketScreen from './components/screens/BlackMarketScreen';
import GenreSelectionScreen from './components/screens/GenreSelectionScreen';
import StarterPerkScreen from './components/screens/StarterPerkScreen';
import SectorCompleteScreen from './components/screens/SectorCompleteScreen';
import LoadingScreen from './components/screens/LoadingScreen';
import VictoryScreen from './components/screens/VictoryScreen';
import GameOverScreen from './components/screens/GameOverScreen';
import {
  captureProductEvent,
  getAccuracyBucket,
  getDeviceClass,
  getDurationBucket,
  getMetricBucket
} from './services/productAnalytics';
import {
  buildTargetedDrill,
  getTrainingFocusTokens,
  getWeakPatterns,
  loadTypingTraining,
  recordTypingSession,
  saveTypingTraining,
  snapshotTypingObservations,
  type TypingObservation
} from './services/typingTraining';
import { buildChallengeShareUrl, getChallengeVerdict, parseChallenge } from './services/challenge';
import { shareScoreCardImage } from './services/scoreCard';
import { createSessionFlow, isLegalGameTransition } from './services/gameFlow';
import { playerStorage } from './services/playerStorage';

// Secondary screens are route-gated and heavy (telemetry charts, comic canvas,
// the calibration typing test) — they ship as their own chunks.
const RunComic = lazy(() => import('./components/RunComic'));
const CalibrationPanel = lazy(() => import('./components/CalibrationPanel'));
const OperatorRecord = lazy(() => import('./components/OperatorRecord'));

interface RoundData {
    wpm: number;
    mistakes: number;
    score: number;
    characters: number;
}

// beforeinstallprompt isn't in lib.dom yet — the browser fires it with this shape.
interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
}

const App: React.FC = () => {
  const [dailyBrief, setDailyBrief] = useState(() => getDailyBrief());
  const [gameState, setGameStateUnchecked] = useState<GameState>(GameState.MENU);
  // Legal edges live in services/gameFlow.ts. Going through this setter means
  // an impossible jump warns instead of rendering a half-initialised screen.
  const setGameState = (next: GameState) => {
      setGameStateUnchecked(prev => {
          if (!isLegalGameTransition(prev, next)) {
              console.warn(`[flow] illegal transition ${prev} -> ${next}`);
          }
          return next;
      });
  };
  const [storyLog, setStoryLog] = useState<StoryLogItem[]>([]);
  const [initialSegment, setInitialSegment] = useState<StorySegment | null>(null);
  const [characterDesc, setCharacterDesc] = useState<string>("");
  const [finalStats, setFinalStats] = useState<GameStats | null>(null);
  const [victoryReport, setVictoryReport] = useState<LevelReport | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentHealth, setCurrentHealth] = useState(20);
  const [musicActive, setMusicActive] = useState(() => audioEngine.isEnabled());
  const [skillStackAnchor, setSkillStackAnchor] = useState<SkillStackAnchor>(() => (
    readSkillStackAnchor(typeof window === 'undefined' ? null : window.localStorage)
  ));
  const [storedBoot] = useState(loadStoredProfile);
  const [language, setLanguage] = useState<Language>(storedBoot.language ?? 'en'); // Global Language State
  
  const [userProfile, setUserProfile] = useState<UserProfile>(storedBoot.profile);
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
  const [selectedGenre, setSelectedGenre] = useState<StoryGenreId>(storedBoot.lastGenre ?? 'cyberpunk');
  const [dailyState, setDailyState] = useState(() => getDailyState(dailyBrief.dailyId));
  const [isDailyRun, setIsDailyRun] = useState(false);
  const [currentDailyId, setCurrentDailyId] = useState<string | null>(null);
  const [currentDailyDateLabel, setCurrentDailyDateLabel] = useState<string | null>(null);
  const [runCheckpoint, setRunCheckpoint] = useState<RunCheckpoint | null>(() => loadRunCheckpoint());
  const [playerProgress, setPlayerProgressState] = useState(() => loadPlayerProgress());
  const [typingTraining, setTypingTraining] = useState(() => loadTypingTraining());
  const [drillFocus, setDrillFocus] = useState<string[] | undefined>();
  const [incomingChallenge] = useState(() => parseChallenge(typeof location !== 'undefined' ? location.search : ''));
  const [challengeShareStatus, setChallengeShareStatus] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const sessionRef = useRef(createSessionFlow(storedBoot.lastGenre ?? 'cyberpunk', dailyBrief));
  const dailyAttemptRecordedRef = useRef(false);
  const runRecordedRef = useRef(false);
  const runStartedAtRef = useRef(Date.now());

  const runTrainingObservationsRef = useRef<TypingObservation[]>([]);
  const totalScoreRef = useRef(0);
  const deathSequenceTimerRef = useRef<number | null>(null);
  const landingTrackedRef = useRef(false);
  const firstSegmentTrackedRef = useRef(false);
  const challengeTrackedRef = useRef(false);


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
  /**
   * The typing screen only. Menus and debriefs keep the shell column — a sidebar
   * is fine on a menu; it is the game itself that should not look like a page.
   */
  const isTyping = gameState === GameState.PLAYING;

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
  // The player's weak letter pairs, handed to the story generator so the campaign
  // doubles as their drill.
  const trainingFocusTokens = useMemo(
    () => getTrainingFocusTokens(typingTraining),
    [typingTraining]
  );

  const skillHeadline = useMemo(() => getSkillHeadline(playerProgress), [playerProgress]);
  const progressSummary = useMemo(() => summarizeProgress(playerProgress), [playerProgress]);

  const activePact = useMemo(() => normalizePact(userProfile.pact), [userProfile.pact]);
  /**
   * The Pact the current run is being played under. Held in a ref and frozen at
   * launch: toggling a clause mid-run must not rewrite what the finished run is
   * recorded as having demanded.
   */
  const activePactRef = useRef<PactClauseId[]>([]);
  const openingMission = useMemo((): MissionState => (
      isPactClauseActive(activePact, 'hot_start')
          ? { ...DEFAULT_MISSION_STATE, heat: HOT_START_HEAT }
          : DEFAULT_MISSION_STATE
  ), [activePact]);
  const pactRewardMultiplier = useMemo(() => getPactRewardMultiplier(activePact), [activePact]);
  const branchThresholds = useMemo(() => (
      isPactClauseActive(activePact, 'exacting')
          ? { good: EXACTING_GOOD_ACCURACY, average: EXACTING_AVERAGE_ACCURACY, forgiven: 0 }
          : DEFAULT_BRANCH_THRESHOLDS
  ), [activePact]);

  const handleTogglePactClause = (id: PactClauseId) => {
      const pact = togglePactClause(activePact, id);
      captureProductEvent('typomancer_pact_toggled', {
          ...getAnalyticsContext(),
          clause: id,
          active: pact.includes(id)
      });
      setUserProfile(prev => ({ ...prev, pact, strictCase: pact.includes('strict_case') }));
  };

  // The pace the game measures the player at, tracking real runs rather than the
  // one calibration prompt they typed on their first day.
  const effectiveBaseline = useMemo(() => getEffectiveBaseline(playerProgress), [playerProgress]);

  const adaptiveDifficulty = useMemo(
    () => getAdaptiveDifficulty(playerProgress.calibration, playerProgress),
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

  // A tab closing mid-run is the only abandon signal available without a server
  // session; keepalive in captureProductEvent survives the unload.
  useEffect(() => {
    const onPageHide = () => {
        if (gameState !== GameState.PLAYING) return;
        captureProductEvent('typomancer_run_abandoned', {
            ...getAnalyticsContext(),
            daily: isDailyRun,
            level: currentLevel,
            run_number: playerProgress.runs.length + 1
        });
    };
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [gameState, isDailyRun, currentLevel, playerProgress.runs.length]);

  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
        event.preventDefault();
        setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onInstallPrompt);
  }, []);

  useEffect(() => {
    if (!incomingChallenge || challengeTrackedRef.current) return;
    challengeTrackedRef.current = true;
    captureProductEvent('typomancer_challenge_opened', {
      ...getAnalyticsContext(),
      daily_id_present: true,
      target_score_bucket: getMetricBucket(incomingChallenge.targetScore, 500, 10_000)
    });
    if (incomingChallenge.dailyId !== dailyBrief.dailyId) {
      captureProductEvent('typomancer_challenge_expired', {
        ...getAnalyticsContext(),
        target_score_bucket: getMetricBucket(incomingChallenge.targetScore, 500, 10_000)
      });
    }
  }, [incomingChallenge, dailyBrief.dailyId]);

  useEffect(() => {
    // The profile is read synchronously into state, so by the time this runs it
    // is always the real one. It used to load in an effect, and this save fired
    // in the same commit while state was still the default — clobbering the
    // stored profile. Production self-healed on the next render; under
    // StrictMode's double invoke the second load read the clobbered copy and the
    // whole profile was gone, so dev and tests could not be trusted with
    // anything persisted.
    const profileToSave = { ...userProfile, language, lastGenre: selectedGenre };
    try {
      playerStorage()?.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileToSave));
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
      daily: sessionRef.current.isDaily,
      genre: sessionRef.current.genre,
      level: stats.level,
      score: stats.score,
      wpm: stats.wpm,
      bestWpm: stats.bestWpm,
      accuracy: stats.accuracy,
      consistency: stats.consistency,
      mistakes: stats.mistakes,
      characters: stats.characters,
      durationSeconds,
      focus,
      pact: activePactRef.current
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
      mission: isLastRelay(
        (gameState === GameState.GAME_OVER ? finalStats?.mission : victoryReport?.mission) || campaignState
      ) ? 'last_relay' : (sessionRef.current.isDaily ? 'daily' : 'campaign'),
      daily: sessionRef.current.isDaily,
      genre: sessionRef.current.genre,
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
      daily: sessionRef.current.isDaily,
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
      if (!userProfile.strictCase && !isPactClauseActive(activePact, 'no_grace')) {
          mods.mistakeGraceCount += adaptiveDifficulty.mistakeGraceCount;
      }
      if (isPactClauseActive(activePact, 'no_grace')) mods.mistakeGraceCount = 0;
      if (isPactClauseActive(activePact, 'hunted')) mods.traceSpeedMultiplier *= HUNTED_TRACE_MULTIPLIER;
      // Permanent trace easing is bought, so it is priced: the calm build keeps
      // the game quieter for good and earns a quarter less for it. The difficulty
      // preset is exempt — it is fitted to a measured pace, not purchased.
      mods.creditMultiplier *= getComfortCreditMultiplier(u.signalDampener, META_UPGRADES.signalDampener.maxLevel);
      activePerks.forEach(perk => {
          mods = perk.apply(mods);
      });
      // Clamped last. The old clamp sat before perk application, so a Ghost
      // Protocol tier multiplied straight through it and the floor bounded
      // nothing: a maxed player faced a tracer at a fifth of its intended pace.
      mods.traceSpeedMultiplier = clampTraceSpeed(mods.traceSpeedMultiplier);
      setCurrentModifiers(mods);
  }, [activePerks, activePact, adaptiveDifficulty, userProfile.strictCase, userProfile.upgrades]);

  useEffect(() => {
    return () => {
      if (deathSequenceTimerRef.current !== null) window.clearTimeout(deathSequenceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.defaultPrevented || (e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable="true"],[data-account-panel]'))) return;
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
            if (e.key === '1') { initializeSession(); consume(); }
            if (e.key === '5' || e.key === 'Enter') { initializeRelay(); consume(); }
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

  const handleShareScore = () => {
      const isVictory = gameState === GameState.VICTORY;
      const score = Math.max(totalScore, finalStats?.score || 0);
      const runPact = activePactRef.current;
      const badge = runPact.length > 0
          ? `PACT ×${getPactRewardMultiplier(runPact).toFixed(2)}`
          : sessionRef.current.isDaily ? UI.daily_sector : undefined;
      const title = isVictory
          ? (victoryReport?.endingTitle || genrePack.ui.victoryTitle[language])
          : genrePack.ui.connectionSevered[language];
      const subtitle = sessionRef.current.isDaily && currentDailyDateLabel
          ? `${UI.daily_sector} · ${currentDailyDateLabel}`
          : genrePack.name[language];
      const shareText = sessionRef.current.isDaily && sessionRef.current.dailyId
          ? (() => {
              const url = buildChallengeShareUrl(location.origin, sessionRef.current.dailyId, score, language);
              return language === 'ru'
                  ? `Я набрал ${score} в Дневном секторе Typomancer. Сможешь побить? ${url}`
                  : `I scored ${score} in Typomancer's Daily Sector. Can you beat it? ${url}`;
          })()
          : language === 'ru'
            ? `Мой счёт ${score} в Typomancer: ${location.origin}`
            : `I scored ${score} in Typomancer: ${location.origin}`;
      void shareScoreCardImage({
          outcome: isVictory ? 'victory' : 'defeat',
          title,
          subtitle,
          score,
          wpm: Math.round(isVictory ? victoryReport?.avgWpm ?? 0 : finalStats?.wpm ?? 0),
          accuracy: isVictory ? victoryReport?.accuracy ?? 100 : finalStats?.accuracy ?? 100,
          badge,
          language
      }, shareText);
  };

  const handleInstallApp = () => {
      if (!installPromptEvent) return;
      captureProductEvent('typomancer_install_prompted', getAnalyticsContext());
      void installPromptEvent.prompt().finally(() => setInstallPromptEvent(null));
  };

  const handleToggleMusic = () => {
      const active = audioEngine.toggle();
      setMusicActive(active);
  };

  const handleToggleSkillStack = () => {
      const next = toggleSkillStackAnchor(skillStackAnchor);
      writeSkillStackAnchor(next, window.localStorage);
      setSkillStackAnchor(next);
  };

  const handleToggleLanguage = () => {
      setLanguage(prev => prev === 'en' ? 'ru' : 'en');
  };

  const prepareSession = (dailySeed?: string) => {
      runRecordedRef.current = false;
      runStartedAtRef.current = Date.now();
      activePactRef.current = activePact;
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
      setCampaignState(openingMission);
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
          .map(d => createPerk(d, 0, hubSkin, language));
      setOfferedPerks(starters);
      dailyAttemptRecordedRef.current = false;
      firstSegmentTrackedRef.current = false;
      runTrainingObservationsRef.current = [];
  };

  const initializeSession = () => {
      sessionRef.current.calibrationMode = 'calibration';
      clearRunCheckpoint();
      setRunCheckpoint(null);
      prepareSession();
      setIsDailyRun(false);
      sessionRef.current.isDaily = false;
      setCurrentDailyId(null);
      sessionRef.current.dailyId = null;
      setCurrentDailyDateLabel(null);
      // A newcomer meets the story first. Calibration used to be the very first
      // thing a stranger saw: a 93-character typing test, before the game had
      // shown them what it was for. The baseline now tracks real runs, so an
      // uncalibrated player self-corrects within a few sectors — and the offer to
      // calibrate lands after the first run, when they know what it tunes.
      setGameState(GameState.GENRE_SELECTION);
      audioEngine.unlock();
  };

  const initializeRelay = () => {
      clearRunCheckpoint();
      setRunCheckpoint(null);
      prepareSession();
      const mission = { ...openingMission, flags: [...openingMission.flags, LAST_RELAY] };
      setCampaignState(mission);
      setSelectedGenre('cyberpunk');
      sessionRef.current.genre = 'cyberpunk';
      setIsDailyRun(false);
      sessionRef.current.isDaily = false;
      setCurrentDailyId(null);
      sessionRef.current.dailyId = null;
      setCurrentDailyDateLabel(null);
      setInitialSegment(getRelayStart(1, language, mission));
      setCharacterDesc(RELAY_CHARACTER);
      setGameState(GameState.PLAYING);
      audioEngine.unlock();
      captureProductEvent('typomancer_run_started', {
          ...getAnalyticsContext(), daily: false, genre: 'cyberpunk', mission: 'last_relay',
          preset: adaptiveDifficulty.preset, run_number: playerProgress.runs.length + 1,
          returning_player: playerProgress.runs.length > 0
      });
  };

  const resumeSession = async () => {
      const checkpoint = loadRunCheckpoint();
      if (!checkpoint) {
          setRunCheckpoint(null);
          return;
      }

      const restoredPerks = checkpoint.perks.flatMap((savedPerk) => {
          const definition = PERK_DEFINITIONS.find((candidate) => candidate.groupId === savedPerk.groupId);
          return definition ? [createPerk(definition, savedPerk.tier - 1, hubSkin, language)] : [];
      });
      setStoryLog([]);
      runRecordedRef.current = false;
      runStartedAtRef.current = Date.now();
      activePactRef.current = activePact;
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
      sessionRef.current.genre = checkpoint.genre;
      setIsDailyRun(false);
      sessionRef.current.isDaily = false;
      setCurrentDailyId(null);
      sessionRef.current.dailyId = null;
      setCurrentDailyDateLabel(null);
      setGameState(GameState.LOADING);
      audioEngine.unlock();
      captureProductEvent('typomancer_run_started', {
          ...getAnalyticsContext(),
          daily: false,
          genre: checkpoint.genre,
          mission: isLastRelay(checkpoint.mission) ? 'last_relay' : 'campaign',
          preset: adaptiveDifficulty.preset,
          run_number: playerProgress.runs.length + 1,
          returning_player: playerProgress.runs.length > 0,
          resumed: true
      });

      if (isLastRelay(checkpoint.mission)) setCharacterDesc(RELAY_CHARACTER);

      try {
          const nextStart = isLastRelay(checkpoint.mission)
            ? getRelayStart(checkpoint.nextLevel, language, checkpoint.mission)
            : await generateNextLevelStart(
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
      sessionRef.current.calibrationMode = 'calibration';
      const brief = getDailyBrief();
      const latestState = getDailyState(brief.dailyId);
      setDailyBrief(brief);
      setDailyState(latestState);
      if (latestState.attemptsUsed >= DAILY_MAX_ATTEMPTS) return;

      prepareSession(brief.dailyId);
      sessionRef.current.dailyBrief = brief;
      setIsDailyRun(true);
      sessionRef.current.isDaily = true;
      setCurrentDailyId(brief.dailyId);
      sessionRef.current.dailyId = brief.dailyId;
      setCurrentDailyDateLabel(brief.dateLabel);
      setSelectedGenre(brief.genre);
      sessionRef.current.genre = brief.genre;
      setGameState(GameState.STARTER_PERK_SELECTION);
      audioEngine.unlock();
  };

  const finishCalibration = (result: CalibrationResult, observations: TypingObservation[] = [], skipped = false) => {
      const mode = sessionRef.current.calibrationMode;
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
          sessionRef.current.calibrationMode = 'calibration';
          setGameState(GameState.OPERATOR_RECORD);
          return;
      }
      setPlayerProgressState((current) => savePlayerProgress(setCalibration(current, result)));
      captureProductEvent('typomancer_calibration_completed', {
          ...getAnalyticsContext(),
          recalibration: sessionRef.current.calibrationNext === 'record',
          skipped,
          wpm_bucket: getMetricBucket(result.wpm),
          accuracy_bucket: getAccuracyBucket(result.accuracy),
          preset: result.preset
      });
      if (sessionRef.current.calibrationNext === 'daily') setGameState(GameState.STARTER_PERK_SELECTION);
      else if (sessionRef.current.calibrationNext === 'record') setGameState(GameState.OPERATOR_RECORD);
      else setGameState(GameState.GENRE_SELECTION);
  };

  const skipCalibration = () => {
      if (sessionRef.current.calibrationMode === 'drill') {
          sessionRef.current.calibrationMode = 'calibration';
          setGameState(GameState.OPERATOR_RECORD);
          return;
      }
      finishCalibration(createBalancedCalibration(), [], true);
  };

  const recalibrate = () => {
      sessionRef.current.calibrationMode = 'calibration';
      sessionRef.current.calibrationNext = 'record';
      captureProductEvent('typomancer_calibration_started', {
          ...getAnalyticsContext(),
          recalibration: true
      });
      setGameState(GameState.CALIBRATION);
  };

  const startTargetedDrill = (focus?: string[]) => {
      setDrillFocus(focus);
      sessionRef.current.calibrationMode = 'drill';
      sessionRef.current.calibrationNext = 'record';
      captureProductEvent('typomancer_drill_started', {
          ...getAnalyticsContext(),
          samples_bucket: getMetricBucket(typingTraining.samples, 100, 2000),
          weak_pattern_count: getWeakPatterns(typingTraining, 5).length
      });
      setGameState(GameState.CALIBRATION);
  };

  const shareDailyChallenge = async (outcome: 'victory' | 'defeat', score: number) => {
      if (!sessionRef.current.isDaily || !sessionRef.current.dailyId || typeof location === 'undefined') return;
      const url = buildChallengeShareUrl(location.origin, sessionRef.current.dailyId, score, language);
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
      sessionRef.current.genre = genre;
      setGameState(GameState.STARTER_PERK_SELECTION);
  };

  const handleStarterPerkSelect = (perk: Perk) => {
      setActivePerks([perk]);
      beginStoryGeneration(sessionRef.current.genre);
  };

  const beginStoryGeneration = async (genre: StoryGenreId = sessionRef.current.genre) => {
    setGameState(GameState.LOADING);
    captureProductEvent('typomancer_run_started', {
      ...getAnalyticsContext(),
      daily: sessionRef.current.isDaily,
      genre,
      preset: adaptiveDifficulty.preset,
      run_number: playerProgress.runs.length + 1,
      returning_player: playerProgress.runs.length > 0
    });
    const activeBrief = sessionRef.current.dailyBrief;
    const startRequest = sessionRef.current.isDaily && sessionRef.current.dailyId === activeBrief.dailyId
      ? Promise.resolve<StorySegment>({
          text: activeBrief.opening[language],
          mood: StoryMood.TENSE,
          type: SegmentType.NARRATIVE
        })
      : generateStoryStart(language, genre);
    try {
        const [start, charProfile] = await Promise.all([
            startRequest,
            generateCharacterProfile(language, genre)
        ]);
        setInitialSegment(start);
        setCharacterDesc(charProfile);
    } catch {
        // A rejection here must not strand the player on LOADING — fall back to
        // the authored opening like every other generation path does.
        const local = getGenrePack(genre).local[language];
        setInitialSegment({ text: local.start, mood: StoryMood.TENSE, type: SegmentType.NARRATIVE, skill: 'flow' });
        setCharacterDesc(local.protagonist);
    }
    setGameState(GameState.PLAYING);
  };

  const getEndingTitle = (report: LevelReport): string => {
      const mission = report.mission || campaignState;
      if (isLastRelay(mission)) return getRelayEnding(mission, language).title;
      if (mission.evidence >= 55 && mission.heat < 55 && mission.trust >= 45) {
          return worldSkin.endings.ghost[language];
      }
      if (mission.evidence >= 55 && mission.route === 'loud') {
          return worldSkin.endings.loud[language];
      }
      if (mission.heat >= 75 || mission.trust < 18) {
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
      // One multiplier for both currencies: the Pact is the whole reason to take
      // a harder run, so it has to pay on every axis the player is tracking.
      const xp = Math.floor(levelScore * (1 + (finalRoundStats.level * 0.1)) * pactRewardMultiplier);
      setLevelXpGained(xp);
      const creditsEarned = Math.floor((finalRoundStats.credits || 0) * pactRewardMultiplier);
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
      if (finalTrace >= 90 || finalRoundStats.health <= 5 || mission.heat > 80) performanceRating = 'bad';
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

      const isFinal = sessionRef.current.isDaily || finalRoundStats.level >= (isLastRelay(mission) ? RELAY_SECTORS : CAMPAIGN_SECTORS);
      const upgradeOptions = isFinal ? [] : getUpgradeOptions(performanceRating, activePerks, hubSkin, language);
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

      const summary = isLastRelay(mission)
        ? getRelaySummary(finalRoundStats.level, mission, language)
        : await generateLevelSummary(finalRoundStats.level, report, storyLog.map(l => l.text).join(" "), language, sessionRef.current.genre);
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
              genre: sessionRef.current.genre,
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
          const nextStartSegment = isLastRelay(campaignState)
            ? getRelayStart(nextLvl, language, campaignState)
            : await generateNextLevelStart(nextLvl, narrativeContext, language, campaignState, sessionRef.current.genre);
          setInitialSegment(nextStartSegment);
          setGameState(GameState.PLAYING);
        } catch (e) {
          const fallback = getGenrePack(sessionRef.current.genre).local[language].levelStart[nextLvl - 1]
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
          genre: sessionRef.current.genre,
          level: lastLevelReport.level,
          score,
          wpm,
          bestWpm,
          accuracy,
          consistency,
          mistakes,
          characters,
          durationSeconds,
          focus,
          pact: activePactRef.current
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
          mission: isLastRelay(campaignState) ? 'last_relay' : 'campaign',
          daily: false,
          genre: sessionRef.current.genre,
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
          daily: sessionRef.current.isDaily,
          genre: sessionRef.current.genre,
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
    // The Pact the run was played under, not whatever the menu shows now.
    const runPact = activePactRef.current;
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
          ...(runPact.length ? [{ label: UI.pact_title, value: `x${getPactRewardMultiplier(runPact).toFixed(2)}` }] : []),
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
        ...(runPact.length ? [{ label: UI.pact_title, value: `x${getPactRewardMultiplier(runPact).toFixed(2)}` }] : []),
        { label: UI.score, value: String(defeatScore) }
      ]
    };
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

      {deathSequenceActive && <DeathSequence label={UI.signal_lost} />}

      {/* Status strip — what the shell column was actually for, minus the parts
          other screens already show. No document column: the wordmark repeats the
          title on screen, the mission meters live on the run HUD and in the
          debrief tiles, and the log moved into the debrief where reading a feed
          makes sense. */}
      {!isTyping && (
        <HudStrip
          ui={UI}
          credits={userProfile.credits}
          perks={activePerks}
          musicActive={musicActive}
          skillStackAnchor={skillStackAnchor}
          language={language}
          onToggleMusic={handleToggleMusic}
          onToggleSkillStack={handleToggleSkillStack}
          onToggleLanguage={handleToggleLanguage}
        />
      )}


      <div className={`relative z-10 flex w-full flex-col md:h-screen overflow-hidden ${isTyping ? '' : 'pt-10'} ${inSimulation ? 'h-[100dvh]' : ''}`}>
        <div className="absolute inset-0 opacity-5 pointer-events-none"
             style={{ backgroundImage: 'linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
        </div>

        <div className={`flex-1 min-h-0 flex justify-center p-2 sm:p-6 relative z-10 ${gameState === GameState.MENU ? 'items-start overflow-y-auto' : 'items-center'}`}>
            {gameState === GameState.MENU && (
                <MenuScreen
                    ui={UI}
                    language={language}
                    incomingChallenge={incomingChallenge}
                    isCurrentChallenge={isCurrentChallenge}
                    dailyBrief={dailyBrief}
                    dailyGenrePack={dailyGenrePack}
                    dailyState={dailyState}
                    dailyAttemptsLeft={dailyAttemptsLeft}
                    dailyAttemptsExhausted={dailyAttemptsExhausted}
                    runCheckpoint={runCheckpoint}
                    skillHeadline={skillHeadline}
                    progressSummary={progressSummary}
                    pactRewardMultiplier={pactRewardMultiplier}
                    activePact={activePact}
                    onTogglePactClause={handleTogglePactClause}
                    onPactOpened={() => captureProductEvent('typomancer_pact_opened', getAnalyticsContext())}
                    onRelay={initializeRelay}
                    onInitialize={initializeSession}
                    onDaily={initializeDailySession}
                    onResume={resumeSession}
                    canInstall={installPromptEvent !== null}
                    onInstall={handleInstallApp}
                    onBlackMarket={() => setGameState(GameState.BLACK_MARKET)}
                    onOperatorRecord={() => setGameState(GameState.OPERATOR_RECORD)}
                />
            )}

            {gameState === GameState.CALIBRATION && (
                <Suspense fallback={null}>
                <CalibrationPanel
                    language={language}
                    mode={sessionRef.current.calibrationMode}
                    drillPrompt={buildTargetedDrill(language, typingTraining, drillFocus)}
                    onComplete={finishCalibration}
                    onSkip={skipCalibration}
                />
                </Suspense>
            )}

            {gameState === GameState.OPERATOR_RECORD && (
                <Suspense fallback={null}>
                <OperatorRecord
                    language={language}
                    progress={playerProgress}
                    training={typingTraining}
                    onClose={() => setGameState(GameState.MENU)}
                    onRecalibrate={recalibrate}
                    onStartDrill={startTargetedDrill}
                />
                </Suspense>
            )}

            {gameState === GameState.BLACK_MARKET && (
                <BlackMarketScreen
                    ui={UI}
                    language={language}
                    skin={hubSkin}
                    profile={userProfile}
                    onBuy={handleBuyUpgrade}
                    onClose={() => setGameState(GameState.MENU)}
                />
            )}

            {gameState === GameState.GENRE_SELECTION && (
                <GenreSelectionScreen
                    ui={UI}
                    language={language}
                    onSelect={handleGenreSelect}
                    onBack={() => setGameState(GameState.MENU)}
                />
            )}

            {gameState === GameState.STARTER_PERK_SELECTION && (
                <StarterPerkScreen
                    ui={UI}
                    language={language}
                    perks={offeredPerks}
                    genrePack={genrePack}
                    genre={selectedGenre}
                    onSelect={handleStarterPerkSelect}
                />
            )}

            {gameState === GameState.LEVEL_COMPLETE && lastLevelReport && (
                <SectorCompleteScreen
                    ui={UI}
                    report={lastLevelReport}
                    xpGained={levelXpGained}
                    storyLog={storyLog}
                    fallbackMission={campaignState}
                    perks={offeredPerks}
                    ready={isSectorSummaryReady}
                    pactClauses={activePactRef.current}
                    onSelectPerk={handleSelectPerk}
                    onBankExit={handleBankExit}
                />
            )}

            {gameState === GameState.LOADING && (
                <LoadingScreen ui={UI} nextSector={currentLevel > 1} />
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
                    baselineWpm={effectiveBaseline.wpm}
                    trainingFocus={trainingFocusTokens}
                    branchThresholds={branchThresholds}
                    skillStackAnchor={skillStackAnchor}
                    onTypingObservation={(observation) => runTrainingObservationsRef.current.push(observation)}
                />
            )}

            {gameState === GameState.VICTORY && victoryReport && (
                <VictoryScreen
                    ui={UI}
                    language={language}
                    report={victoryReport}
                    fallbackMission={campaignState}
                    genrePack={genrePack}
                    challengeVerdict={challengeVerdict}
                    challenge={incomingChallenge}
                    yourScore={completedChallengeScore}
                    canShareChallenge={isDailyRun && !!currentDailyId}
                    challengeShared={challengeShareStatus}
                    hasComic={comicFrames.length > 0}
                    onShareChallenge={() => shareDailyChallenge('victory', totalScore)}
                    onShareScore={handleShareScore}
                    onShowComic={() => setShowComic(true)}
                    onMenu={() => setGameState(GameState.MENU)}
                />
            )}

            {gameState === GameState.GAME_OVER && (
                <GameOverScreen
                    ui={UI}
                    language={language}
                    stats={finalStats}
                    coachText={typingCoachText}
                    fallbackMission={campaignState}
                    genrePack={genrePack}
                    challengeVerdict={challengeVerdict}
                    challenge={incomingChallenge}
                    yourScore={completedChallengeScore}
                    canShareChallenge={isDailyRun && !!currentDailyId}
                    challengeShared={challengeShareStatus}
                    hasComic={comicFrames.length > 0}
                    onShareChallenge={() => shareDailyChallenge('defeat', Math.max(totalScore, finalStats?.score || 0))}
                    onShareScore={handleShareScore}
                    onShowComic={() => setShowComic(true)}
                    onMenu={() => setGameState(GameState.MENU)}
                />
            )}
        </div>
      </div>

      {showComic && (comicFrames.length > 0) && (() => {
        const data = buildComicData();
        return (
          <Suspense fallback={null}>
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
          </Suspense>
        );
      })()}
    </div>
  );
};

export default App;
