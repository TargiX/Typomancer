import React from 'react';
import type { Language, UserProfile, UserUpgrades } from '../../types';
import type { UITranslations } from '../../services/i18n';
import type { GenreSkin, UpgradeId } from '../../services/genreSkin';
import { META_UPGRADES, getUpgradeCost } from '../../services/perks';
import { stripKeyHint } from '../../services/text';
import EmblemTile from '../EmblemTile';

const describeUpgradeEffect = (key: UpgradeId, level: number, ui: UITranslations): string => {
    switch (key) {
        case 'synapticWeave': return `+${level * META_UPGRADES.synapticWeave.effectPerLevel} ${ui.health}`;
        case 'cryptoMiner': return `+${Math.round(level * META_UPGRADES.cryptoMiner.effectPerLevel * 100)}% ${ui.credits}`;
        case 'signalDampener': return `-${Math.round(level * META_UPGRADES.signalDampener.effectPerLevel * 100)}% ${ui.heat}`;
        case 'bufferExpansion': return `+${level * META_UPGRADES.bufferExpansion.effectPerLevel} ${ui.focus}`;
        case 'focusLens': return `+${(level * META_UPGRADES.focusLens.effectPerLevel) / 1000}s ${ui.focus}`;
        case 'patternScanner': return `+${Math.round(level * META_UPGRADES.patternScanner.effectPerLevel * 100)}% ${ui.evidence}`;
        default: return '';
    }
};

interface BlackMarketScreenProps {
    ui: UITranslations;
    language: Language;
    skin: GenreSkin;
    profile: UserProfile;
    onBuy: (key: keyof UserUpgrades) => void;
    onClose: () => void;
}

const BlackMarketScreen: React.FC<BlackMarketScreenProps> = ({ ui, language, skin, profile, onBuy, onClose }) => (
    <div className="screens-cut-panel w-full max-w-5xl h-[80vh] bg-[#0b101a]/95 border border-white/[0.07] flex flex-col overflow-hidden animate-fade-in-up shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="p-6 border-b border-white/[0.06] bg-white/[0.015] flex justify-between items-end gap-6">
            <div>
                <h2 className="font-display text-3xl font-bold text-white tracking-tight">{ui.market_title}</h2>
                <p className="text-slate-500 fs-body mt-1">{ui.market_subtitle}</p>
            </div>
            <div className="text-right">
                <div className="fs-micro text-slate-500 uppercase tracking-[0.2em]">{ui.avail_credits}</div>
                <div className="font-display text-4xl font-bold text-white tabular-nums leading-none mt-1">{Math.floor(profile.credits)} <span className="fs-body text-emerald-400">{ui.currency_suffix}</span></div>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.entries(META_UPGRADES) as [UpgradeId, typeof META_UPGRADES.synapticWeave][]).map(([key, def], idx) => {
                const currentLvl = profile.upgrades[key];
                const nextCost = getUpgradeCost(key, currentLvl);
                const isMaxed = currentLvl >= def.maxLevel;
                const canAfford = profile.credits >= nextCost;
                const copy = skin.upgrades[key];
                return (
                    <div key={key} className="screens-cut-card screens-upgrade-card bg-[#0b101a] border border-white/[0.07] relative overflow-hidden group hover:border-emerald-400/25 transition-colors min-h-[210px]">
                        <div className="screens-card-art-frame screens-upgrade-art-rail">
                            <EmblemTile
                                src={`/assets/upgrades/${key}.png`}
                                size={56}
                                className="screens-card-art border-0 bg-black/20"
                                style={{ width: '100%', height: '100%' }}
                            />
                        </div>
                        <span className="keycap absolute top-3 right-3 opacity-60 group-hover:opacity-100">{idx + 1}</span>
                        <div className="screens-upgrade-content">
                            <div className="screens-upgrade-heading mb-3 pr-9">
                                <h3 className="min-w-0 font-display fs-lead font-bold text-slate-100 leading-tight">{copy.name[language]}</h3>
                                <div className="flex shrink-0 gap-1 pt-1" aria-label={`${ui.level} ${currentLvl}/${def.maxLevel}`}>
                                    {Array.from({ length: 10 }, (_, levelIndex) => (
                                        <span key={levelIndex} className={`h-2 w-2 border ${levelIndex < Math.round((currentLvl / def.maxLevel) * 10) ? 'border-emerald-300 bg-emerald-300 shadow-[0_0_5px_rgba(52,211,153,0.35)]' : 'border-white/10 bg-white/[0.025]'}`} />
                                    ))}
                                </div>
                            </div>
                            <p className="text-slate-400 fs-body mb-5 flex-1">{copy.desc[language]}</p>
                            <div className="screens-upgrade-footer flex flex-col items-start gap-3 mt-auto">
                                <div className="fs-micro uppercase tracking-[0.14em] text-slate-500">
                                    {ui.effect}: <span className="text-emerald-400">{describeUpgradeEffect(key, currentLvl, ui)}</span>
                                </div>
                                {isMaxed ? (
                                    <button disabled className="btn-cyber btn-cyber-ghost self-end px-4 py-2 fs-micro font-bold tracking-[0.14em] text-slate-600 cursor-not-allowed opacity-50">
                                        {ui.maxed_out}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => onBuy(key)}
                                        disabled={!canAfford}
                                        className={`btn-cyber btn-cyber-ghost self-end px-4 py-2 fs-micro font-bold tracking-[0.12em] flex items-center gap-2 transition-all ${canAfford ? 'text-emerald-200 hover:text-white hover:shadow-[0_0_22px_rgba(52,211,153,0.12)]' : 'text-slate-600 cursor-not-allowed opacity-45'}`}
                                    >
                                        <span>{ui.install}</span>
                                        <span className={canAfford ? 'text-emerald-400 tabular-nums' : 'tabular-nums'}>{nextCost} {ui.currency_suffix}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="absolute bottom-0 left-0 h-px bg-emerald-500/10 w-full">
                            <div className="h-full bg-emerald-400 transition-all duration-500 shadow-[0_0_7px_rgba(52,211,153,0.55)]" style={{ width: `${(currentLvl / def.maxLevel) * 100}%` }}></div>
                        </div>
                    </div>
                );
            })}
        </div>
        <div className="p-4 border-t border-white/[0.06] bg-black/10 flex flex-col items-center gap-3">
            <p className="fs-label text-slate-600 text-center max-w-xl">{ui.genre_persists_note}</p>
            <button
                onClick={onClose}
                className="btn-cyber btn-cyber-ghost px-6 py-2 text-slate-400 hover:text-white transition-colors uppercase tracking-[0.16em] fs-micro font-bold flex items-center gap-2"
            >
                <span className="keycap">ESC</span>
                <span>{stripKeyHint(ui.return_menu)}</span>
            </button>
        </div>
    </div>
);

export default BlackMarketScreen;
