import React from 'react';
import type { Language } from '../types';
import { MAX_RUN_HISTORY, type PlayerProgress } from '../services/playerProgress';
import { getWeeklyProgress } from '../services/weeklyProgress';
import type { TypingTrainingProfile } from '../services/typingTraining';

export default function WeeklyProgress({ language, progress, training }: {
  language: Language; progress: PlayerProgress; training: TypingTrainingProfile;
}) {
  const ru = language === 'ru';
  const text = (en: string, russian: string) => ru ? russian : en;
  const days = getWeeklyProgress(progress.runs);
  const sessions = training.benchmarks.filter(item => item.kind !== 'run' && Number.isFinite(Date.parse(item.completedAt)))
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  const dateLabel = (date: string) => new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric' }).format(new Date(date));
  return <section className="operator-week" aria-labelledby="operator-week-title">
    <div className="operator-record-section-label"><h3 id="operator-week-title">{text('LAST 7 DAYS', 'ПОСЛЕДНИЕ 7 ДНЕЙ')}</h3>
      <span>{days.filter(day => day.count > 0).length}/7 {text('DAYS PLAYED', 'ДНЕЙ С ИГРОЙ')}</span></div>
    <p>{text(`Daily averages per completed operation, from the last ${MAX_RUN_HISTORY} saved operations. Busy weeks may be incomplete. Dashes mean no recorded operation, not zero speed.`,
      `Средние за день по последним ${MAX_RUN_HISTORY} сохранённым операциям. При частой игре неделя может быть неполной. Прочерк — нет записей, а не нулевая скорость.`)}</p>
    <table>
      <caption className="sr-only">{text('Daily typing speed and accuracy', 'Скорость и точность печати по дням')}</caption>
      <thead><tr><th scope="col">{text('Day', 'День')}</th><th scope="col">{text('Runs', 'Забеги')}</th><th scope="col">{text('WPM', 'СЛ/М')}</th><th scope="col">{text('Accuracy', 'Точность')}</th></tr></thead>
      <tbody>{days.map(day => <tr key={day.date} className={day.count ? 'has-signal' : ''}>
        <th scope="row"><time dateTime={day.date}>{dateLabel(`${day.date}T12:00:00`)}</time></th>
        <td>{day.count || '—'}</td><td>{day.wpm === null ? '—' : Math.round(day.wpm)}</td><td>{day.accuracy === null ? '—' : `${day.accuracy.toFixed(1)}%`}</td>
      </tr>)}</tbody>
    </table>
    <details className="operator-practice-history">
      <summary>{text('Recent drills & calibrations', 'Последние тренировки и калибровки')} · {sessions.length}</summary>
      <p>{text('From the latest 12 measured sessions. Drills and story runs use different texts: compare them separately.', 'Из последних 12 измеренных сессий. В тренировках и сюжетных забегах разные тексты — сравнивай их отдельно.')}</p>
      {sessions.length ? <ul>{sessions.map((session, index) => <li key={`${session.completedAt}-${index}`}>
        <time dateTime={session.completedAt}>{dateLabel(session.completedAt)}</time>
        <span>{session.kind === 'drill' ? text('Drill', 'Тренировка') : text('Calibration', 'Калибровка')}</span>
        <strong>{session.wpm} {text('WPM', 'СЛ/М')} · {session.accuracy.toFixed(1)}%</strong>
      </li>)}</ul> : <p>{text('Start a targeted drill below to record your first practice result.', 'Начни точечную тренировку ниже, чтобы записать первый результат.')}</p>}
    </details>
  </section>;
}
