import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { Language } from '../types';
import { createCalibrationResult, type CalibrationResult } from '../services/playerProgress';

interface CalibrationPanelProps {
  language: Language;
  onComplete: (result: CalibrationResult) => void;
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
    note: 'This stays on this device. Recalibrate any time from Operator Record.'
  },
  ru: {
    eyebrow: 'КЛАВИАТУРНАЯ СИГНАТУРА',
    title: 'Настройка канала',
    description: 'Набери одну короткую передачу. Давление следа подстроится под твой естественный темп.',
    start: 'НАЧИНАЙ ПЕЧАТАТЬ',
    speed: 'ТЕКУЩАЯ СКОРОСТЬ',
    accuracy: 'ТОЧНОСТЬ',
    skip: 'ПРОПУСТИТЬ · СРЕДНИЙ РЕЖИМ',
    note: 'Данные остаются на этом устройстве. Повторить настройку можно в Досье оператора.'
  }
};

const normalizeChar = (character: string): string => {
  if ('—–−'.includes(character)) return '-';
  if (character === 'ё') return 'е';
  if (character === 'Ё') return 'Е';
  if (character === ' ') return ' ';
  return character.toLowerCase();
};

const CalibrationPanel: React.FC<CalibrationPanelProps> = ({ language, onComplete, onSkip }) => {
  const prompt = PROMPTS[language];
  const ui = COPY[language];
  const [value, setValue] = useState('');
  const [mistakes, setMistakes] = useState(0);
  const [now, setNow] = useState(Date.now());
  const startedAtRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (startedAtRef.current === null || completedRef.current) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [value.length]);

  const durationMs = startedAtRef.current ? Math.max(1_000, now - startedAtRef.current) : 0;
  const liveWpm = durationMs > 0 ? Math.round(((value.length / 5) / (durationMs / 60_000))) : 0;
  const accuracy = value.length > 0 ? Math.max(0, 100 - ((mistakes / value.length) * 100)) : 100;
  const progress = (value.length / prompt.length) * 100;

  const renderedCharacters = useMemo(() => prompt.split('').map((character, index) => {
    const typed = value[index];
    const state = typed === undefined
      ? index === value.length ? 'current' : 'pending'
      : normalizeChar(typed) === normalizeChar(character) ? 'correct' : 'wrong';
    return <span key={`${character}-${index}`} className={`calibration-character calibration-character-${state}`}>{character}</span>;
  }), [prompt, value]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value.slice(0, prompt.length);
    if (startedAtRef.current === null && next.length > 0) startedAtRef.current = Date.now();
    if (next.length > value.length) {
      let newMistakes = 0;
      for (let index = value.length; index < next.length; index += 1) {
        if (normalizeChar(next[index]) !== normalizeChar(prompt[index])) newMistakes += 1;
      }
      if (newMistakes > 0) setMistakes((current) => current + newMistakes);
    }
    setValue(next);
    setNow(Date.now());
    window.requestAnimationFrame(() => inputRef.current?.setSelectionRange(next.length, next.length));

    if (next.length === prompt.length && !completedRef.current) {
      completedRef.current = true;
      const finishedAt = Date.now();
      const elapsed = Math.max(1_000, finishedAt - (startedAtRef.current || finishedAt));
      const finalAccuracy = Math.max(0, 100 - (((mistakes + (next.length > value.length
        ? Array.from({ length: next.length - value.length }, (_, offset) => value.length + offset)
            .filter((index) => normalizeChar(next[index]) !== normalizeChar(prompt[index])).length
        : 0)) / prompt.length) * 100));
      const finalWpm = Math.round(((prompt.length / 5) / (elapsed / 60_000)));
      onComplete(createCalibrationResult(finalWpm, finalAccuracy, elapsed));
    }
  };

  return (
    <section className="calibration-panel screens-cut-panel" aria-labelledby="calibration-title" onClick={() => inputRef.current?.focus()}>
      <div className="calibration-scanline" aria-hidden="true" />
      <header className="calibration-header">
        <span>{ui.eyebrow}</span>
        <h2 id="calibration-title">{ui.title}</h2>
        <p>{ui.description}</p>
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
        onChange={handleChange}
        onPaste={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onSkip();
        }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label={ui.description}
      />

      <footer className="calibration-footer">
        <p>{ui.note}</p>
        <button type="button" onClick={(event) => { event.stopPropagation(); onSkip(); }} className="btn-cyber btn-cyber-ghost">
          {ui.skip}
        </button>
      </footer>
    </section>
  );
};

export default CalibrationPanel;
