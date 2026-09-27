import React, { useEffect, useMemo, useRef, useState } from 'react';

import { TypingMeter, measuredAccuracy } from '../services/typingMetrics';
import type { Language } from '../types';
import { audioEngine, type ComboTier } from '../services/audioEngine';
import { createCalibrationResult, type CalibrationResult } from '../services/playerProgress';
import type { TypingObservation } from '../services/typingTraining';

interface CalibrationPanelProps {
  language: Language;
  mode?: 'calibration' | 'drill';
  drillPrompt?: string;
  onComplete: (result: CalibrationResult, observations: TypingObservation[]) => void;
  onSkip: () => void;
}

const PROMPTS: Record<Language, string> = {
  en: 'Steady hands keep the signal clear while every precise keystroke moves the operation forward.',
  ru: 'Ровный ритм сохраняет сигнал, а каждое точное нажатие уверенно ведёт операцию вперёд.'
};

const COPY = {
  en: {
    eyebrow: 'KEYSTROKE SIGNATURE',
    title: 'Calibrate the link',
    description: 'Type one short transmission. Trace pressure will adapt to your natural pace.',
    start: 'START TYPING',
    speed: 'LIVE WPM',
    accuracy: 'ACCURACY',
    skip: 'SKIP · USE BALANCED',
    note: 'Saved with your progress. Recalibrate any time from Operator Record.',
    drillEyebrow: 'TARGETED DRILL',
    drillTitle: 'Train weak patterns',
    drillDescription: 'This transmission repeats the keys and pairs that cost you the most control.',
    cancel: 'CANCEL DRILL',
    drillNote: 'Timing, mistakes and your result are saved with your progress. The words you type are never stored.'
  },
  ru: {
    eyebrow: 'КЛАВИАТУРНАЯ СИГНАТУРА',
    title: 'Настройка канала',
    description: 'Набери одну короткую передачу. Давление следа подстроится под твой естественный темп.',
    start: 'НАЧИНАЙ ПЕЧАТАТЬ',
    speed: 'ТЕКУЩАЯ СКОРОСТЬ',
    accuracy: 'ТОЧНОСТЬ',
    skip: 'ПРОПУСТИТЬ · СРЕДНИЙ РЕЖИМ',
    note: 'Сохраняется вместе с прогрессом. Повторить настройку можно в Досье оператора.',
    drillEyebrow: 'ТОЧЕЧНАЯ ТРЕНИРОВКА',
    drillTitle: 'Отработай слабые сочетания',
    drillDescription: 'Эта передача повторяет клавиши и пары, на которых ты чаще теряешь контроль.',
    cancel: 'ОТМЕНИТЬ ТРЕНИРОВКУ',
    drillNote: 'Время нажатий, ошибки и результат сохраняются с прогрессом. Набранные слова не сохраняются.'
  }
};

const normalizeChar = (character: string): string => {
  if ('—–−'.includes(character)) return '-';
  if (character === 'ё') return 'е';
  if (character === 'Ё') return 'Е';
  if (character === ' ') return ' ';
  return character.toLowerCase();
};

const CalibrationPanel: React.FC<CalibrationPanelProps> = ({ language, mode = 'calibration', drillPrompt, onComplete, onSkip }) => {
  const prompt = mode === 'drill' && drillPrompt ? drillPrompt : PROMPTS[language];
  const ui = COPY[language];
  const [value, setValue] = useState('');
  const meterRef = useRef(new TypingMeter());
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [mistakes, setMistakes] = useState(0);
  const [now, setNow] = useState(Date.now());
  const startedAtRef = useRef<number | null>(null);
  const lastKeystrokeAtRef = useRef<number | null>(null);
  const observationsRef = useRef<TypingObservation[]>([]);
  const completedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Calibration is the first typing a new player does, so it gets the same
  // keystroke voice as the campaign rather than being silent.
  const streakRef = useRef(0);
  const comboTier = (value: number): ComboTier => (
    value >= 50 ? 3 : value >= 25 ? 2 : value >= 10 ? 1 : 0
  );

  const pause = () => { meterRef.current.pause(Date.now()); pausedRef.current = true; setPaused(true); };
  const resume = () => { meterRef.current.resume(Date.now()); pausedRef.current = false; lastKeystrokeAtRef.current = null; setPaused(false); requestAnimationFrame(() => inputRef.current?.focus()); };
  useEffect(() => {
    inputRef.current?.focus();
    const hidden = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', hidden); };
  }, []);

  useEffect(() => {
    if (startedAtRef.current === null || completedRef.current) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [value.length]);

  const durationMs = meterRef.current.read(value.length, now).durationMs;
  const liveWpm = durationMs > 0 ? Math.round(((value.length / 5) / (durationMs / 60_000))) : 0;
  const accuracy = measuredAccuracy(mistakes, observationsRef.current.length);
  const progress = (value.length / prompt.length) * 100;

  const renderedCharacters = useMemo(() => prompt.split('').map((character, index) => {
    const typed = value[index];
    const state = typed === undefined
      ? index === value.length ? 'current' : 'pending'
      : normalizeChar(typed) === normalizeChar(character) ? 'correct' : 'wrong';
    return <span key={`${character}-${index}`} className={`calibration-character calibration-character-${state}`}>{character}</span>;
  }), [prompt, value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (pausedRef.current || completedRef.current) return;
    const next = event.target.value.slice(0, prompt.length);
    const keyTime = Date.now();
    if (startedAtRef.current === null && next.length > 0) startedAtRef.current = keyTime;
    if (next.length > value.length + 1 || (next.length > value.length && !next.startsWith(value))) return;
    if (next.length > value.length) {
      let newMistakes = 0;
      for (let index = value.length; index < next.length; index += 1) {
        const correct = normalizeChar(next[index]) === normalizeChar(prompt[index]);
        meterRef.current.key(correct, keyTime);
        if (correct) {
          audioEngine.keyHit(comboTier(streakRef.current));
          streakRef.current += 1;
        } else {
          audioEngine.keyError();
          streakRef.current = 0;
          newMistakes += 1;
        }
        observationsRef.current.push({
          expected: prompt[index],
          previousExpected: index > 0 ? prompt[index - 1] : undefined,
          correct,
          latencyMs: lastKeystrokeAtRef.current === null ? 0 : keyTime - lastKeystrokeAtRef.current
        });
        lastKeystrokeAtRef.current = keyTime;
      }
      if (newMistakes > 0) setMistakes((current) => current + newMistakes);
    }
    setValue(next);
    setNow(Date.now());
    window.requestAnimationFrame(() => inputRef.current?.setSelectionRange(next.length, next.length));

    if (next.length === prompt.length && !completedRef.current) {
      completedRef.current = true;
      const finishedAt = Date.now();
      const elapsed = meterRef.current.read(next.length, finishedAt).durationMs;
      const finalAccuracy = measuredAccuracy(observationsRef.current.filter(item => !item.correct).length, observationsRef.current.length);
      const finalWpm = Math.round(((prompt.length / 5) / (elapsed / 60_000)));
      onComplete({ ...createCalibrationResult(finalWpm, finalAccuracy, elapsed), language, measurementVersion: 2 }, observationsRef.current);
    }
  };

  return (
    <section className="calibration-panel screens-cut-panel" aria-labelledby="calibration-title" onClick={() => inputRef.current?.focus()}>
      {paused && <div className="practice-pause" role="dialog" aria-modal="true" aria-label={language === 'ru' ? 'Пауза' : 'Paused'}><h2>{language === 'ru' ? 'Время остановлено' : 'Clock paused'}</h2><button type="button" className="btn-cyber" onClick={resume}>{language === 'ru' ? 'Продолжить' : 'Resume'}</button></div>}
      <div className="calibration-scanline" aria-hidden="true" />
      <header className="calibration-header">
        <span>{mode === 'drill' ? ui.drillEyebrow : ui.eyebrow}</span>
        <h2 id="calibration-title">{mode === 'drill' ? ui.drillTitle : ui.title}</h2>
        <p>{mode === 'drill' ? ui.drillDescription : ui.description}</p>
      </header>

      <div className="calibration-readout" aria-live="polite">
        <div><strong>{liveWpm}</strong><span>{ui.speed}</span></div>
        <div><strong>{Math.round(accuracy)}%</strong><span>{ui.accuracy}</span></div>
      </div>

      <div className="calibration-transmission" aria-hidden="true">
        {renderedCharacters}
        {value.length === 0 && <span className="calibration-start-cue">{ui.start}</span>}
      </div>

      <div className="calibration-progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <input
        ref={inputRef}
        className="fixed left-0 top-0 -z-10 h-px w-px opacity-0"
        value={value}
        disabled={paused}
        onChange={handleChange}
        onPaste={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onSkip();
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label={mode === 'drill' ? ui.drillDescription : ui.description}
      />

      <footer className="calibration-footer">
        <p>{mode === 'drill' ? ui.drillNote : ui.note}</p>
        <button type="button" className="btn-cyber btn-cyber-ghost" onClick={pause}>{language === 'ru' ? 'Пауза' : 'Pause'}</button>
        <button type="button" onClick={(event) => { event.stopPropagation(); onSkip(); }} className="btn-cyber btn-cyber-ghost">
          {mode === 'drill' ? ui.cancel : ui.skip}
        </button>
      </footer>
    </section>
  );
};

export default CalibrationPanel;
