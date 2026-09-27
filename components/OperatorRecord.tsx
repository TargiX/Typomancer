import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import OperatorTelemetry from './OperatorTelemetry';
import WeeklyProgress from './WeeklyProgress';
import { getPactRewardMultiplier } from '../services/pact';

import type { Language, StoryGenreId } from '../types';
import { getComparableRuns, getAdaptiveDifficulty, summarizeProgress, type PlayerProgress, type RunRecord,
  MAX_RUN_HISTORY
} from '../services/playerProgress';
import { getBenchmarkDelta, getDrillPatterns, type TypingTrainingProfile } from '../services/typingTraining';

interface OperatorRecordProps {
  language: Language;
  progress: PlayerProgress;
  training: TypingTrainingProfile;
  onClose: () => void;
  onRecalibrate: () => void;
  onStartDrill: (focus?: string[]) => void;
}

const COPY = {
  en: {
    eyebrow: 'FLIGHT RECORDER',
    title: 'Operator Record',
    subtitle: `Your last ${MAX_RUN_HISTORY} saved operations. Sign in from the deck to sync across devices.`,
    runs: 'RUNS',
    best: 'PEAK WPM',
    average: 'RECENT AVG',
    accuracy: 'ACCURACY',
    streak: 'DAY STREAK',
    trend: 'SPEED SIGNAL',
    noRuns: 'No completed operations yet. Finish one sector to start the recorder.',
    recent: 'RECENT OPERATIONS',
    victory: 'PUBLISHED',
    defeat: 'SEVERED',
    banked: 'BANKED',
    daily: 'DAILY',
    pact: 'PACT',
    level: 'LVL',
    target: 'NEXT TRANSMISSION',
    targets: {
      accuracy: 'Hold accuracy above 96% before pushing speed.',
      consistency: 'Keep one steady rhythm from the first line to the last.',
      speed: 'Add 5 WPM without giving up accuracy.',
      mastery: 'Maintain control under a higher-pressure route.'
    },
    todayDone: 'Today is logged. Return for tomorrow’s Daily Sector.',
    todayOpen: 'Complete today’s Daily Sector to extend your streak.',
    calibration: 'ADAPTIVE LINK',
    notSet: 'NOT SET',
    recalibrate: 'RECALIBRATE',
    close: 'BACK TO DECK',
    up: 'UP',
    down: 'DOWN',
    steady: 'STEADY',
    training: 'TRAINING CORE',
    weakPatterns: 'WEAK PATTERNS',
    noPatterns: 'Keep typing in this language. A practice suggestion needs at least 6 attempts on a key or pair.',
    samples: 'KEYSTROKES MAPPED',
    startDrill: 'START TARGETED DRILL',
    baseline: 'SINCE BASELINE',
    needBaseline: 'Run two focused drills to reveal measurable improvement.'
  },
  ru: {
    eyebrow: 'ЧЁРНЫЙ ЯЩИК',
    title: 'Досье оператора',
    subtitle: `Последние ${MAX_RUN_HISTORY} сохранённых операций. Войди с пульта для синхронизации между устройствами.`,
    runs: 'ЗАБЕГИ',
    best: 'ПИК СЛ/М',
    average: 'СРЕДНЯЯ',
    accuracy: 'ТОЧНОСТЬ',
    streak: 'ДНЕЙ ПОДРЯД',
    trend: 'СИГНАЛ СКОРОСТИ',
    noRuns: 'Завершённых операций пока нет. Пройди один сектор, чтобы запустить запись.',
    recent: 'ПОСЛЕДНИЕ ОПЕРАЦИИ',
    victory: 'ОПУБЛИКОВАНО',
    defeat: 'ОБРЫВ',
    banked: 'СОХРАНЕНО',
    daily: 'ДНЕВНОЙ',
    pact: 'ПАКТ',
    level: 'УР',
    target: 'СЛЕДУЮЩАЯ ПЕРЕДАЧА',
    targets: {
      accuracy: 'Сначала удержи точность выше 96%, затем ускоряйся.',
      consistency: 'Сохраняй один ритм от первой строки до последней.',
      speed: 'Добавь 5 СЛ/М, не отдавая точность.',
      mastery: 'Сохрани контроль на маршруте с большим давлением.'
    },
    todayDone: 'Сегодняшний результат записан. Возвращайся к завтрашнему сектору.',
    todayOpen: 'Пройди сегодняшний сектор, чтобы продлить серию.',
    calibration: 'АДАПТИВНЫЙ КАНАЛ',
    notSet: 'НЕ НАСТРОЕН',
    recalibrate: 'ПЕРЕНАСТРОИТЬ',
    close: 'ВЕРНУТЬСЯ К ПУЛЬТУ',
    up: 'РОСТ',
    down: 'СПАД',
    steady: 'РОВНО',
    training: 'ТРЕНИРОВОЧНОЕ ЯДРО',
    weakPatterns: 'СЛАБЫЕ СОЧЕТАНИЯ',
    noPatterns: 'Продолжай печатать на этом языке. Для рекомендации нужно хотя бы 6 попыток на клавишу или пару.',
    samples: 'НАЖАТИЙ ИЗУЧЕНО',
    startDrill: 'НАЧАТЬ ТОЧЕЧНУЮ ТРЕНИРОВКУ',
    baseline: 'ОТ БАЗОВОГО УРОВНЯ',
    needBaseline: 'Пройди две точечные тренировки, чтобы увидеть измеримый прогресс.'
  }
};

const GENRES: Record<StoryGenreId, Record<Language, string>> = {
  cyberpunk: { en: 'Cyberpunk', ru: 'Киберпанк' },
  space_horror: { en: 'Space Horror', ru: 'Космохоррор' },
  noir: { en: 'Noir', ru: 'Нуар' },
  dark_fable: { en: 'Dark Fable', ru: 'Тёмная сказка' },
  dead_channel: { en: 'Dead Channel', ru: 'Мёртвый канал' }
};

const buildSignalPoints = (runs: RunRecord[]): string => {
  const values = [...runs].reverse().map((run) => run.wpm);
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(10, max - min);
  return values.map((value, index) => {
    const x = values.length === 1 ? 160 : 8 + ((index / (values.length - 1)) * 304);
    const y = 64 - (((value - min) / range) * 52);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
};

const OperatorRecord: React.FC<OperatorRecordProps> = ({ language, progress, training, onClose, onRecalibrate, onStartDrill }) => {
  const ui = COPY[language];
  const summary = summarizeProgress(progress, new Date(), language);
  const difficulty = getAdaptiveDifficulty(progress.calibration, progress, language);
  const points = useMemo(() => buildSignalPoints(getComparableRuns(progress, language).slice(0, 8)), [progress, language]);
  const trendLabel = summary.wpmDelta > 0.5 ? ui.up : summary.wpmDelta < -0.5 ? ui.down : ui.steady;
  const weakPatterns = getDrillPatterns(language, training, 6);
  const benchmarkDelta = getBenchmarkDelta(training, language);
  const displayPattern = (token: string) => token === ' ' ? (language === 'ru' ? 'ПРОБЕЛ' : 'SPACE') : token;

  // Portal to <body>: the record is a full-page takeover, and the app shell's
  // `relative z-10` column would cap its stacking below the HUD strip.
  return createPortal(
    <section className="operator-record" aria-labelledby="operator-record-title">
      <div className="operator-record-bar">
        <span className="operator-record-bar-title">{ui.title}</span>
        <button type="button" className="operator-record-close" onClick={onClose} aria-label={ui.close}>
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg>
        </button>
      </div>

      <div className="operator-record-body">
        <header className="operator-record-header">
          <div>
            <span>{ui.eyebrow}</span>
            <h2 id="operator-record-title">{ui.title}</h2>
            <p>{ui.subtitle}</p>
          </div>
          <div className="operator-record-calibration">
            <span>{ui.calibration}</span>
            <strong>{progress.calibration ? difficulty.preset : ui.notSet}</strong>
            <button type="button" onClick={onRecalibrate}>{ui.recalibrate}</button>
          </div>
        </header>

        <OperatorTelemetry language={language} progress={progress} training={training} />

        <div className="operator-record-stats">
          <div><strong>{summary.totalRuns}</strong><span>{ui.runs}</span></div>
          <div><strong>{summary.bestWpm}</strong><span>{ui.best}</span></div>
          <div><strong>{Math.round(summary.averageWpm)}</strong><span>{ui.average}</span></div>
          <div><strong>{summary.totalRuns > 0 ? `${Math.round(summary.averageAccuracy)}%` : '—'}</strong><span>{ui.accuracy}</span></div>
          <div><strong>{summary.currentStreak}</strong><span>{ui.streak}</span></div>
        </div>

        <div className="operator-record-duo">
          <div className="operator-record-stack">
            <div className="operator-record-signal">
              <div className="operator-record-section-label">
                <span>{ui.trend}</span>
                <b className={summary.wpmDelta > 0.5 ? 'is-up' : summary.wpmDelta < -0.5 ? 'is-down' : ''}>
                  {trendLabel}{summary.wpmDelta === 0 ? '' : ` ${summary.wpmDelta > 0 ? '+' : ''}${Math.round(summary.wpmDelta)} WPM`}
                </b>
              </div>
              {points ? (
                <svg viewBox="0 0 320 72" preserveAspectRatio="none" role="img" aria-label={`${ui.trend}: ${trendLabel}`}>
                  <defs>
                    <linearGradient id="operator-signal-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#38bdf8" stopOpacity="0.3" />
                      <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polygon className="operator-record-signal-fill" points={`0,72 ${points} 320,72`} />
                  <polyline className="operator-record-signal-shadow" points={points} />
                  <polyline className="operator-record-signal-line" points={points} />
                </svg>
              ) : <p className="operator-record-empty">{ui.noRuns}</p>}
            </div>

            <div className="operator-record-target">
              <span>{ui.target}</span>
              <p>{summary.latestFocus ? ui.targets[summary.latestFocus] : ui.noRuns}</p>
              <small>{summary.hasRunToday ? ui.todayDone : ui.todayOpen}</small>
            </div>
          </div>

          <WeeklyProgress language={language} progress={progress} training={training} />
        </div>

        <div className="operator-record-training">
          <div className="operator-record-section-label">
            <span>{ui.training}</span>
            <b>{training.samples} {ui.samples}</b>
          </div>
          <div className="operator-record-training-grid">
            <div>
              <small>{ui.weakPatterns}</small>
              {weakPatterns.length > 0 ? (
                <div className="operator-record-patterns">
                  {weakPatterns.map((pattern) => (
                    <button type="button" className="operator-pattern-action" key={pattern.token} onClick={() => onStartDrill([pattern.token])}
                      aria-label={language === 'ru' ? `Тренировать ${pattern.token}` : `Practice ${pattern.token}`}>
                      <b>{displayPattern(pattern.token)}</b> <small>{pattern.errors}/{pattern.attempts} {language === 'ru' ? 'ошибок' : 'errors'}</small>
                    </button>
                  ))}
                </div>
              ) : <p>{ui.noPatterns}</p>}
            </div>
            <div>
              <small>{ui.baseline}</small>
              {benchmarkDelta ? (
                <p><strong>{benchmarkDelta.wpm >= 0 ? '+' : ''}{benchmarkDelta.wpm} WPM</strong> · {benchmarkDelta.accuracy >= 0 ? '+' : ''}{Math.round(benchmarkDelta.accuracy)}% · {benchmarkDelta.sessions}</p>
              ) : <p>{ui.needBaseline}</p>}
            </div>
            <button type="button" onClick={() => onStartDrill()} className="operator-record-drill">{ui.startDrill}</button>
          </div>
        </div>

        {summary.recentRuns.length > 0 && (
          <div className="operator-record-log">
            <div className="operator-record-section-label"><span>{ui.recent}</span></div>
            <div className="operator-record-log-scroll">
              {summary.recentRuns.map((run) => (
                <article key={run.id} className={`operator-record-run is-${run.outcome}`}>
                  <time dateTime={run.endedAt}>{new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric' }).format(new Date(run.endedAt))}</time>
                  <div>
                    <strong>
                      {GENRES[run.genre][language]}
                      {/* A full-Pact clear and a default clear should not read as
                          the same row. */}
                      {run.pact.length > 0 && (
                        <span className="operator-record-pact" title={run.pact.join(', ')}>
                          {ui.pact} x{getPactRewardMultiplier(run.pact).toFixed(2)}
                        </span>
                      )}
                    </strong>
                    <span>{run.daily ? `${ui.daily} · ` : ''}{ui.level} {run.level} · {run.outcome === 'victory' ? ui.victory : run.outcome === 'banked' ? ui.banked : ui.defeat}</span>
                  </div>
                  <b>{run.wpm} <small>WPM</small></b>
                  <b>{Math.round(run.accuracy)}<small>%</small></b>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>,
    document.body
  );
};

export default OperatorRecord;
