import { trainingHint } from '../TrainingPlan';
import type { TypingTrainingProfile } from '../../services/typingTraining';
import React, { useState } from 'react';
import type { Language } from '../../types';
import { PACT_CLAUSE_TEXT_KEYS, type UITranslations } from '../../services/i18n';
import type { DailyBrief, DailyState } from '../../services/dailyMode';
import { DAILY_MAX_ATTEMPTS } from '../../services/dailyMode';
import { getGenrePack, type GenrePack } from '../../services/genreConfig';
import type { RunCheckpoint } from '../../services/runCheckpoint';
import type { TypomancerChallenge } from '../../services/challenge';
import type { SkillHeadline } from '../../services/progressAnalytics';
import { PACT_CLAUSES, isPactClauseActive, type PactClauseId } from '../../services/pact';
import type { SessionPlan } from '../../services/sessionPlan';
import KeycapWordmark from '../KeycapWordmark';
import EmblemTile from '../EmblemTile';
import { AccountDeletedNotice } from '../CloudProgress';

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
    training: TypingTrainingProfile;
    pactRewardMultiplier: number;
    activePact: PactClauseId[];
    relaxed: boolean;
    sessionPlan: SessionPlan;
    onToggleRelaxed: () => void;
    onTogglePactClause: (id: PactClauseId) => void;
    onPactOpened?: () => void;
    canInstall?: boolean;
    onInstall?: () => void;
    onPlay: () => void;
    onRelay: () => void;
    onInitialize: () => void;
    onDaily: () => void;
    onResume: () => void;
    onBlackMarket: () => void;
    onPractice: () => void;
    onOperatorRecord: () => void;
}

// Menu labels carry a legacy "[4] " key hint; the keycap shows it now.
const stripHint = (label: string) => label.replace(/^\[\d\]\s*/, '');

const MenuScreen: React.FC<MenuScreenProps> = ({
    ui, language, incomingChallenge, isCurrentChallenge, dailyBrief, dailyGenrePack, dailyState,
    dailyAttemptsLeft, dailyAttemptsExhausted, runCheckpoint, skillHeadline, training,
    pactRewardMultiplier, activePact, relaxed, sessionPlan, onToggleRelaxed, onTogglePactClause,
    onPactOpened, canInstall, onInstall, onPlay, onRelay, onInitialize, onDaily, onResume,
    onBlackMarket, onPractice, onOperatorRecord
}) => {
    // Both panels start collapsed: the first screen is the session, not its options.
    const [pactOpen, setPactOpen] = useState(false);
    const [difficultyOpen, setDifficultyOpen] = useState(false);
    // The on-screen keyboard fights the game's case sensitivity and speed. Say
    // so honestly on touch devices instead of letting the tracer teach it.
    const [isTouchDevice] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
    );
    const newcomer = sessionPlan.kind === 'prologue';

    // What "Play" will do, in one line: the prologue, or the session's world,
    // focus, weak pairs and pace.
    const sessionLine = sessionPlan.kind === 'prologue'
        ? ui.play_prologue
        : [
            getGenrePack(sessionPlan.genre).name[language],
            `${ui.play_session_focus}: ${ui[`focus_name_${sessionPlan.goal.focus}` as const]}`,
            sessionPlan.weakPairs.length ? `${ui.play_session_pairs} ${sessionPlan.weakPairs.join(', ')}` : '',
            sessionPlan.paceWpm ? `${ui.play_session_pace} ${sessionPlan.paceWpm} ${ui.wpm}` : ''
        ].filter(Boolean).join(' · ');

    // A returning player sees progress where a newcomer sees the pitch.
    const progressLine = !newcomer && skillHeadline.sessions >= 2 && skillHeadline.deltaWpm !== 0
        ? `${skillHeadline.deltaWpm > 0 ? '+' : ''}${skillHeadline.deltaWpm} ${ui.wpm} ${ui.since_start} · ${skillHeadline.sessions} ${ui.return_sessions}`
        : null;

    const difficultySummary = [
        relaxed ? ui.relaxed_toggle.toLowerCase() : '',
        pactRewardMultiplier > 1 ? `${ui.pact_title.toLowerCase()} ×${pactRewardMultiplier.toFixed(2)}` : ''
    ].filter(Boolean).join(' · ') || ui.run_difficulty_standard;

    return (
        <div className="menu-screen animate-fade-in-up">
            <header className="menu-title">
                <KeycapWordmark />
                <div className="menu-dossier">
                    <span className="menu-dossier-rule" aria-hidden="true" />
                    <h2 className="menu-dossier-title">{ui.main_title}</h2>
                    <span className="menu-dossier-rule" aria-hidden="true" />
                </div>
                {progressLine && <p className="menu-pitch menu-progress">{progressLine}</p>}
                {newcomer && <p className="menu-pitch">{ui.intro_desc}{' '}<em>{ui.mistakes_warn}</em></p>}
                {isTouchDevice && (
                    <p className="fs-micro uppercase tracking-[0.18em] text-slate-500">{ui.keyboard_notice}</p>
                )}
            </header>

            <div className="mt-5">
                <AccountDeletedNotice language={language} />
            </div>

            {/* TIER 1 — one key that plays the session built for this player.
                An in-flight checkpoint sits above it and takes the orange. */}
            <div className="menu-keys mt-7">
                {runCheckpoint && (
                    <button onClick={onResume} data-hotkey="r" className="menu-key menu-key--wide btn-cyber btn-cyber-primary">
                        <span className="keycap">R</span>
                        <span className="menu-key-text">
                            <span className="menu-key-title">{ui.resume_run} · {ui.resume_sector} {runCheckpoint.nextLevel}</span>
                            <span className="screens-btn-sub">{language === 'ru' ? 'Продолжить с сохранённой строки' : 'Continue from the saved line'}</span>
                        </span>
                    </button>
                )}
                <button onClick={onPlay} data-hotkey="1" className={`menu-key menu-key--wide btn-cyber ${runCheckpoint ? 'btn-cyber-ghost' : 'btn-cyber-primary'}`}>
                    <span className="keycap">1</span>
                    <span className="menu-key-text">
                        <span className="menu-key-title">{ui.play}</span>
                        <span className="screens-btn-sub">{sessionLine}</span>
                    </span>
                    {!runCheckpoint && <span className="menu-key-enter" aria-hidden="true">↵</span>}
                </button>
                {incomingChallenge && (
                    <div className={`menu-key--wide screens-cut-card border p-4 text-left ${isCurrentChallenge ? 'border-amber-400/35 bg-amber-400/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}>
                        <div className="fs-micro font-bold uppercase tracking-[0.2em] text-amber-300">{ui.challenge_title}</div>
                        {isCurrentChallenge ? (
                            <div className="mt-2 flex items-center justify-between gap-4">
                                <div><span className="fs-micro text-slate-500">{ui.challenge_target}</span>{(!incomingChallenge.ruleset || incomingChallenge.language !== language) && <p>{language === 'ru' ? 'Неформальный вызов: язык или правила отличаются.' : 'Informal challenge: language or rules differ.'}</p>}<strong className="block text-2xl text-white tabular-nums">{incomingChallenge.targetScore}</strong></div>
                                <button type="button" onClick={onDaily} disabled={dailyAttemptsExhausted} className="btn-cyber btn-cyber-primary px-4 py-2.5 fs-micro font-bold">{ui.challenge_accept}</button>
                            </div>
                        ) : <p className="mt-2 fs-label leading-relaxed text-slate-400">{ui.challenge_expired}</p>}
                    </div>
                )}

                {/* TIER 2 — the other two reasons to come back: hands-only practice
                    and today's shared sector. */}
                <button type="button" onClick={onPractice} data-hotkey="6" className="menu-key btn-cyber btn-cyber-ghost">
                    <span className="keycap">6</span>
                    <span className="menu-key-text">
                        <span className="menu-key-title">{ui.practice_title}</span>
                        <span className="screens-btn-sub">{trainingHint(training, language) ?? ui.practice_hint}</span>
                    </span>
                </button>
                <button onClick={onDaily} data-hotkey="3" disabled={dailyAttemptsExhausted} className="menu-key screens-daily-button btn-cyber btn-cyber-ghost group">
                    <span className="keycap">3</span>
                    <span className="menu-key-text">
                        <span className="menu-key-title flex items-center gap-2">
                            <EmblemTile
                                src={`/assets/worlds/${dailyBrief.genre}.png`}
                                size={18}
                                className="border bg-black/20 shrink-0"
                                style={{ borderColor: `${dailyGenrePack.accent}44` }}
                            />
                            {ui.daily_sector}
                        </span>
                        {dailyAttemptsExhausted ? (
                            <span className="screens-btn-sub tabular-nums">
                                {ui.daily_best}: {dailyState.bestScore} · {dailyState.bestEnding || ui.daily_severed} · {ui.daily_tomorrow}
                            </span>
                        ) : (
                            <span className="screens-btn-sub tabular-nums">
                                {dailyGenrePack.name[language]} · {dailyAttemptsLeft}/{DAILY_MAX_ATTEMPTS} {ui.daily_left}
                            </span>
                        )}
                    </span>
                </button>
            </div>

            {/* TIER 3 — everything else, as one quiet row of links. */}
            <nav className="menu-links" aria-label={language === 'ru' ? 'Ещё' : 'More'}>
                <button type="button" onClick={onInitialize} data-hotkey="2" className="menu-link"><span className="keycap">2</span>{ui.other_world}</button>
                <button type="button" onClick={onBlackMarket} data-hotkey="4" className="menu-link"><span className="keycap">4</span>{stripHint(ui.black_market)}</button>
                <button type="button" onClick={onOperatorRecord} data-hotkey="5" className="menu-link"><span className="keycap">5</span>{stripHint(ui.operator_record)}</button>
                {!newcomer && <button type="button" onClick={onRelay} className="menu-link">{ui.prologue_again}</button>}
            </nav>

            {/* TIER 4 — run difficulty, folded: story pace and the Pact. */}
            <div className="menu-difficulty">
                <button type="button" className="menu-difficulty-toggle" aria-expanded={difficultyOpen} onClick={() => setDifficultyOpen(!difficultyOpen)}>
                    <span>{ui.run_difficulty}</span>
                    <span className="menu-difficulty-summary">{difficultySummary} {difficultyOpen ? '−' : '+'}</span>
                </button>
                {difficultyOpen && (
                <div className="mt-3 flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={onToggleRelaxed}
                        aria-pressed={relaxed}
                        className={`menu-switch ${relaxed ? 'is-on' : ''}`}
                    >
                        <span className="flex min-w-0 flex-col items-start text-left">
                            <span className="menu-switch-title">{ui.relaxed_toggle}</span>
                            <span className="screens-btn-sub">{ui.relaxed_hint}</span>
                        </span>
                        <span className="menu-switch-track" aria-hidden="true">
                            <span className="menu-switch-thumb" />
                        </span>
                        <span className="sr-only">{relaxed ? ui.relaxed_on : ui.relaxed_off}</span>
                    </button>

                    {/* THE PACT — the only progression that raises the bar instead
                        of lowering it. Perfectionist used to sit here alone; it
                        is now one clause among five. */}
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
                                            {ui[PACT_CLAUSE_TEXT_KEYS[clause.id].name]}
                                        </span>
                                        <span className="screens-pact-clause-desc">
                                            {ui[PACT_CLAUSE_TEXT_KEYS[clause.id].desc]}
                                        </span>
                                        <span className="screens-pact-clause-reward">+{Math.round(clause.reward * 100)}%</span>
                                    </button>
                                );
                            })}
                        </div>
                        )}
                    </div>
                </div>
                )}
            </div>

            {/* Footer — system chrome, demoted to micro-copy. Account lives in
                the status strip and on its own screen. */}
            <div className="mt-8 space-y-1.5">
                {canInstall && (
                    <button
                        type="button"
                        onClick={onInstall}
                        className="fs-label text-slate-500 hover:text-emerald-300 transition-colors underline underline-offset-4 decoration-slate-700 mx-auto block"
                    >
                        {ui.install_app}
                    </button>
                )}
                <div className="fs-label text-slate-600">
                    {ui.powered_by}
                </div>
                <div className="fs-micro leading-relaxed text-slate-700">
                    {ui.privacy_note}
                </div>
            </div>
        </div>
    );
};

export default MenuScreen;
