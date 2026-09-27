import React from 'react';
import type { Language } from '../types';
import { getDuePatterns, getDrillPatterns, type TypingTrainingProfile } from '../services/typingTraining';
export default function TrainingPlan({ training, language, onPractice }: { training: TypingTrainingProfile; language: Language; onPractice: () => void }) {
  if (!training.samples && !training.reviews?.length) return null;
  const ru = language === 'ru';
  const due = getDuePatterns(training, language);
  const weak = getDrillPatterns(language, training, 3);
  const upcoming = training.reviews?.filter(r => r.language === language).sort((a, b) => Date.parse(a.nextReviewAt) - Date.parse(b.nextReviewAt))[0];
  return <aside className="training-plan">
    <h3>{ru ? 'Следующая тренировка' : 'Your next practice'}</h3>
    <p>{due.length ? `${ru ? 'Пора повторить' : 'Ready to review'}: ${due.slice(0, 3).map(r => r.token).join(' · ')}`
      : upcoming ? `${ru ? 'Следующее повторение' : 'Next review'}: ${new Date(upcoming.nextReviewAt).toLocaleDateString(language)} · ${upcoming.token}`
      : weak.length ? `${ru ? 'Фокус по недавним попыткам' : 'Focus from recent attempts'}: ${weak.map(r => `${r.token} (${r.errors}/${r.attempts})`).join(' · ')}`
      : (ru ? 'Начни с пяти минут: замер, отработка и повторный замер.' : 'Start with five minutes: a check, practice and recheck.')}</p>
    {upcoming && <p>{upcoming.successfulDays}/3 {ru ? 'успешных повторений в разные дни. 8+ попыток, точность ≥98%.' : 'successful spaced reviews. 8+ attempts, ≥98% accuracy.'}</p>}
    <button type="button" className="btn-cyber btn-cyber-ghost" onClick={onPractice}>{ru ? 'Тренироваться · 5 мин' : 'Practice · 5 min'}</button>
  </aside>;
}

// One line for the menu's practice key: what is due for review, else the
// weakest recent patterns, else null (the key keeps its generic subtitle).
export function trainingHint(training: TypingTrainingProfile, language: Language): string | null {
  if (!training.samples && !training.reviews?.length) return null;
  const ru = language === 'ru';
  const due = getDuePatterns(training, language);
  if (due.length) return `${ru ? 'Пора повторить' : 'Ready to review'}: ${due.slice(0, 3).map(r => r.token).join(' · ')}`;
  const weak = getDrillPatterns(language, training, 3);
  if (weak.length) return `${ru ? 'Слабые места' : 'Weak spots'}: ${weak.map(r => r.token).join(' · ')}`;
  return null;
}
