import React, { useState } from 'react';
import type { LevelReport, MissionState, Perk, StoryLogItem } from '../../types';
import type { UITranslations } from '../../services/i18n';
import { getTypingFocus } from '../../services/gameRules';
import { getPactRewardMultiplier, type PactClauseId } from '../../services/pact';
import PerkCard from '../PerkCard';

interface SectorCompleteScreenProps {
    ui: UITranslations;
    report: LevelReport;
    xpGained: number;
    storyLog: StoryLogItem[];
    fallbackMission: MissionState;
    perks: Perk[];
    ready: boolean;
    pactClauses: PactClauseId[];
    onSelectPerk: (perk: Perk) => void;
    onBankExit: () => void;
}

const SectorCompleteScreen: React.FC<SectorCompleteScreenProps> = ({
    ui,
    report,
    xpGained,
    storyLog,
    fallbackMission,
    perks,
    ready,
    pactClauses,
    onSelectPerk,
    onBankExit
}) => {
    const [logOpen, setLogOpen] = useState(false);
    const accuracy = Math.round(report.accuracy ?? 100);
    // Accuracy leads the debrief. This is an accuracy trainer, and the
    // screen used to open with a speed number, which taught the
    // opposite of what the game rewards.
    const focus = getTypingFocus({
        avgWpm: report.avgWpm,
        accuracy: report.accuracy ?? 100,
        consistency: report.consistency ?? 100,
        totalMistakes: report.totalMistakes,
        score: 0
    });
    const coach = { accuracy: ui.focus_accuracy, consistency: ui.focus_consistency, speed: ui.focus_speed, mastery: ui.focus_mastery }[focus];

    return (
        <div className="screens-cut-panel w-full max-w-4xl max-h-[calc(100vh-3rem)] overflow-y-auto bg-[#151418]/95 border border-white/[0.07] p-8 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.4)] animate-fade-in-up">
            <div className="border-b border-white/[0.06] pb-5 mb-6">
                <div className="flex justify-between items-start mb-2">
                    <h2 className="font-display text-3xl font-bold text-white">{ui.seq_complete}</h2>
                    <div className="text-right">
                        <span className="fs-micro text-slate-500 uppercase tracking-[0.2em] block">{ui.xp_gained}</span>
                        <span className="font-display text-2xl font-bold text-emerald-300 tabular-nums">+{xpGained} XP</span>
                    </div>
                </div>
                <p className="text-slate-300 text-base leading-relaxed italic">
                    "{report.narrativeSummary}"
                </p>
            </div>
            <div className={`screens-accuracy-hero screens-accuracy-hero--${focus} mb-3`}>
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <div className="fs-micro uppercase tracking-[0.22em] text-slate-500">{ui.accuracy}</div>
                        <div className="screens-accuracy-value font-display tabular-nums">{accuracy}%</div>
                    </div>
                    <div className="text-right">
                        <div className="fs-micro uppercase tracking-[0.22em] text-slate-500">{ui.next_drill}</div>
                        <p className="screens-accuracy-coach">{coach}</p>
                    </div>
                </div>
                <div className="screens-accuracy-bar mt-3" aria-hidden="true">
                    <div className="screens-accuracy-bar-fill" style={{ width: `${Math.max(0, Math.min(100, accuracy))}%` }} />
                </div>
                <div className="mt-2 fs-micro text-slate-500 tabular-nums">
                    {report.totalMistakes} {report.totalMistakes === 1 ? ui.mistake_one : ui.mistake_many}
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
                <div className="screens-stat-tile p-4 text-center border border-white/[0.07] bg-white/[0.02]">
                    <div className="font-display text-3xl font-bold text-white tabular-nums leading-none">{Math.round(report.avgWpm)}</div>
                    <div className="mt-2 fs-micro text-slate-500 uppercase tracking-[0.18em]">{ui.avg_speed} · {ui.wpm}</div>
                </div>
                <div className={`screens-stat-tile p-4 text-center border ${pactClauses.length ? 'border-amber-400/25 bg-amber-400/[0.03]' : 'border-white/[0.07] bg-white/[0.02]'}`}>
                     <div className={`font-display text-3xl font-bold tabular-nums leading-none ${pactClauses.length ? 'text-amber-300' : 'text-white'}`}>+{report.creditsEarned}</div>
                     <div className="mt-2 fs-micro text-slate-500 uppercase tracking-[0.18em]">
                        {ui.credits}
                        {/* The payout and the reason for it, side by side. */}
                        {pactClauses.length > 0 && (
                            <span className="ml-1 text-amber-300/90">
                                {ui.pact_title} x{getPactRewardMultiplier(pactClauses).toFixed(2)}
                            </span>
                        )}
                     </div>
                </div>
                <div className="screens-stat-tile p-4 text-center border border-amber-400/15 bg-amber-400/[0.025]">
                     <div className="font-display text-3xl font-bold text-amber-300 tabular-nums leading-none">{Math.round(report.mission?.heat ?? fallbackMission.heat)}%</div>
                     <div className="mt-2 fs-micro text-slate-500 uppercase tracking-[0.18em]">{ui.heat}</div>
                </div>
                <div className="screens-stat-tile p-4 text-center border border-white/[0.07] bg-white/[0.02]">
                     <div className="font-display text-3xl font-bold text-white tabular-nums leading-none">{report.finalHealth}</div>
                     <div className="mt-2 fs-micro text-slate-500 uppercase tracking-[0.18em]">{ui.health}</div>
                </div>
                <div className="screens-stat-tile p-4 text-center border border-emerald-400/15 bg-emerald-400/[0.025]">
                     <div className="font-display text-3xl font-bold text-emerald-300 tabular-nums leading-none">{report.mission?.evidence ?? fallbackMission.evidence}</div>
                     <div className="mt-2 fs-micro text-slate-500 uppercase tracking-[0.18em]">{ui.evidence}</div>
                </div>
                <div className="screens-stat-tile p-4 text-center border border-sky-400/15 bg-sky-400/[0.025]">
                     <div className="font-display text-3xl font-bold text-sky-300 tabular-nums leading-none">{report.mission?.trust ?? fallbackMission.trust}</div>
                     <div className="mt-2 fs-micro text-slate-500 uppercase tracking-[0.18em]">{ui.trust}</div>
                </div>
                <div className="screens-stat-tile p-4 text-center border border-violet-400/15 bg-violet-400/[0.025]">
                    <div className="font-display text-3xl font-bold text-violet-300 tabular-nums leading-none">{Math.round(report.consistency ?? 100)}%</div>
                    <div className="mt-2 fs-micro text-slate-500 uppercase tracking-[0.18em]">{ui.consistency}</div>
                </div>
            </div>
            {/* The mission log used to live in the shell column, where it was
                a feed nobody reads while typing. Between sectors it is the
                right thing to look at, so it lands here instead. */}
            {storyLog.length > 0 && (
                <div className="screens-cut-card border border-white/[0.06] bg-black/20 p-4 mb-6">
                    <button
                        type="button"
                        onClick={() => setLogOpen(open => !open)}
                        aria-expanded={logOpen}
                        className="flex w-full items-center justify-between gap-3 text-left"
                    >
                        <span className="fs-micro uppercase tracking-[0.2em] text-slate-500">{ui.mission_log}</span>
                        <span className="fs-label text-slate-400">{logOpen ? '−' : `+${storyLog.length}`}</span>
                    </button>
                    {logOpen && (
                        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto no-scrollbar">
                            {storyLog.slice().reverse().map((log, idx) => (
                                <div key={idx} className="border-l border-emerald-500/25 pl-3">
                                    <p className="fs-label text-slate-300">{log.text}</p>
                                    {log.wpm > 0 && (
                                        <span className="fs-micro text-slate-600">
                                            {ui.speed}: <span className="tabular-nums">{log.wpm}</span> {ui.wpm}
                                            {log.meta ? ` · ${log.meta}` : ''}
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h3 className="font-display fs-lead font-bold text-white tracking-[0.04em]">{ui.select_upgrade}</h3>
                    <p className="mt-1 fs-micro text-slate-500">{ui.continue_hint}</p>
                </div>
                <button
                    type="button"
                    onClick={onBankExit}
                    disabled={!ready}
                    className="btn-cyber btn-cyber-ghost px-5 py-2.5 fs-micro font-bold tracking-[0.12em] text-slate-300 hover:text-white disabled:cursor-wait disabled:opacity-45"
                >
                    {ui.bank_exit}
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {perks.map((perk, index) => (
                    <PerkCard key={perk.id} perk={perk} index={index} onSelect={onSelectPerk} disabled={!ready} ui={ui} />
                ))}
            </div>
        </div>
    );
};

export default SectorCompleteScreen;
