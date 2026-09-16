import React from 'react';
import type { UITranslations } from '../../services/i18n';

const LoadingScreen: React.FC<{ ui: UITranslations; nextSector: boolean }> = ({ ui, nextSector }) => (
    <div className="flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
        <p className="text-emerald-400 animate-pulse tracking-widest fs-body">
            {nextSector ? ui.generating_sector : ui.generating_scenario}
        </p>
    </div>
);

export default LoadingScreen;
