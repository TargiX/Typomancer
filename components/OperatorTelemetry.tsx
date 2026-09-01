import React, { useMemo } from 'react';

import type { Language } from '../types';
import type { PlayerProgress } from '../services/playerProgress';
import type { TypingTrainingProfile } from '../services/typingTraining';
import {
  getLatencySpread,
  getPatternDiagnostics,
  getSkillHeadline,
  getSkillSeries,
  getSteadiestPatterns,
  type PatternDiagnostic
} from '../services/progressAnalytics';

/**
 * OPERATOR TELEMETRY — the progress readout.
 *
 * Deliberately not a dashboard: no smooth gradients, no rounded chart, no card
 * grid. A stepped trace on a ruled grid, segmented latency bars, monospace
 * readouts. It should look like an instrument reporting on the player, because
 * that is exactly what it is.
 */

interface OperatorTelemetryProps {
  language: Language;
  progress: PlayerProgress;
  training: TypingTrainingProfile;
}

const COPY = {
  en: {
    eyebrow: 'OPERATOR TELEMETRY',
    faster: 'FASTER THAN WHEN YOU STARTED',
    slower: 'SLOWER THAN WHEN YOU STARTED',
    holding: 'HOLDING YOUR PACE',
    sessions: 'sessions',
    across: 'across',
    days: 'days',
    needMore: 'Keep running sectors. A trend needs a few more sessions before it means anything.',
    trace: 'SPEED TRACE',
    accuracy: 'ACCURACY',
    then: 'THEN',
    now: 'NOW',
    reflex: 'REFLEX MAP',
    reflexNote: 'Average delay before each key lands. Hesitation costs runs even when nothing is mistyped.',
    costly: 'COSTLIEST',
    steady: 'STEADIEST',
    noPatterns: 'Not enough keystrokes measured yet.',
    fastest: 'FASTEST',
    median: 'MEDIAN',
    slowest: 'SLOWEST',
    space: 'SPACE'
  },
  ru: {
    eyebrow: 'ТЕЛЕМЕТРИЯ ОПЕРАТОРА',
    faster: 'БЫСТРЕЕ, ЧЕМ В НАЧАЛЕ',
    slower: 'МЕДЛЕННЕЕ, ЧЕМ В НАЧАЛЕ',
    holding: 'ТЕМП ДЕРЖИТСЯ',
    sessions: 'сессий',
    across: 'за',
    days: 'дней',
    needMore: 'Проходи секторы дальше. Тренду нужно ещё несколько сессий, чтобы что-то значить.',
    trace: 'КРИВАЯ СКОРОСТИ',
    accuracy: 'ТОЧНОСТЬ',
    then: 'БЫЛО',
    now: 'СТАЛО',
    reflex: 'КАРТА РЕФЛЕКСОВ',
    reflexNote: 'Средняя задержка перед нажатием. Промедление стоит забегов, даже когда опечаток нет.',
    costly: 'ДОРОЖЕ ВСЕГО',
    steady: 'ТВЕРЖЕ ВСЕГО',
    noPatterns: 'Пока измерено слишком мало нажатий.',
    fastest: 'БЫСТРО',
    median: 'МЕДИАНА',
    slowest: 'МЕДЛЕННО',
    space: 'ПРОБЕЛ'
  }
};

const CHART_W = 640;
const CHART_H = 150;

/**
 * A stepped path rather than a smoothed curve. Each run is a discrete event and
 * the shape should say so; interpolation would invent sessions that never
 * happened.
 */
const steppedPath = (values: number[], min: number, max: number): string => {
  if (values.length < 2) return '';
  const span = Math.max(1, max - min);
  const stepX = CHART_W / (values.length - 1);
  return values.map((value, index) => {
    const x = index * stepX;
    const y = CHART_H - ((value - min) / span) * CHART_H;
    const prevY = index === 0 ? y : CHART_H - ((values[index - 1] - min) / span) * CHART_H;
    return index === 0 ? `M ${x} ${y}` : `L ${x} ${prevY} L ${x} ${y}`;
  }).join(' ');
};

const LatencyBar: React.FC<{ diagnostic: PatternDiagnostic; ceiling: number; spaceLabel: string }> = ({
  diagnostic,
  ceiling,
  spaceLabel
}) => {
  const segments = 14;
  const lit = Math.max(1, Math.round((Math.min(diagnostic.avgLatencyMs, ceiling) / ceiling) * segments));
  const hot = diagnostic.errorRate >= 12;
  return (
    <div className="telemetry-pattern">
      <span className="telemetry-pattern-token">
        {diagnostic.token === ' ' ? spaceLabel : diagnostic.token}
      </span>
      <div className="hud-gauge telemetry-pattern-bar">
        {Array.from({ length: segments }).map((_, index) => (
          <span
            key={index}
            className={`hud-gauge-notch ${index < lit ? 'is-lit' : ''}`}
            style={index < lit ? { backgroundColor: hot ? '#fb7185' : '#38bdf8' } : undefined}
          />
        ))}
      </div>
      <span className="telemetry-pattern-latency">{diagnostic.avgLatencyMs}<small>ms</small></span>
      <span className={`telemetry-pattern-errors ${hot ? 'is-hot' : ''}`}>
        {Math.round(diagnostic.errorRate)}<small>%</small>
      </span>
    </div>
  );
};

const OperatorTelemetry: React.FC<OperatorTelemetryProps> = ({ language, progress, training }) => {
  const ui = COPY[language];
  const headline = useMemo(() => getSkillHeadline(progress), [progress]);
  const series = useMemo(() => getSkillSeries(progress), [progress]);
  const costly = useMemo(() => getPatternDiagnostics(training, 6), [training]);
  const steady = useMemo(() => getSteadiestPatterns(training, 4), [training]);
  const spread = useMemo(() => getLatencySpread(training), [training]);

  const wpmValues = series.map((point) => point.wpm);
  const accuracyValues = series.map((point) => point.accuracy);
  const min = wpmValues.length ? Math.min(...wpmValues) : 0;
  const max = wpmValues.length ? Math.max(...wpmValues) : 1;

  const direction = headline.deltaWpm > 0 ? 'up' : headline.deltaWpm < 0 ? 'down' : 'flat';
  const verdict = direction === 'up' ? ui.faster : direction === 'down' ? ui.slower : ui.holding;
  const latencyCeiling = Math.max(240, spread?.slowestMs ?? 240);

  return (
    <section className={`telemetry telemetry--${direction}`} aria-labelledby="telemetry-title">
      <div className="telemetry-eyebrow">{ui.eyebrow}</div>

      <div className="telemetry-headline">
        <strong id="telemetry-title" className="telemetry-delta">
          {headline.deltaWpm > 0 ? '+' : ''}{headline.deltaWpm}
          <span className="telemetry-delta-unit">WPM</span>
        </strong>
        <div className="telemetry-verdict">
          <span>{verdict}</span>
          <small>
            {headline.sessions} {ui.sessions}
            {headline.spanDays > 0 ? ` · ${ui.across} ${headline.spanDays} ${ui.days}` : ''}
          </small>
        </div>
      </div>

      {!headline.hasEnoughHistory && <p className="telemetry-note">{ui.needMore}</p>}

      {series.length > 1 && (
        <div className="telemetry-chart">
          <div className="telemetry-chart-label">
            <span>{ui.trace}</span>
            <b>{headline.baselineWpm} → {headline.currentWpm}</b>
          </div>
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" role="img"
               aria-label={`${ui.trace}: ${headline.baselineWpm} → ${headline.currentWpm} WPM`}>
            {[0.25, 0.5, 0.75].map((fraction) => (
              <line key={fraction} className="telemetry-grid" x1="0" x2={CHART_W}
                    y1={CHART_H * fraction} y2={CHART_H * fraction} />
            ))}
            <path className="telemetry-accuracy" d={steppedPath(accuracyValues, 0, 100)} />
            <path className="telemetry-line" d={steppedPath(wpmValues, min, max)} />
          </svg>
          <div className="telemetry-chart-axis">
            <span>{ui.then}</span>
            <span className="telemetry-accuracy-key">
              {ui.accuracy} {headline.baselineAccuracy}% → {headline.currentAccuracy}%
            </span>
            <span>{ui.now}</span>
          </div>
        </div>
      )}

      <div className="telemetry-reflex">
        <div className="telemetry-chart-label">
          <span>{ui.reflex}</span>
          {spread && (
            <b>
              {ui.fastest} {spread.fastestMs}ms · {ui.median} {spread.medianMs}ms · {ui.slowest} {spread.slowestMs}ms
            </b>
          )}
        </div>
        <p className="telemetry-note">{ui.reflexNote}</p>
        {costly.length === 0 ? (
          <p className="telemetry-note">{ui.noPatterns}</p>
        ) : (
          <>
            <div className="telemetry-group-label">{ui.costly}</div>
            {costly.map((diagnostic) => (
              <LatencyBar key={`costly-${diagnostic.token}`} diagnostic={diagnostic}
                          ceiling={latencyCeiling} spaceLabel={ui.space} />
            ))}
            {steady.length > 0 && (
              <>
                <div className="telemetry-group-label">{ui.steady}</div>
                {steady.map((diagnostic) => (
                  <LatencyBar key={`steady-${diagnostic.token}`} diagnostic={diagnostic}
                              ceiling={latencyCeiling} spaceLabel={ui.space} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default OperatorTelemetry;
