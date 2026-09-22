import React from 'react';
import { createPortal } from 'react-dom';
import type { Language } from '../../types';
import { AccountPanel } from '../CloudProgress';
import { downloadSnapshot, readSnapshot } from '../../services/cloudProgress';
import { playerStorage } from '../../services/playerStorage';

const COPY = {
    en: {
        eyebrow: 'SYSTEM',
        title: 'Account',
        subtitle: 'Sync progress across devices, export a copy, or delete the account. Nothing here affects the current run.',
        localOnly: 'Progress is stored on this device. Cloud sync is not enabled in this build.',
        exportCopy: 'Export device copy',
        close: 'BACK TO DECK'
    },
    ru: {
        eyebrow: 'СИСТЕМА',
        title: 'Аккаунт',
        subtitle: 'Синхронизация прогресса между устройствами, экспорт копии или удаление аккаунта. На текущий забег это не влияет.',
        localOnly: 'Прогресс хранится на этом устройстве. Облачная синхронизация в этой сборке выключена.',
        exportCopy: 'Скачать локальную копию',
        close: 'ВЕРНУТЬСЯ К ПУЛЬТУ'
    }
};

/** AccountPanel returns null when cloud sync is disabled; the screen still
    needs to say where progress lives instead of rendering an empty page. */
const AccountBody: React.FC<{ language: Language }> = ({ language }) => {
    if (import.meta.env.VITE_CLOUD_PROGRESS === 'true') return <AccountPanel language={language} />;
    const ui = COPY[language];
    return (
        <section className="border border-white/10 bg-white/[0.02] p-4 text-left space-y-3" aria-label={ui.title}>
            <p className="text-sm leading-relaxed text-slate-400">{ui.localOnly}</p>
            <button
                type="button"
                className="btn-cyber btn-cyber-ghost px-3 py-2 text-sm text-emerald-200"
                onClick={() => downloadSnapshot(readSnapshot(playerStorage()!))}
            >
                {ui.exportCopy}
            </button>
        </section>
    );
};

/* Account management is system chrome, not gameplay — it gets the same
   full-page document treatment as the Operator Record instead of competing
   with the menu's play actions. */
const AccountScreen: React.FC<{ language: Language; onClose: () => void }> = ({ language, onClose }) => {
    const ui = COPY[language];
    // Portal to <body>: same stacking reason as OperatorRecord — the app
    // shell's `relative z-10` column would cap this below the HUD strip.
    return createPortal(
        <section className="operator-record" aria-labelledby="account-title">
            <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-5 py-10 sm:py-16">
                <div className="operator-record-header">
                    <div>
                        <span>{ui.eyebrow}</span>
                        <h2 id="account-title">{ui.title}</h2>
                        <p>{ui.subtitle}</p>
                    </div>
                </div>
                <div className="mt-8">
                    <AccountBody language={language} />
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="btn-cyber btn-cyber-ghost mt-8 self-start px-6 py-3 font-display text-sm font-bold tracking-[0.08em] text-emerald-200"
                >
                    {ui.close}
                </button>
            </div>
        </section>,
        document.body
    );
};

export default AccountScreen;
