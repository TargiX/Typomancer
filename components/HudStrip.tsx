import React, { useState } from 'react';
import type { Language, Perk } from '../types';
import type { UITranslations } from '../services/i18n';
import type { SkillStackAnchor } from '../services/skillStackAnchor';
import { stripLeadingGlyph } from '../services/text';
import { AccountChip } from './CloudProgress';
import { audioEngine, SWITCH_PROFILES, type SwitchProfile } from '../services/audioEngine';

const SWITCH_LABELS: Record<SwitchProfile, Record<Language, string>> = {
    melodic: { en: 'MELODIC', ru: 'МЕЛОДИЯ' },
    thock: { en: 'THOCK', ru: 'THOCK' },
    clicky: { en: 'CLICKY', ru: 'CLICKY' }
};

/* The keystroke sound, cycled like a switch tester: each press plays the new
   switch once so the player hears what they picked. */
const SwitchProfileButton: React.FC<{ language: Language }> = ({ language }) => {
    const [profile, setProfile] = useState<SwitchProfile>(() => audioEngine.getSwitchProfile());
    const cycle = () => {
        const next = SWITCH_PROFILES[(SWITCH_PROFILES.indexOf(profile) + 1) % SWITCH_PROFILES.length];
        audioEngine.unlock();
        setProfile(audioEngine.setSwitchProfile(next));
    };
    return (
        <button type="button" onClick={cycle} className="hud-strip-button" title={language === 'ru' ? 'Звук клавиш' : 'Key sound'}>
            {language === 'ru' ? 'СВИТЧИ' : 'SWITCH'}: {SWITCH_LABELS[profile][language]}
        </button>
    );
};

interface HudStripProps {
    ui: UITranslations;
    credits: number;
    perks: Perk[];
    musicActive: boolean;
    skillStackAnchor: SkillStackAnchor;
    language: Language;
    onToggleMusic: () => void;
    onToggleSkillStack: () => void;
    onToggleLanguage: () => void;
    onAccount?: () => void;
}

/* Status strip — what the shell column was actually for, minus the parts other
   screens already show. No document column: the wordmark repeats the title on
   screen, the mission meters live on the run HUD and in the debrief tiles, and
   the log moved into the debrief where reading a feed makes sense. */
const HudStrip: React.FC<HudStripProps> = ({ ui, credits, perks, musicActive, skillStackAnchor, language, onToggleMusic, onToggleSkillStack, onToggleLanguage, onAccount }) => (
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
            <SwitchProfileButton language={language} />
            <button onClick={onToggleMusic} className="hud-strip-button">
                {musicActive ? stripLeadingGlyph(ui.audio_active) : ui.audio_muted}
            </button>
            <button type="button" onClick={onToggleSkillStack} className="hud-strip-button">
                {skillStackAnchor === 'caret' ? ui.skill_stack_caret : ui.skill_stack_corner}
            </button>
            <button onClick={onToggleLanguage} className="hud-strip-button">
                {language === 'en' ? 'RU' : 'EN'}
            </button>
        </div>
    </div>
);

export default HudStrip;
