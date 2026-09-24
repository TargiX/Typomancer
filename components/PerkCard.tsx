import React from 'react';
import type { Perk } from '../types';
import type { UITranslations } from '../services/i18n';
import { stripLeadingGlyph } from '../services/text';
import EmblemTile from './EmblemTile';
import { PerkTypeIcon } from './icons';

interface PerkCardProps {
    perk: Perk;
    index: number;
    onSelect: (perk: Perk) => void;
    disabled?: boolean;
    ui: UITranslations;
}

const PerkCard: React.FC<PerkCardProps> = ({ perk, index, onSelect, disabled = false, ui }) => {
    const isLegendary = perk.rarity === 'legendary';
    const isRare = perk.rarity === 'rare';
    const rarityClass = isLegendary
        ? 'screens-perk-legendary border-amber-400/60 shadow-[0_0_28px_rgba(251,191,36,0.12)] hover:shadow-[0_0_36px_rgba(251,191,36,0.2)]'
        : isRare
            ? 'border-violet-400/60 shadow-[0_0_24px_rgba(167,139,250,0.12)] hover:shadow-[0_0_32px_rgba(167,139,250,0.2)]'
            : 'border-white/10 hover:border-emerald-400/35 hover:shadow-[0_0_24px_rgba(134,214,166,0.1)]';
    const rarityColor = isLegendary ? 'text-amber-300' : isRare ? 'text-violet-300' : 'text-slate-300';
    const rarityLabel = {
        common: ui.rarity_common,
        rare: ui.rarity_rare,
        legendary: ui.rarity_legendary
    }[perk.rarity];

    return (
        <button
            onClick={() => onSelect(perk)}
            disabled={disabled}
            className={`screens-cut-card screens-perk-card group relative overflow-hidden border bg-[#151418] ${rarityClass} transition-all duration-300 text-left h-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/70 disabled:cursor-wait disabled:opacity-55`}
        >
            <div className="screens-card-art-frame screens-card-banner screens-perk-card-banner">
                <EmblemTile
                    src={`/assets/perks/${perk.groupId}.png`}
                    size={60}
                    fallback={<PerkTypeIcon type={perk.type} />}
                    className={`screens-card-art border bg-black/20 ${
                    perk.type === 'defense' ? 'border-sky-400/25 text-sky-300' :
                    perk.type === 'stealth' ? 'border-violet-400/25 text-violet-300' :
                    perk.type === 'utility' ? 'border-emerald-400/25 text-emerald-300' :
                    'border-rose-400/25 text-rose-300'
                    }`}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>
            <div className="screens-perk-meta flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="keycap opacity-70 group-hover:opacity-100">{index + 1}</span>
                    <span className={`truncate fs-micro font-bold uppercase tracking-[0.2em] ${rarityColor}`}>{rarityLabel}</span>
                </div>
                 <div className="flex gap-1" aria-label={`${ui.level} ${perk.tier}`}>
                     {Array.from({ length: perk.maxTier }, (_, tierIndex) => (
                         <span
                             key={tierIndex}
                             className={`h-1.5 w-3 border ${tierIndex < perk.tier ? (isLegendary ? 'border-amber-300 bg-amber-300' : isRare ? 'border-violet-300 bg-violet-300' : 'border-emerald-300 bg-emerald-300') : 'border-white/10 bg-white/[0.03]'}`}
                         />
                     ))}
                 </div>
            </div>
            <h4 className="screens-perk-title font-display fs-lead font-bold leading-tight text-white transition-colors">{perk.name}</h4>
            <p className="screens-perk-description fs-body text-slate-400 leading-relaxed">
                {perk.description}
            </p>
            {isLegendary && (
                <div className="screens-perk-legend fs-micro text-amber-300 font-bold uppercase tracking-[0.2em]">
                    {stripLeadingGlyph(ui.legendary_drop)}
                </div>
            )}
        </button>
    );
};

export default PerkCard;
