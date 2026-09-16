import React from 'react';
import type { Language } from '../types';
import type { ChallengeVerdict, TypomancerChallenge } from '../services/challenge';
import type { UITranslations } from '../services/i18n';

interface ChallengeVerdictCardProps {
    verdict: ChallengeVerdict;
    challenge: TypomancerChallenge;
    yourScore: number;
    ui: UITranslations;
    language: Language;
    className?: string;
    yourScoreClassName?: string;
}

const ChallengeVerdictCard: React.FC<ChallengeVerdictCardProps> = ({
    verdict,
    challenge,
    yourScore,
    ui,
    language,
    className = '',
    yourScoreClassName = 'text-emerald-300'
}) => {
    const verdictLabel = verdict.outcome === 'beaten'
        ? ui.challenge_beaten
        : verdict.outcome === 'missed'
            ? ui.challenge_missed
            : ui.challenge_tied;
    return (
        <div className={`screens-cut-card flex items-center justify-between gap-4 border p-4 ${verdict.outcome === 'beaten' ? 'border-emerald-400/35 bg-emerald-400/[0.06]' : 'border-amber-400/35 bg-amber-400/[0.06]'} ${className}`}>
            <div>
                <div className="fs-micro font-bold uppercase tracking-[0.2em] text-slate-400">{verdictLabel}</div>
                <div className="mt-1 fs-label text-slate-400">
                    {verdict.outcome === 'tied'
                        ? (language === 'ru' ? 'Точно в цель — попробуй ещё раз и выйди вперёд.' : 'Exactly on target — run it again to take the lead.')
                        : `${Math.abs(verdict.delta)} ${language === 'ru' ? (verdict.delta > 0 ? 'очков сверху' : 'очков не хватило') : (verdict.delta > 0 ? 'points ahead' : 'points short')}`}
                </div>
            </div>
            <div className="flex gap-5 text-right">
                <div><span className="block fs-micro uppercase tracking-[0.16em] text-slate-500">{ui.challenge_target}</span><strong className="text-xl text-white tabular-nums">{challenge.targetScore}</strong></div>
                <div><span className="block fs-micro uppercase tracking-[0.16em] text-slate-500">{ui.challenge_you}</span><strong className={`text-xl tabular-nums ${yourScoreClassName}`}>{yourScore}</strong></div>
            </div>
        </div>
    );
};

export default ChallengeVerdictCard;
