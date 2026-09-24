import React from 'react';
import type { GameStats, Language, MissionState } from '../../types';
import type { UITranslations } from '../../services/i18n';
import type { GenrePack } from '../../services/genreConfig';
import type { ChallengeVerdict, TypomancerChallenge } from '../../services/challenge';
import { stripKeyHint } from '../../services/text';
import ChallengeVerdictCard from '../ChallengeVerdictCard';

interface GameOverScreenProps {
    ui: UITranslations;
    language: Language;
    stats: GameStats | null;
    coachText: string;
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
    onMenu: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({
    ui,
    language,
    stats,
    coachText,
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
    onMenu
}) => (
    <div className="screens-cut-panel screens-death-report bg-[#151418]/95 p-6 sm:p-8 border border-rose-500/40 backdrop-blur-xl max-w-3xl w-full shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_60px_rgba(244,63,94,0.12)] animate-fade-in-up">
        <div className="text-center">
            <div className="fs-micro font-bold uppercase tracking-[0.3em] text-rose-400/70">{ui.typing_debrief}</div>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl font-bold text-rose-500 tracking-tight">{ui.critical_failure}</h2>
            <p className="mt-3 fs-body text-slate-400">{genrePack.ui.connectionSevered[language]}</p>
        </div>

        <div className="screens-debrief-grid mt-6" aria-label={ui.typing_debrief}>
            <div className="screens-debrief-primary">
                <strong>{Math.round(stats?.wpm || 0)}</strong>
                <span>{ui.avg_speed} · {ui.wpm}</span>
                <small>{ui.peak_speed.replace('{value}', String(Math.round(stats?.bestWpm || 0)))}</small>
            </div>
            <div className="screens-debrief-metric">
                <strong>{Math.round(stats?.accuracy ?? 100)}%</strong>
                <span>{ui.accuracy}</span>
            </div>
            <div className="screens-debrief-metric">
                <strong>{stats?.mistakes || 0}</strong>
                <span>{ui.mistakes}</span>
            </div>
            <div className="screens-debrief-metric">
                <strong>{(stats?.segments || 0) > 1 ? `${Math.round(stats?.consistency ?? 100)}%` : '—'}</strong>
                <span>{ui.consistency}</span>
            </div>
        </div>

        <div className="screens-next-drill mt-4">
            <span>{ui.next_drill}</span>
            <p>{coachText}</p>
        </div>

        {challengeVerdict && challenge && (
            <ChallengeVerdictCard
                verdict={challengeVerdict}
                challenge={challenge}
                yourScore={yourScore}
                ui={ui}
                language={language}
                className="mt-4"
                yourScoreClassName="text-rose-200"
            />
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-y border-white/[0.06] py-3 fs-micro uppercase tracking-[0.16em] text-slate-500">
            <span>{ui.reached}: <b className="text-slate-200">{ui.level} {stats?.level || 1}</b></span>
            <span>{ui.score}: <b className="text-slate-200">{stats?.score || 0}</b></span>
            <span>{ui.characters_typed}: <b className="text-slate-200">{stats?.characters || 0}</b></span>
            <span>{ui.evidence}: <b className="text-emerald-300">{stats?.mission?.evidence ?? fallbackMission.evidence}</b></span>
            <span>{ui.heat}: <b className="text-amber-300">{stats?.mission?.heat ?? fallbackMission.heat}%</b></span>
        </div>
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
                className="btn-cyber btn-cyber-danger flex-1 py-3.5 font-display font-bold tracking-[0.06em] text-rose-200 hover:text-white transition-colors flex items-center justify-center gap-3"
            >
                <span className="keycap">SPACE</span>
                <span>{stripKeyHint(ui.main_menu)}</span>
            </button>
        </div>
    </div>
);

export default GameOverScreen;
