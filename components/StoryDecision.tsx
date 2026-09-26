import { keepDialogFocus } from './dialogFocus';
import React, { useEffect, useRef, useState } from 'react';
import type { DecisionPoint, DecisionImpact, Language } from '../types';

/** A story choice. With `remaining` it runs on a fuse: aggression heats up, the quiet option fades. */
export default function StoryDecision({ decision, language, onSelect, describe, chips, clock = null, windowMs = 1, onTimeout }: {
  decision: DecisionPoint; language: Language; onSelect: (index: number) => void;
  describe: (impact?: DecisionImpact) => string; chips: (impact?: DecisionImpact) => React.ReactNode;
  clock?: { left: number } | null; windowMs?: number; onTimeout?: () => void;
}) {
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!clock) return;
    const tick = window.setInterval(() => {
      clock.left = Math.max(0, clock.left - 100);
      redraw(n => n + 1);
      if (clock.left <= 0) { window.clearInterval(tick); onTimeout?.(); }
    }, 100);
    return () => window.clearInterval(tick);
  }, [clock]);
  const remaining = clock ? clock.left : null;
  const timed = remaining !== null;
  const drained = timed ? 1 - remaining / windowMs : 0;
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, [decision]);
  return <div role="dialog" aria-modal="true" aria-labelledby="story-choice-title" className="engine-decision-overlay absolute inset-0 z-[80] bg-[#0e0d10]/95 flex flex-col items-center justify-center p-5 md:p-8" onKeyDown={keepDialogFocus}>
    {timed && <div className="absolute top-0 inset-x-0 h-1 bg-white/[0.06]">
      <div className="engine-decision-fuse h-full transition-[width] duration-100 ease-linear" style={{ width: `${(remaining / windowMs) * 100}%` }} />
    </div>}
    <div className="w-full max-w-4xl"><div className="engine-decision-head">
      <div className="engine-decision-eyebrow">{timed
        ? (language === 'ru' ? 'Решай · 1 / 2, пока горит фитиль' : 'Decide · 1 / 2 before the fuse burns out')
        : (language === 'ru' ? 'Выбор без таймера · 1 / 2 или Tab + Enter' : 'Untimed choice · 1 / 2 or Tab + Enter')}</div>
      <h2 id="story-choice-title" className="engine-decision-question">{decision.introText}</h2>
    </div><div className="engine-decision-keys">
      {decision.options.map((option, index) => <button ref={index === 0 ? first : undefined} key={index} type="button" data-hotkey={String(index + 1)} className={`engine-decision-card engine-decision-card--${index === 0 ? 'aggressive' : 'stealth'}`}
        style={index === 0 ? { ['--decision-heat' as string]: drained.toFixed(3) } : { opacity: 1 - 0.55 * drained }} onClick={() => onSelect(index)}>
        <span className="engine-decision-card-top"><span className="engine-decision-cap" aria-hidden="true">{index + 1}</span><span className="engine-decision-stance">{index === 0 ? (language === 'ru' ? 'НАПОР' : 'AGGRESSIVE') : (language === 'ru' ? 'СКРЫТНОСТЬ' : 'STEALTH')}</span></span>
        <span className="engine-decision-option">{option.text}</span>
        <span className="engine-decision-preview">{option.preview || describe(option.impact)}</span>{chips(option.impact)}
      </button>)}
    </div></div>
  </div>;
}
