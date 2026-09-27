import SessionGoalLine from '../SessionGoalLine';
import type { SessionGoal } from '../../services/sessionPlan';
import type { SectorSummary } from '../../services/gameRules';
import React from 'react';
import type { Language, LevelReport, MissionState } from '../../types';
import type { UITranslations } from '../../services/i18n';
import type { GenrePack } from '../../services/genreConfig';
import type { ChallengeVerdict, TypomancerChallenge } from '../../services/challenge';
import { stripKeyHint } from '../../services/text';
import { isLastRelay } from '../../services/lastRelay';
import ChallengeVerdictCard from '../ChallengeVerdictCard';

interface VictoryScreenProps {
    sessionGoal?: SessionGoal | null;
    ui: UITranslations;
    language: Language;
    report: LevelReport;
    typingSummary: SectorSummary;
    fallbackMission: MissionState;
    genrePack: GenrePack;
    challengeVerdict: ChallengeVerdict | null;
    challenge: TypomancerChallenge | null;
    yourScore: number;
    canShareChallenge: boolean;
    challengeShared: boolean;
    hasComic: boolean;
    onShareChallenge: () => void;
    onShareScore: () => void;
    onShowComic: () => void;
    onPractice: () => void;
    onMenu: () => void;
}

const VictoryScreen: React.FC<VictoryScreenProps> = ({
    ui,
    language,
    report,
    typingSummary,
    fallbackMission,
    genrePack,
    challengeVerdict,
    challenge,
    yourScore,
    canShareChallenge,
    challengeShared,
    hasComic,
    onShareChallenge,
    onShareScore,
    onShowComic,
    onPractice,
    onMenu,
    sessionGoal = null
}) => (
    <div className="screens-cut-panel w-full max-w-3xl bg-[#151418]/95 p-10 screens-case-panel animate-fade-in-up max-h-[85dvh] overflow-y-auto">
        <div className="text-center border-b border-white/[0.07] pb-6 mb-6">
            <div className="screens-stamp mb-4">
                {isLastRelay(report.mission)
                    ? (language === 'ru' ? 'ОПЕРАЦИЯ ЗАВЕРШЕНА' : 'OPERATION COMPLETE')
                    : genrePack.ui.victoryTitle[language]}
            </div>
            <h2 className="font-display text-4xl font-bold text-white mb-3 tracking-tight">{report.endingTitle}</h2>
            <p className="text-slate-300 fs-lead italic">"{report.narrativeSummary}"</p>
            <p className="text-slate-500 fs-body mt-3">
                {isLastRelay(report.mission)
                    ? (language === 'ru'
                        ? 'Операция завершена. Судьба Миры и улик зависит от твоих действий.'
                        : 'Operation complete. Your actions decided what happened to Mira and the evidence.')
                    : ui.victory_subtitle}
            </p>
        </div>
        <SessionGoalLine goal={sessionGoal} ui={ui} stats={{ wpm: typingSummary.avgWpm, accuracy: typingSummary.accuracy, consistency: typingSummary.consistency }} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
            <div className="screens-stat-tile p-4 text-center border border-emerald-400/15 bg-emerald-400/[0.025]"><div className="font-display text-3xl font-bold text-emerald-300 tabular-nums leading-none">{report.mission?.evidence ?? fallbackMission.evidence}</div><div className="mt-2 fs-micro text-slate-500 uppercase tracking-[0.18em]">{ui.evidence}</div></div>
            <div className="screens-stat-tile p-4 text-center border border-amber-400/15 bg-amber-400/[0.025]"><div className="font-display text-3xl font-bold text-amber-300 tabular-nums leading-none">{report.mission?.heat ?? fallbackMission.heat}%</div><div className="mt-2 fs-micro text-slate-500 uppercase tracking-[0.18em]">{ui.heat}</div></div>
            <div className="screens-stat-tile p-4 text-center border border-sky-400/15 bg-sky-400/[0.025]"><div className="font-display text-3xl font-bold text-sky-300 tabular-nums leading-none">{report.mission?.trust ?? fallbackMission.trust}</div><div className="mt-2 fs-micro text-slate-500 uppercase tracking-[0.18em]">{ui.trust}</div></div>
            <div className="screens-stat-tile p-4 text-center border border-white/[0.07] bg-white/[0.02]"><div className="font-display text-xl font-bold text-white uppercase leading-tight">{report.route}</div><div className="mt-2 fs-micro text-slate-500 uppercase tracking-[0.18em]">{ui.route}</div></div>
        </div>
        <div className="screens-cut-card bg-black/20 border border-white/[0.07] p-4 mb-6">
            <div className="fs-micro text-slate-500 uppercase tracking-[0.2em] mb-3">{ui.operation_dossier}</div>
            <div className="space-y-1 fs-body text-slate-400">
                {(report.mission?.consequenceLog || fallbackMission.consequenceLog).slice(0, 4).map((line, index) => (
                    <div key={index} className="border-l border-white/10 pl-3">{line}</div>
                ))}
            </div>
        </div>
        {challengeVerdict && challenge && (
            <ChallengeVerdictCard
                verdict={challengeVerdict}
                challenge={challenge}
                yourScore={yourScore}
                ui={ui}
                language={language}
                className="mb-6"
            />
        )}
        <div className="practice-readout" aria-label={language === 'ru' ? 'Результат всего забега' : 'Whole run typing result'}>
            <span>{Math.round(typingSummary.avgWpm)} WPM</span>
            <span>{typingSummary.accuracy.toFixed(1)}% {language === 'ru' ? 'точность' : 'accuracy'}</span>
            <span>{typingSummary.totalMistakes} {language === 'ru' ? 'ошибок' : 'errors'}</span>
        </div>
        <button onClick={onPractice} className="btn-cyber btn-cyber-primary w-full mb-4 py-3">{language === 'ru' ? 'Отработать слабые места · 5 мин' : 'Train weak patterns · 5 min'}</button>
        <div className="flex flex-col sm:flex-row gap-3">
            {canShareChallenge && (
                <button
                    onClick={onShareChallenge}
                    className="btn-cyber btn-cyber-ghost flex-1 py-3.5 font-display font-bold tracking-[0.06em] text-amber-200 hover:text-white transition-colors"
                >
                    {challengeShared ? ui.challenge_copied : ui.challenge_share}
                </button>
            )}
            {hasComic && (
                <button
                    onClick={onShowComic}
                    className="btn-cyber btn-cyber-ghost flex-1 py-3.5 font-display font-bold tracking-[0.06em] text-emerald-200 hover:text-white transition-colors"
                >
                    {ui.share_comic}
                </button>
            )}
            <button
                onClick={onShareScore}
                className="btn-cyber btn-cyber-ghost flex-1 py-3.5 font-display font-bold tracking-[0.06em] text-emerald-200 hover:text-white transition-colors"
            >
                {ui.share_score}
            </button>
            <button
                onClick={onMenu}
                className="btn-cyber btn-cyber-primary flex-1 py-3.5 font-display font-bold tracking-[0.06em] text-[#1c0c04] flex items-center justify-center gap-3"
            >
                <span className="keycap">SPACE</span>
                <span>{stripKeyHint(ui.new_run)}</span>
            </button>
        </div>
    </div>
);

export default VictoryScreen;
