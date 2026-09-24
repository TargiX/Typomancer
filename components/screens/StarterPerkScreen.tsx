import React from 'react';
import type { Language, Perk, StoryGenreId } from '../../types';
import type { UITranslations } from '../../services/i18n';
import type { GenrePack } from '../../services/genreConfig';
import PerkCard from '../PerkCard';
import { GenreIcon } from '../icons';

interface StarterPerkScreenProps {
    ui: UITranslations;
    language: Language;
    perks: Perk[];
    genrePack: GenrePack;
    genre: StoryGenreId;
    onSelect: (perk: Perk) => void;
}

const StarterPerkScreen: React.FC<StarterPerkScreenProps> = ({ ui, language, perks, genrePack, genre, onSelect }) => (
    <div className="screens-cut-panel w-full max-w-4xl max-h-[calc(100vh-3rem)] overflow-y-auto bg-[#151418]/95 border border-white/[0.07] p-8 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.4)] animate-fade-in-up">
        <div className="border-b border-white/[0.06] pb-5 mb-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-3 border fs-micro font-bold tracking-[0.2em] uppercase screens-cut-chip"
                 style={{ borderColor: `${genrePack.accent}66`, color: genrePack.accent, background: `${genrePack.accent}14` }}>
                <GenreIcon genre={genre} className="h-3.5 w-3.5" />
                <span>{ui.sim_badge}</span>
                <span className="opacity-70">//</span>
                <span>{genrePack.name[language]}</span>
            </div>
            <h2 className="font-display text-3xl font-bold text-white mb-2 tracking-tight">{ui.loadout_title}</h2>
            <p className="text-slate-400 fs-body">{ui.loadout_subtitle}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {perks.map((perk, index) => (
                <PerkCard key={perk.id} perk={perk} index={index} onSelect={onSelect} ui={ui} />
            ))}
        </div>
    </div>
);

export default StarterPerkScreen;
