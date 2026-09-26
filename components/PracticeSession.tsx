import { keepDialogFocus } from './dialogFocus';
import React, { useEffect, useRef, useState } from 'react';
import type { Language } from '../types';
import { TypingMeter, measuredAccuracy, measuredWpm, type TypingMeasurement } from '../services/typingMetrics';
import { EMPTY_TYPING_TRAINING, normalizeTrainingToken, recordTypingSession, type TypingObservation } from '../services/typingTraining';
import { PRACTICE_PHASE_MS, practicePrompt, selectPracticeFocus } from '../services/practiceSession';

export interface PracticeResult {
  focus: string[];
  before: TypingMeasurement;
  after: TypingMeasurement;
  observations: TypingObservation[];
  completedAt: string;
}

interface Props {
  language: Language;
  focus: string[];
  onComplete: (result: PracticeResult) => void;
  onExit: () => void;
  onPlay: () => void;
}

const PracticeSession: React.FC<Props> = ({ language, focus, onComplete, onExit, onPlay }) => {
  const ru = language === 'ru';
  const [phase, setPhase] = useState(0);
  const [exerciseStage, setExerciseStage] = useState(0);
  const [passage, setPassage] = useState(0);
  const [value, setValue] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [results, setResults] = useState<TypingMeasurement[]>([]);
  const [sessionFocus, setSessionFocus] = useState(focus);
  const meter = useRef(new TypingMeter());
  const observations = useRef<TypingObservation[]>([]);
  const characters = useRef(0);
  const currentLength = useRef(0);
  const lastKeyAt = useRef<number | null>(null);
  const finished = useRef(false);
  const pausedRef = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const prompt = practicePrompt(language, phase, passage, sessionFocus, exerciseStage);
  const complete = phase === 3;
  const labels = ru ? ['Замер', 'Отработка', 'Повторный замер'] : ['Check', 'Practice', 'Recheck'];

  const pause = () => {
    if (finished.current || pausedRef.current) return;
    pausedRef.current = true;
    meter.current.pause(Date.now());
    setPaused(true);
  };
  const resume = () => {
    meter.current.resume(Date.now());
    pausedRef.current = false;
    lastKeyAt.current = null;
    setPaused(false);
    requestAnimationFrame(() => input.current?.focus());
  };
  useEffect(() => {
    const hidden = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', hidden); };
  }, []);

  useEffect(() => {
    if (!ready || complete) return;
    input.current?.focus();
    const tick = window.setInterval(() => {
      if (pausedRef.current || finished.current) return;
      const sample = meter.current.read(characters.current + currentLength.current, Date.now());
      setElapsed(sample.durationMs);
      if (sample.durationMs < PRACTICE_PHASE_MS[phase]) return;
      finished.current = true;
      const final = { ...sample, durationMs: PRACTICE_PHASE_MS[phase] };
      const next = [...results, final];
      setResults(next);
      setReady(false);
      setPhase(phase + 1);
      if (phase === 0 && sessionFocus.length === 0) {
        setSessionFocus(selectPracticeFocus(language, recordTypingSession(EMPTY_TYPING_TRAINING, observations.current)));
      }
      if (phase === 2) onComplete({ focus: sessionFocus, before: next[0], after: final, observations: observations.current, completedAt: new Date().toISOString() });
    }, 100);
    return () => window.clearInterval(tick);
  }, [ready, phase]);

  const start = () => {
    meter.current = new TypingMeter();
    characters.current = 0;
    currentLength.current = 0;
    lastKeyAt.current = null;
    finished.current = false;
    pausedRef.current = false;
    setExerciseStage(0);
    setPaused(false); setValue(''); setPassage(0); setElapsed(0); setReady(true);
  };

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    if (!ready || pausedRef.current || finished.current || next.length > prompt.length) return;
    const now = Date.now();
    if (meter.current.read(0, now).durationMs >= PRACTICE_PHASE_MS[phase]) return;
    if (next.length > value.length) {
      if (next.length !== value.length + 1 || !next.startsWith(value)) return;
      const index = next.length - 1;
      const correct = normalizeTrainingToken(next[index]) === normalizeTrainingToken(prompt[index]);
      meter.current.key(correct, now);
      observations.current.push({ expected: prompt[index], previousExpected: index ? prompt[index - 1] : undefined,
        correct, latencyMs: lastKeyAt.current === null ? 0 : now - lastKeyAt.current });
      lastKeyAt.current = now;
    }
    currentLength.current = next.length;
    setValue(next);
    if (next.length === prompt.length) {
      characters.current += next.length;
      currentLength.current = 0;
      setExerciseStage(Math.min(2, Math.floor(meter.current.read(0, now).durationMs / 60000)));
      setPassage(p => p + 1); setValue('');
    }
    requestAnimationFrame(() => input.current?.setSelectionRange(prompt.length, prompt.length));
  };

  const sample = meter.current.read(characters.current + currentLength.current, Date.now());
  const accuracy = (item: TypingMeasurement) => measuredAccuracy(item.mistakes, item.attempts).toFixed(1);
  const speed = (item: TypingMeasurement) => Math.round(measuredWpm(item.characters, item.durationMs));
  const before = results[0];
  const after = results[2];
  const enough = !!after && before.attempts >= 30 && after.attempts >= 30;

  return <section className="practice-panel screens-cut-panel" aria-labelledby="practice-title">
    <header>
      <span className="practice-eyebrow">{ru ? '5 МИНУТ ДЛЯ ТВОИХ РУК' : '5 MINUTES FOR YOUR HANDS'}</span>
      <h1 id="practice-title">{complete ? (ru ? 'Тренировка завершена' : 'Practice complete') : (ru ? 'Точный сигнал' : 'A clearer signal')}</h1>
      <p>{complete ? (ru ? 'Результат сохранён. Сегодняшняя тренировка засчитана.' : 'Result saved. Today’s practice counts toward your streak.')
        : (ru ? '1 мин замер → 3 мин отработка → 1 мин повтор. Без погони и потери здоровья.' : '1 min check → 3 min practice → 1 min recheck. No chase or health loss.')}</p>
    </header>
    {complete ? <>
      <table className="practice-results"><thead><tr><th>{ru ? 'Показатель' : 'Measure'}</th><th>{labels[0]}</th><th>{labels[2]}</th></tr></thead>
        <tbody><tr><th>WPM</th><td>{speed(before)}</td><td>{speed(after)}</td></tr>
          <tr><th>{ru ? 'Точность' : 'Accuracy'}</th><td>{accuracy(before)}%</td><td>{accuracy(after)}%</td></tr>
          <tr><th>{ru ? 'Ошибки / нажатия' : 'Errors / keystrokes'}</th><td>{before.mistakes} / {before.attempts}</td><td>{after.mistakes} / {after.attempts}</td></tr></tbody></table>
      <p>{!enough ? (ru ? 'Пока мало нажатий для сравнения. Повтори замер в удобном темпе.' : 'Too few keystrokes to compare. Try another check at a comfortable pace.')
        : Number(accuracy(after)) < 96 ? (ru ? 'Следующая цель: сбавь темп и доведи точность до 96%.' : 'Next target: slow down and reach 96% accuracy.')
        : (ru ? 'Следующая цель: сохрани эту точность в сюжетном забеге.' : 'Next target: keep this accuracy in a story run.')}</p>
      {sessionFocus.length > 0 && <div className="practice-pattern-results"><h2>{ru ? 'Сочетания: реальные попытки' : 'Patterns: actual attempts'}</h2><ul>{sessionFocus.map(token => {
        const items = observations.current.filter(o => normalizeTrainingToken(token.length === 1 ? o.expected : `${o.previousExpected || ''}${o.expected}`) === token);
        const errors = items.filter(o => !o.correct).length;
        return <li key={token}><strong>{token}</strong> · {items.length} {ru ? 'попыток' : 'attempts'} · {errors} {ru ? 'ошибок' : 'errors'}{items.length < 8 ? (ru ? ' — мало данных' : ' — limited evidence') : ''}</li>;
      })}</ul><p>{ru ? 'Повтори в другой день. Для закрепления нужны минимум 8 попыток с точностью 98% в каждом из трёх разнесённых по времени повторений.' : 'Return on another day. Consolidation requires at least 8 attempts at 98% accuracy in each of three spaced reviews.'}</p></div>}
      <p className="practice-note">{ru ? 'Одинаковый текст и время. Разница показывает этот сеанс; устойчивый прогресс проверяй в следующие дни.' : 'Same text and duration. This compares today’s checks; repeat on later days to assess lasting progress.'}</p>
      <div className="practice-actions"><button className="btn-cyber btn-cyber-primary" onClick={onPlay}>{ru ? 'Применить в сюжете' : 'Use it in a story'}</button><button className="btn-cyber btn-cyber-ghost" onClick={onExit}>{ru ? 'В меню' : 'Back to menu'}</button></div>
    </> : <>
      <ol className="practice-steps">{labels.map((label, index) => <li key={label} aria-current={index === phase ? 'step' : undefined}>{index + 1}. {label}</li>)}</ol>
      <p className="practice-focus">{sessionFocus.length ? `${ru ? 'Фокус' : 'Focus'}: ${sessionFocus.join(' · ')}` : (ru ? 'Фокус: ровный ритм и точность. Сочетания появятся после первых замеров.' : 'Focus: rhythm and accuracy. Personal patterns appear after a few measurements.')}</p>
      {!ready ? <div className="practice-intro"><h2>{labels[phase]} · {PRACTICE_PHASE_MS[phase] / 60_000} {ru ? 'мин' : 'min'}</h2>
        <p>{ru ? 'Время начнётся с первой буквы. Ошибки учитываются, даже если исправить их Backspace. Можно поставить на паузу.' : 'The clock starts on your first letter. Errors count even after Backspace. You can pause any time.'}</p>
        <button className="btn-cyber btn-cyber-primary" onClick={start}>{ru ? 'Начать этап' : 'Start stage'}</button></div>
      : <>
        {phase === 1 && <p>{(ru ? ['Сочетания → слова → контекст: сочетания', 'Сочетания → слова → контекст: слова', 'Сочетания → слова → контекст: передача'] : ['Patterns → words → context: patterns', 'Patterns → words → context: words', 'Patterns → words → context: transmission'])[exerciseStage]}</p>}
        <div className="practice-readout" aria-live="off"><strong>{Math.ceil(Math.max(0, PRACTICE_PHASE_MS[phase] - elapsed) / 1000)}s</strong><span>{speed(sample)} WPM</span><span>{accuracy(sample)}%</span><button className="btn-cyber btn-cyber-ghost" onClick={pause}>{ru ? 'Пауза' : 'Pause'}</button></div>
        <div className="practice-transmission" onClick={() => input.current?.focus()} aria-hidden="true">{[...prompt].map((char, index) => <span key={`${passage}-${index}`} className={index === value.length ? 'practice-caret' : index < value.length ? normalizeTrainingToken(value[index]) === normalizeTrainingToken(char) ? 'practice-correct' : 'practice-wrong' : ''}>{char}</span>)}</div>
        <input ref={input} className="practice-input" value={value} onChange={handleInput} aria-label={ru ? 'Набери текст тренировки' : 'Type the practice passage'} disabled={paused}
          onPaste={e => e.preventDefault()} onDrop={e => e.preventDefault()} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} onKeyDown={e => { if (e.key === 'Escape') pause(); }} />
      </>}
      <button className="practice-exit" onClick={onExit}>{ru ? 'Завершить без результата' : 'Exit without a result'}</button>
    </>}
    {paused && !complete && <div onKeyDown={keepDialogFocus} className="practice-pause" role="dialog" aria-modal="true" aria-label={ru ? 'Пауза' : 'Paused'}><h2>{ru ? 'Время остановлено' : 'Clock paused'}</h2><button className="btn-cyber btn-cyber-primary" autoFocus onClick={resume}>{ru ? 'Продолжить' : 'Resume'}</button></div>}
  </section>;
};

export default PracticeSession;
