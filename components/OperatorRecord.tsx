import React, { useMemo } from 'react';

import type { Language, StoryGenreId } from '../types';
import { getAdaptiveDifficulty, summarizeProgress, type PlayerProgress, type RunRecord } from '../services/playerProgress';
import { getBenchmarkDelta, getWeakPatterns, type TypingTrainingProfile } from '../services/typingTraining';

interface OperatorRecordProps {
  language: Language;
  progress: PlayerProgress;
  training: TypingTrainingProfile;
  onClose: () => void;
  onRecalibrate: () => void;
  onStartDrill: () => void;
}

const COPY = {
  en: {
    eyebrow: 'LOCAL FLIGHT RECORDER',
    title: 'Operator Record',
    subtitle: 'Your last 20 operations stay on this device.',
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
    daily: 'DAILY',
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
    noPatterns: 'Complete a calibration or operation to map your weak keys.',
    samples: 'KEYSTROKES MAPPED',
    startDrill: 'START TARGETED DRILL',
    baseline: 'SINCE BASELINE',
    needBaseline: 'Run two focused drills to reveal measurable improvement.'
  },
  ru: {
    eyebrow: 'ЛОКАЛЬНЫЙ ЧЁРНЫЙ ЯЩИК',
    title: 'Досье оператора',
    subtitle: 'Последние 20 операций остаются на этом устройстве.',
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
    daily: 'ДНЕВНОЙ',
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
    noPatterns: 'Пройди калибровку или операцию, чтобы найти слабые клавиши.',
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
  dark_fable: { en: 'Dark Fable', ru: 'Тёмная сказка' }
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
  const summary = summarizeProgress(progress);
  const difficulty = getAdaptiveDifficulty(progress.calibration);
  const points = useMemo(() => buildSignalPoints(summary.recentRuns), [summary.recentRuns]);
  const trendLabel = summary.wpmDelta > 0.5 ? ui.up : summary.wpmDelta < -0.5 ? ui.down : ui.steady;
  const weakPatterns = getWeakPatterns(training, 5);
  const benchmarkDelta = getBenchmarkDelta(training);
  const displayPattern = (token: string) => token === ' ' ? (language === 'ru' ? 'ПРОБЕЛ' : 'SPACE') : token;

  return (
    <section className="operator-record screens-cut-panel" aria-labelledby="operator-record-title">
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

      <div className="operator-record-stats">
        <div><strong>{summary.totalRuns}</strong><span>{ui.runs}</span></div>
        <div><strong>{summary.bestWpm}</strong><span>{ui.best}</span></div>
        <div><strong>{Math.round(summary.averageWpm)}</strong><span>{ui.average}</span></div>
        <div><strong>{summary.totalRuns > 0 ? `${Math.round(summary.averageAccuracy)}%` : '—'}</strong><span>{ui.accuracy}</span></div>
        <div><strong>{summary.currentStreak}</strong><span>{ui.streak}</span></div>
      </div>

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
                  <b key={pattern.token}>{displayPattern(pattern.token)} <small>{Math.round((pattern.errors / pattern.attempts) * 100)}%</small></b>
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
          <button type="button" onClick={onStartDrill} className="btn-cyber btn-cyber-primary">{ui.startDrill}</button>
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
                  <strong>{GENRES[run.genre][language]}</strong>
                  <span>{run.daily ? `${ui.daily} · ` : ''}{ui.level} {run.level} · {run.outcome === 'victory' ? ui.victory : ui.defeat}</span>
                </div>
                <b>{run.wpm} <small>WPM</small></b>
                <b>{Math.round(run.accuracy)}<small>%</small></b>
              </article>
            ))}
          </div>
        </div>
      )}

      <footer className="operator-record-footer">
        <button type="button" onClick={onClose} className="btn-cyber btn-cyber-primary">
          <span className="keycap">ESC</span>{ui.close}
        </button>
      </footer>
    </section>
  );
};

export default OperatorRecord;
