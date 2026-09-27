import React from 'react';
import type { Language, Perk } from '../types';
import type { UITranslations } from '../services/i18n';
import { AccountChip } from './CloudProgress';

interface HudStripProps {
    ui: UITranslations;
    credits: number;
    perks: Perk[];
    language: Language;
    onToggleLanguage: () => void;
    onAccount?: () => void;
    onSettings?: () => void;
    languageLocked?: boolean;
}

/* Status strip — what the shell column was actually for, minus the parts other
   screens already show. No document column: the wordmark repeats the title on
   screen, the mission meters live on the run HUD and in the debrief tiles, and
   the log moved into the debrief where reading a feed makes sense. */
const HudStrip: React.FC<HudStripProps> = ({ ui, credits, perks, language, onToggleLanguage, onAccount, onSettings, languageLocked }) => (
    <div className="hud-strip">
        <div className="flex items-center gap-3">
            <span className="fs-micro uppercase tracking-[0.22em] text-slate-500">{ui.wallet}</span>
            <span className="font-display fs-lead font-bold tabular-nums leading-none text-white">
                {Math.floor(credits || 0)}<span className="fs-body text-signal ml-1">{ui.currency_suffix}</span>
            </span>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
            {perks.map((p, i) => (
                <span key={i} title={p.description} className={`fs-micro px-2 py-0.5 border cursor-help tracking-wide ${
                    p.tier === 3 ? 'border-amber-400/40 text-amber-300 bg-amber-400/10' :
                    p.tier === 2 ? 'border-violet-400/40 text-violet-300 bg-violet-400/10' :
                    'border-white/10 text-slate-300 bg-white/[0.03]'
                }`}>
                    {p.name}
                </span>
            ))}
        </div>
        <div className="flex items-center gap-2">
            {onAccount && <AccountChip language={language} onOpen={onAccount} />}
            {/* Sound, switches, reading and keys all live in Settings. */}
            <button type="button" onClick={onSettings} className="hud-strip-button">{ui.settings}</button>
            <button disabled={languageLocked} onClick={onToggleLanguage} className="hud-strip-button">
                {language === 'en' ? 'RU' : 'EN'}
            </button>
        </div>
    </div>
);

export default HudStrip;
