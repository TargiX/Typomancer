import React from 'react';
import type { Language, StoryGenreId } from '../../types';
import type { UITranslations } from '../../services/i18n';
import { GENRE_ORDER } from '../../services/genreConfig';
import { stripKeyHint } from '../../services/text';
import GenreCard from '../GenreCard';

interface GenreSelectionScreenProps {
    ui: UITranslations;
    language: Language;
    onSelect: (genre: StoryGenreId) => void;
    onBack: () => void;
}

const GenreSelectionScreen: React.FC<GenreSelectionScreenProps> = ({ ui, language, onSelect, onBack }) => (
    <div className="screens-cut-panel w-full max-w-4xl max-h-[calc(100vh-3rem)] bg-[#0b101a]/95 border border-white/[0.07] p-8 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.4)] animate-fade-in-up flex flex-col overflow-hidden">
        <div className="shrink-0 border-b border-white/[0.06] pb-5 mb-6 text-center">
            <h2 className="font-display text-3xl font-bold text-white mb-2 tracking-tight">{ui.genre_title}</h2>
            <p className="text-slate-400 fs-body">{ui.genre_subtitle}</p>
            <p className="text-slate-600 fs-micro uppercase tracking-[0.14em] mt-3">{ui.genre_persists_note}</p>
        </div>
        <div className="min-h-0 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4 pr-1">
            {GENRE_ORDER.map((genreId, index) => (
                <GenreCard key={genreId} genreId={genreId} index={index} language={language} onSelect={onSelect} />
            ))}
        </div>
        <button
            type="button"
            onClick={onBack}
            className="btn-cyber btn-cyber-ghost mt-6 shrink-0 w-full py-2.5 text-slate-500 hover:text-white transition-colors uppercase tracking-[0.16em] fs-micro font-bold flex items-center justify-center gap-2"
        >
            <span className="keycap">ESC</span>
            <span>{stripKeyHint(ui.genre_back)}</span>
        </button>
    </div>
);

export default GenreSelectionScreen;
