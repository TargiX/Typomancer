import React from 'react';
import type { Language, StoryGenreId } from '../types';
import { getGenrePack } from '../services/genreConfig';
import EmblemTile from './EmblemTile';
import { GenreIcon } from './icons';
import { COLORWAY_NAMES, colorwayForGenre } from '../services/colorway';

interface GenreCardProps {
    genreId: StoryGenreId;
    index: number;
    language: Language;
    onSelect: (genre: StoryGenreId) => void;
}

const GenreCard: React.FC<GenreCardProps> = ({ genreId, index, language, onSelect }) => {
    const pack = getGenrePack(genreId);
    return (
        <button
            type="button"
            onClick={() => onSelect(genreId)}
            className="screens-cut-card screens-world-card group relative min-h-[286px] overflow-hidden border bg-[#151418] text-left h-full transition-all focus-visible:outline-none"
            style={{
                borderColor: `${pack.accent}55`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 24px ${pack.accent}0c`
            }}
        >
            <div className="screens-card-art-frame screens-card-banner screens-world-card-banner">
                <EmblemTile
                    src={`/assets/worlds/${genreId}.png`}
                    size={68}
                    fallback={<GenreIcon genre={genreId} className="h-7 w-7" />}
                    className="screens-card-art border bg-black/20"
                    style={{ width: '100%', height: '100%', borderColor: `${pack.accent}44`, color: pack.accent }}
                />
            </div>
            <div className="screens-world-heading flex min-w-0 items-start gap-3">
                <span className="keycap shrink-0 opacity-70 group-hover:opacity-100">{index + 1}</span>
                <div className="min-w-0">
                    <h4 className="font-display fs-lead font-bold" style={{ color: pack.accent }}>{pack.name[language]}</h4>
                    <p className="fs-micro mt-1 uppercase tracking-[0.18em] text-slate-500">{pack.ui.mainTitle[language]}</p>
                </div>
            </div>
            <p className="screens-world-description fs-body text-slate-400 leading-relaxed">{pack.tagline[language]}</p>
            <p className="screens-world-goal fs-label text-slate-500 border-t border-white/[0.06] pt-3">{pack.ui.campaignGoal[language]}</p>
            {/* The keycap set this world is played on, scoped to the card. */}
            <span className="colorway-swatch px-5 pb-4" data-colorway={colorwayForGenre(genreId)}>
                <span className="colorway-swatch-cap colorway-swatch-cap--dark" />
                <span className="colorway-swatch-cap colorway-swatch-cap--legend" />
                <span className="colorway-swatch-cap colorway-swatch-cap--signal" />
                <span className="colorway-swatch-name">{COLORWAY_NAMES[colorwayForGenre(genreId)][language]}</span>
            </span>
        </button>
    );
};

export default GenreCard;
