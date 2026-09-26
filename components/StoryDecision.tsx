import { keepDialogFocus } from './dialogFocus';
import React, { useEffect, useRef } from 'react';
import type { DecisionPoint, DecisionImpact, Language } from '../types';

/** Deliberate choice: the reading clock never chooses an outcome. */
export default function StoryDecision({ decision, language, onSelect, describe, chips }: {
  decision: DecisionPoint; language: Language; onSelect: (index: number) => void;
  describe: (impact?: DecisionImpact) => string; chips: (impact?: DecisionImpact) => React.ReactNode;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, [decision]);
  return <div role="dialog" aria-modal="true" aria-labelledby="story-choice-title" className="engine-decision-overlay absolute inset-0 z-[80] bg-[#0e0d10]/95 flex flex-col items-center justify-center p-5 md:p-8" onKeyDown={keepDialogFocus}>
    <div className="w-full max-w-4xl"><div className="engine-decision-head">
      <div className="engine-decision-eyebrow">{language === 'ru' ? 'Выбор без таймера · 1 / 2 или Tab + Enter' : 'Untimed choice · 1 / 2 or Tab + Enter'}</div>
      <h2 id="story-choice-title" className="engine-decision-question">{decision.introText}</h2>
    </div><div className="engine-decision-keys">
      {decision.options.map((option, index) => <button ref={index === 0 ? first : undefined} key={index} type="button" data-hotkey={String(index + 1)} className={`engine-decision-card engine-decision-card--${index === 0 ? 'aggressive' : 'stealth'}`} onClick={() => onSelect(index)}>
        <span className="engine-decision-card-top"><span className="engine-decision-cap" aria-hidden="true">{index + 1}</span><span className="engine-decision-stance">{index === 0 ? (language === 'ru' ? 'НАПОР' : 'AGGRESSIVE') : (language === 'ru' ? 'СКРЫТНОСТЬ' : 'STEALTH')}</span></span>
        <span className="engine-decision-option">{option.text}</span>
        <span className="engine-decision-preview">{option.preview || describe(option.impact)}</span>{chips(option.impact)}
      </button>)}
    </div></div>
  </div>;
}
