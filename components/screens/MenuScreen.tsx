import { trainingHint } from '../TrainingPlan';
import type { TypingTrainingProfile } from '../../services/typingTraining';
import React, { useState } from 'react';
import type { Language } from '../../types';
import { PACT_CLAUSE_TEXT_KEYS, type UITranslations } from '../../services/i18n';
import type { DailyBrief, DailyState } from '../../services/dailyMode';
import { DAILY_MAX_ATTEMPTS } from '../../services/dailyMode';
import type { GenrePack } from '../../services/genreConfig';
import type { RunCheckpoint } from '../../services/runCheckpoint';
import type { TypomancerChallenge } from '../../services/challenge';
import type { SkillHeadline } from '../../services/progressAnalytics';
import { PACT_CLAUSES, isPactClauseActive, type PactClauseId } from '../../services/pact';
import { stripKeyHint } from '../../services/text';
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
    leadWithPrologue: boolean;
    onToggleRelaxed: () => void;
    onTogglePactClause: (id: PactClauseId) => void;
    onPactOpened?: () => void;
    canInstall?: boolean;
    onInstall?: () => void;
    onRelay: () => void;
    onInitialize: () => void;
    onDaily: () => void;
    onResume: () => void;
    onBlackMarket: () => void;
    onPractice: () => void;
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
    skillHeadline, training,
    pactRewardMultiplier,
    activePact,
    relaxed,
    leadWithPrologue,
    onToggleRelaxed,
    onTogglePactClause,

    onPactOpened,
    canInstall,
    onInstall,
    onRelay,
    onInitialize,
    onDaily,
    onResume,
    onBlackMarket,
    onPractice,
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

    // The record button carries the returning-player signal that used to be a
    // standalone card — one glance of pace delta, details live on the record.
    const recordHint = skillHeadline.sessions > 0
        ? `${skillHeadline.deltaWpm > 0 ? '+' : ''}${skillHeadline.deltaWpm} ${ui.wpm} · ${skillHeadline.sessions} ${ui.return_sessions}`
        : ui.operator_record_hint;

    // The leading mode gets the wide cap (orange unless a checkpoint leads) and
    // the Enter hint; the other sits in the row below as an ordinary alpha.
    const leadClass = (lead: boolean) => lead
        ? `menu-key menu-key--wide btn-cyber ${runCheckpoint ? 'btn-cyber-ghost' : 'btn-cyber-primary'}`
        : 'menu-key btn-cyber btn-cyber-ghost';
    const enterHint = (lead: boolean) => lead && !runCheckpoint
        ? <span className="menu-key-enter" aria-hidden="true">↵</span>
        : null;
    const relayKey = (lead: boolean) => (
        <button onClick={onRelay} data-hotkey="1" className={leadClass(lead)}>
            <span className="keycap">1</span>
            <span className="menu-key-text">
                <span className="menu-key-title">{language === 'ru' ? 'ПОСЛЕДНИЙ КАНАЛ' : 'THE LAST RELAY'}</span>
                <span className="screens-btn-sub">{leadWithPrologue ? ui.relay_hint : ui.relay_replay_hint}</span>
            </span>
            {enterHint(lead)}
        </button>
    );
    const campaignKey = (lead: boolean) => (
        <button onClick={onInitialize} data-hotkey="2" className={leadClass(lead)}>
            <span className="keycap">2</span>
            <span className="menu-key-text">
                <span className="menu-key-title">{stripKeyHint(ui.init_link)}</span>
                <span className="screens-btn-sub">{ui.campaign_hint}</span>
            </span>
            {enterHint(lead)}
        </button>
    );

    return (
        <div className="menu-screen animate-fade-in-up">
            {/* TITLE — the name of the game, set in keycaps that type themselves
                in. The mission title sits under it as a dossier label, and the
                pitch is set in the prose face the story is typed in. */}
            <header className="menu-title">
                <KeycapWordmark />
                <div className="menu-dossier">
                    <span className="menu-dossier-rule" aria-hidden="true" />
                    <h2 className="menu-dossier-title">{ui.main_title}</h2>
                    <span className="menu-dossier-rule" aria-hidden="true" />
                </div>
                <p className="menu-pitch">
                    {ui.intro_desc}{' '}
                    <em>{ui.mistakes_warn}</em>
                </p>
                {isTouchDevice && (
                    <p className="fs-micro uppercase tracking-[0.18em] text-slate-500">{ui.keyboard_notice}</p>
                )}
            </header>

            <div className="mt-5">
                <AccountDeletedNotice language={language} />
            </div>

            {/* PLAY — laid out like a keyboard cluster: one wide modifier on the
                top row, two alphas under it. A newcomer is led into the prologue;
                once it is done, the campaign takes the wide key. The digits stay
                with their modes. An in-flight checkpoint beats both. */}
            <div className="menu-keys mt-7">
                {runCheckpoint && (
                    <button
                        onClick={onResume}
                        data-hotkey="r"
                        className="menu-key menu-key--wide btn-cyber btn-cyber-primary"
                    >
                        <span className="keycap">R</span>
                        <span className="menu-key-text">
                            <span className="menu-key-title">{ui.resume_run} · {ui.resume_sector} {runCheckpoint.nextLevel}</span>
                            <span className="screens-btn-sub">{language === 'ru' ? 'Продолжить с сохранённой строки' : 'Continue from the saved line'}</span>
                        </span>
                    </button>
                )}
                {leadWithPrologue ? relayKey(true) : campaignKey(true)}
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
                {leadWithPrologue ? campaignKey(false) : relayKey(false)}
                <button
                    onClick={onDaily}
                    data-hotkey="3"
                    disabled={dailyAttemptsExhausted}
                    className="menu-key screens-daily-button btn-cyber btn-cyber-ghost group"
                >
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

            {/* META — progression between runs. Quieter than PLAY: a lower row
                of smaller caps, then the two dials that tune a run. */}
            <div className="mt-7">
                <div className="menu-row-label" aria-hidden="true">
                    <span>{language === 'ru' ? 'Между забегами' : 'Between runs'}</span>
                </div>
                <div className="menu-keys menu-keys--meta mt-3">
                    <button
                        onClick={onBlackMarket}
                        data-hotkey="4"
                        className="menu-key menu-key--small btn-cyber btn-cyber-ghost"
                    >
                        <span className="keycap">4</span>
                        <span className="menu-key-text">
                            <span className="menu-key-title">{stripKeyHint(ui.black_market)}</span>
                            <span className="screens-btn-sub">{ui.market_subtitle}</span>
                        </span>
                    </button>
                    <button type="button" onClick={onPractice} className="menu-key btn-cyber btn-cyber-ghost" data-hotkey="6">
                    <span className="keycap">6</span><span className="menu-key-text">
                      <span className="menu-key-title">{language === 'ru' ? 'Тренировка · 5 мин' : 'Practice · 5 min'}</span>
                      <span className="screens-btn-sub">{trainingHint(training, language) ?? (language === 'ru' ? 'Замер → отработка → результат' : 'Check → practice → result')}</span>
                    </span>
                </button>
                <button
                        onClick={onOperatorRecord}
                        data-hotkey="5"
                        className="menu-key menu-key--small btn-cyber btn-cyber-ghost"
                    >
                        <span className="keycap">5</span>
                        <span className="menu-key-text">
                            <span className="menu-key-title">{stripKeyHint(ui.operator_record)}</span>
                            <span className="screens-btn-sub">{recordHint}</span>
                        </span>
                    </button>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                    {/* Story pace sits beside the Pact: the one control that
                        lowers the bar, priced like the dampener. A toggle, so
                        it looks like a switch rather than another key. */}
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
