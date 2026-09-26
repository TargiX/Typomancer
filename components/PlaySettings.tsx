import { GOAL_COPY, type CampaignGoal } from '../services/campaignTraining';
import React, { useEffect, useRef, useState } from 'react';
import type { Language } from '../types';
import { SKILL_KEYS, keyLabel, type PlayPreferences, type SkillKey } from '../services/playPreferences';
import { audioEngine, SWITCH_PROFILES, type SwitchProfile } from '../services/audioEngine';
import type { SkillStackAnchor } from '../services/skillStackAnchor';

const SWITCH_LABELS: Record<SwitchProfile, Record<Language, string>> = {
  melodic: { en: 'Melodic', ru: 'Мелодия' },
  thock: { en: 'Thock', ru: 'Thock' },
  clicky: { en: 'Clicky', ru: 'Clicky' }
};

// Every setting in one place, grouped by what it touches. The status strip
// keeps only the wallet, the account and this dialog's button.
export default function PlaySettings({ value, language, onChange, onClose, skillStackAnchor, onToggleSkillStack }: {
  value: PlayPreferences; language: Language; onChange: (p: PlayPreferences) => void; onClose: () => void;
  skillStackAnchor?: SkillStackAnchor; onToggleSkillStack?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const ru = language === 'ru';
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  const [sfxVol, setSfxVol] = useState(() => Math.round(audioEngine.getSoundVolume() * 100));
  const [musicVol, setMusicVol] = useState(() => Math.round(audioEngine.getMusicVolume() * 100));
  const [soundOn, setSoundOn] = useState(() => audioEngine.isSoundEnabled());
  const [musicOn, setMusicOn] = useState(() => audioEngine.isMusicEnabled());
  const [switchProfile, setSwitchProfile] = useState<SwitchProfile>(() => audioEngine.getSwitchProfile());
  const remap = (skill: keyof PlayPreferences['keys'], key: SkillKey) => {
    const keys = { ...value.keys };
    const occupied = (Object.keys(keys) as Array<keyof typeof keys>).find(k => keys[k] === key);
    if (occupied) keys[occupied] = keys[skill];
    keys[skill] = key;
    onChange({ ...value, keys });
  };
  const title = ru ? 'Настройки' : 'Settings';
  return <dialog ref={dialog} className="play-settings" onCancel={onClose} aria-labelledby="play-settings-title">
    <h2 id="play-settings-title">{title}</h2>

    <h3 className="play-settings-section">{ru ? 'Звук' : 'Sound'}</h3>
    <label><input type="checkbox" checked={soundOn} onChange={() => { audioEngine.unlock(); setSoundOn(audioEngine.toggleSound()); }} /> {ru ? 'Звуки клавиш' : 'Key sounds'}</label>
    <label>{ru ? 'Свитчи' : 'Switches'}
      <select value={switchProfile} onChange={e => { audioEngine.unlock(); setSwitchProfile(audioEngine.setSwitchProfile(e.target.value as SwitchProfile)); }}>
        {SWITCH_PROFILES.map(profile => <option key={profile} value={profile}>{SWITCH_LABELS[profile][language]}</option>)}
      </select>
    </label>
    <label>{ru ? 'Громкость звуков' : 'Sound volume'}
      <input type="range" min={0} max={100} value={sfxVol}
        onChange={e => { const v = Number(e.target.value); setSfxVol(v); audioEngine.setSoundVolume(v / 100); }}
        onPointerUp={() => audioEngine.keyHit(0)} onKeyUp={() => audioEngine.keyHit(0)} />
    </label>
    <label><input type="checkbox" checked={musicOn} onChange={() => { audioEngine.unlock(); setMusicOn(audioEngine.toggleMusic()); }} /> {ru ? 'Музыка' : 'Music'}</label>
    <label>{ru ? 'Громкость музыки' : 'Music volume'}
      <input type="range" min={0} max={100} value={musicVol}
        onChange={e => { const v = Number(e.target.value); setMusicVol(v); audioEngine.setMusicVolume(v / 100); }} />
    </label>

    <h3 className="play-settings-section">{ru ? 'Чтение' : 'Reading'}</h3>
    <label><input type="checkbox" checked={value.clearText} onChange={e => onChange({ ...value, clearText: e.target.checked })} /> {ru ? 'Чёткий текст без курсива' : 'Clear text without italics'}</label>
    <label>{ru ? 'Размер текста' : 'Text size'} <select value={value.textSize} onChange={e => onChange({ ...value, textSize: Number(e.target.value) as PlayPreferences['textSize'] })}>
      {[20, 24, 28].map(n => <option key={n} value={n}>{n} px</option>)}
    </select></label>
    <label><input type="checkbox" checked={value.reducedMotion} onChange={e => onChange({ ...value, reducedMotion: e.target.checked })} /> {ru ? 'Уменьшить движение и вспышки' : 'Reduce motion and flashes'}</label>

    <h3 className="play-settings-section">{ru ? 'Игра' : 'Play'}</h3>
    <label><input type="checkbox" checked={!value.timedDecisions} onChange={e => onChange({ ...value, timedDecisions: !e.target.checked })} /> {ru ? 'Решения без таймера' : 'Choices without a timer'}</label>
    {onToggleSkillStack && <label><input type="checkbox" checked={skillStackAnchor === 'corner'} onChange={onToggleSkillStack} /> {ru ? 'Навыки в углу, а не у курсора' : 'Skills in the corner, not at the cursor'}</label>}
    <label>{ru ? 'Цель следующего сюжета' : 'Next story goal'}<select value={value.campaignGoal} onChange={e => onChange({ ...value, campaignGoal: e.target.value as CampaignGoal })}>{(Object.keys(GOAL_COPY) as CampaignGoal[]).map(goal => <option value={goal} key={goal}>{GOAL_COPY[goal][language]}</option>)}</select></label>

    <h3 className="play-settings-section">{ru ? 'Клавиши' : 'Keys'}</h3>
    {(Object.keys(value.keys) as Array<keyof PlayPreferences['keys']>).map(skill => <label key={skill}>{skill === 'focus' ? (ru ? 'Фокус' : 'Focus') : skill === 'firewall' ? (ru ? 'Щит' : 'Firewall') : (ru ? 'Сброс следа' : 'Purge trace')}
      <select value={value.keys[skill]} onChange={e => remap(skill, e.target.value as SkillKey)}>{SKILL_KEYS.map(key => <option key={key} value={key}>{keyLabel(key)}</option>)}</select>
    </label>)}
    <p>{ru ? 'По умолчанию Tab включает Фокус; переназначь его, чтобы Tab переключал элементы. Совпадающие клавиши меняются местами. Настройки сохраняются на этом устройстве.' : 'Tab triggers Focus by default; reassign it to use Tab for moving between controls. Assigning an occupied key swaps the two skills. Preferences are saved on this device.'}</p>
    <button type="button" className="btn-cyber" onClick={onClose}>{ru ? 'Готово' : 'Done'}</button>
  </dialog>;
}
