import React, { useState } from 'react';
import type { Language } from '../../types';
import type { UITranslations } from '../../services/i18n';
import type { DailyBrief, DailyState } from '../../services/dailyMode';
import { DAILY_MAX_ATTEMPTS } from '../../services/dailyMode';
import type { GenrePack } from '../../services/genreConfig';
import type { RunCheckpoint } from '../../services/runCheckpoint';
import type { TypomancerChallenge } from '../../services/challenge';
import type { SkillHeadline } from '../../services/progressAnalytics';
import type { ProgressSummary } from '../../services/playerProgress';
import { PACT_CLAUSES, isPactClauseActive, type PactClauseId } from '../../services/pact';
import { stripKeyHint } from '../../services/text';
import SystemBeacon from '../SystemBeacon';
import EmblemTile from '../EmblemTile';

interface MenuScreenProps {
    ui: UITranslations;
    language: Language;
    incomingChallenge: TypomancerChallenge | null;
    isCurrentChallenge: boolean;
    dailyBrief: DailyBrief;
    dailyGenrePack: GenrePack;
    dailyState: DailyState;
    dailyAttemptsLeft: number;
    dailyAttemptsExhausted: boolean;
    runCheckpoint: RunCheckpoint | null;
    skillHeadline: SkillHeadline;
    progressSummary: ProgressSummary;
    pactRewardMultiplier: number;
    activePact: PactClauseId[];
    onTogglePactClause: (id: PactClauseId) => void;
    onPactOpened?: () => void;
    onInitialize: () => void;
    onDaily: () => void;
    onResume: () => void;
    onBlackMarket: () => void;
    onOperatorRecord: () => void;
}

const MenuScreen: React.FC<MenuScreenProps> = ({
    ui,
    language,
    incomingChallenge,
    isCurrentChallenge,
    dailyBrief,
    dailyGenrePack,
    dailyState,
    dailyAttemptsLeft,
    dailyAttemptsExhausted,
    runCheckpoint,
    skillHeadline,
    progressSummary,
    pactRewardMultiplier,
    activePact,
    onTogglePactClause,
    onPactOpened,
    onInitialize,
    onDaily,
    onResume,
    onBlackMarket,
    onOperatorRecord
}) => {
    // Collapsed by default. Five clauses expanded is a wall of text on the first
    // screen a newcomer sees, and it pushed the menu past the fold on a laptop.
    // A returning player opens it deliberately.
    const [pactOpen, setPactOpen] = useState(false);
    // The on-screen keyboard fights the game's case sensitivity and speed. Say
    // so honestly on touch devices instead of letting the tracer teach it.
    const [isTouchDevice] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    );

    return (
        <div className="text-center space-y-7 max-w-md animate-fade-in-up">
            <div className="space-y-5">
                <SystemBeacon label={ui.system_online} />
                <h2 className="font-display text-5xl font-bold text-white tracking-tight leading-[1.05]">{ui.main_title}</h2>
                <p className="text-slate-400 text-base leading-relaxed">
                    {ui.intro_desc}<br/>
                    <span className="text-amber-400/90">{ui.mistakes_warn}</span>
                </p>
                {isTouchDevice && (
                    <p className="fs-micro uppercase tracking-[0.18em] text-slate-500">{ui.keyboard_notice}</p>
                )}
            </div>
            <div className="flex flex-col gap-3.5">
                {incomingChallenge && (
                    <div className={`screens-cut-card border p-4 text-left ${isCurrentChallenge ? 'border-amber-400/35 bg-amber-400/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
                        <div className="fs-micro font-bold uppercase tracking-[0.2em] text-amber-300">{ui.challenge_title}</div>
                        {isCurrentChallenge ? (
                            <div className="mt-2 flex items-center justify-between gap-4">
                                <div><span className="fs-micro text-slate-500">{ui.challenge_target}</span><strong className="block text-2xl text-white tabular-nums">{incomingChallenge.targetScore}</strong></div>
                                <button type="button" onClick={onDaily} disabled={dailyAttemptsExhausted} className="btn-cyber btn-cyber-primary px-4 py-2.5 fs-micro font-bold text-[#04120b]">{ui.challenge_accept}</button>
                            </div>
                        ) : <p className="mt-2 fs-label leading-relaxed text-slate-400">{ui.challenge_expired}</p>}
                    </div>
                )}
                {runCheckpoint && (
                    <button
                        onClick={onResume}
                        className="btn-cyber btn-cyber-primary px-8 py-4 font-display font-bold tracking-[0.06em] text-[#04120b] flex items-center justify-center gap-3"
                    >
                        <span className="keycap">R</span>
                        <span>{ui.resume_run} · {ui.resume_sector} {runCheckpoint.nextLevel}</span>
                    </button>
                )}
                <button
                    onClick={onInitialize}
                    className={`${runCheckpoint ? 'btn-cyber btn-cyber-ghost text-emerald-200' : 'btn-cyber btn-cyber-primary text-[#04120b]'} px-8 py-4 font-display font-bold tracking-[0.06em] flex items-center justify-center gap-3`}
                >
                    <span className="keycap">1</span>
                    <span>{stripKeyHint(ui.init_link)}</span>
                </button>
                <p className="px-3 fs-micro leading-relaxed text-slate-500">{ui.quick_session}</p>
                <button
                    onClick={onDaily}
                    disabled={dailyAttemptsExhausted}
                    className="screens-daily-button btn-cyber btn-cyber-ghost group px-8 py-3.5 font-display font-bold text-emerald-200 hover:text-white transition-colors flex items-center justify-center gap-3"
                >
                    <span className="keycap">3</span>
                    <EmblemTile
                        src={`/assets/worlds/${dailyBrief.genre}.png`}
                        size={28}
                        className="border bg-black/20"
                        style={{ borderColor: `${dailyGenrePack.accent}44` }}
                    />
                    <span className="flex min-w-0 flex-col items-start text-left">
                        <span className="tracking-[0.06em]">{ui.daily_sector}</span>
                        {dailyAttemptsExhausted ? (
                            <>
                                <span className="mt-1 max-w-full truncate font-mono fs-micro font-bold uppercase tracking-[0.12em] text-emerald-300/75 tabular-nums">
                                    {ui.daily_best}: {dailyState.bestScore} · {dailyState.bestEnding || ui.daily_severed}
                                </span>
                                <span className="mt-0.5 font-mono fs-micro font-bold uppercase tracking-[0.16em] text-slate-500">
                                    {ui.daily_tomorrow}
                                </span>
                            </>
                        ) : (
                            <span className="mt-1 max-w-full truncate font-mono fs-micro font-bold uppercase tracking-[0.12em] text-emerald-300/75 tabular-nums">
                                {dailyGenrePack.name[language]} · {dailyAttemptsLeft}/{DAILY_MAX_ATTEMPTS} {ui.daily_left}
                            </span>
                        )}
                    </span>
                </button>
                <button
                    onClick={onBlackMarket}
                    className="btn-cyber btn-cyber-ghost px-8 py-3.5 font-display font-bold tracking-[0.06em] text-emerald-200 hover:text-white transition-colors flex items-center justify-center gap-3"
                >
                    <span className="keycap">2</span>
                    <span>{stripKeyHint(ui.black_market)}</span>
                </button>
                <button
                    onClick={onOperatorRecord}
                    className="btn-cyber btn-cyber-ghost px-8 py-3.5 font-display font-bold tracking-[0.06em] text-sky-200 hover:text-white transition-colors flex items-center justify-center gap-3"
                >
                    <span className="keycap">4</span>
                    <span>{stripKeyHint(ui.operator_record)}</span>
                </button>
            </div>

            {/* What a returning player should be met by. The wallet is the
                game's internal currency; this is the only reward that
                leaves with them, and it used to be filed behind menu
                item four. */}
            {skillHeadline.sessions > 0 && (
                <div className={`screens-return screens-return--${skillHeadline.deltaWpm > 0 ? 'up' : skillHeadline.deltaWpm < 0 ? 'down' : 'flat'} mx-auto`}>
                    <div className="screens-return-figure">
                        <strong>{skillHeadline.deltaWpm > 0 ? '+' : ''}{skillHeadline.deltaWpm}</strong>
                        <span>{ui.wpm}</span>
                    </div>
                    <div className="screens-return-body">
                        <span>{skillHeadline.hasEnoughHistory
                            ? (skillHeadline.deltaWpm > 0 ? ui.return_faster : skillHeadline.deltaWpm < 0 ? ui.return_slower : ui.return_holding)
                            : ui.return_early}</span>
                        <small>
                            {skillHeadline.sessions} {ui.return_sessions}
                            {progressSummary.currentStreak > 1 ? ` · ${progressSummary.currentStreak} ${ui.return_streak}` : ''}
                        </small>
                    </div>
                </div>
            )}

            {/* THE PACT — the only progression that raises the bar instead of
                lowering it. Perfectionist used to sit here alone; it is now
                one clause among five. */}
            <div className="screens-pact mx-auto">
                <button
                    type="button"
                    onClick={() => {
                        if (!pactOpen) onPactOpened?.();
                        setPactOpen(!pactOpen);
                    }}
                    aria-expanded={pactOpen}
                    className="flex w-full items-baseline justify-between gap-3 text-left"
                >
                    <span className="screens-pact-title">
                        {ui.pact_title}
                        <span className="screens-pact-toggle">{pactOpen ? '−' : '+'}</span>
                    </span>
                    <span className={`screens-pact-reward ${pactRewardMultiplier > 1 ? 'is-active' : ''}`}>
                        x{pactRewardMultiplier.toFixed(2)} {ui.pact_reward}
                    </span>
                </button>
                {pactOpen && <p className="screens-pact-hint">{ui.pact_hint}</p>}
                {pactOpen && (
                <div className="screens-pact-clauses">
                    {PACT_CLAUSES.map((clause) => {
                        const active = isPactClauseActive(activePact, clause.id);
                        return (
                            <button
                                key={clause.id}
                                type="button"
                                onClick={() => onTogglePactClause(clause.id)}
                                aria-pressed={active}
                                className={`screens-pact-clause ${active ? 'is-active' : ''}`}
                            >
                                <span className="screens-pact-clause-name">
                                    {ui[`pact_${clause.id}` as keyof typeof ui]}
                                </span>
                                <span className="screens-pact-clause-desc">
                                    {ui[`pact_${clause.id}_desc` as keyof typeof ui]}
                                </span>
                                <span className="screens-pact-clause-reward">+{Math.round(clause.reward * 100)}%</span>
                            </button>
                        );
                    })}
                </div>
                )}
            </div>

            <p className="fs-label leading-relaxed text-slate-500 max-w-sm mx-auto">
                <span className="text-emerald-400/80">◆</span> {ui.accuracy_hook}
            </p>

            <div className="fs-label text-slate-600 pt-2">
                {ui.powered_by}
            </div>
            <div className="fs-micro leading-relaxed text-slate-700">
                {ui.privacy_note}
            </div>
        </div>
    );
};

export default MenuScreen;
