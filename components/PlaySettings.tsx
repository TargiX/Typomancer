import { GOAL_COPY, type CampaignGoal } from '../services/campaignTraining';
import React, { useEffect, useRef, useState } from 'react';
import type { Language } from '../types';
import { SKILL_KEYS, keyLabel, type PlayPreferences, type SkillKey } from '../services/playPreferences';
import { audioEngine } from '../services/audioEngine';

export default function PlaySettings({ value, language, onChange, onClose }: {
  value: PlayPreferences; language: Language; onChange: (p: PlayPreferences) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const ru = language === 'ru';
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  const [sfxVol, setSfxVol] = useState(() => Math.round(audioEngine.getSoundVolume() * 100));
  const [musicVol, setMusicVol] = useState(() => Math.round(audioEngine.getMusicVolume() * 100));
  const remap = (skill: keyof PlayPreferences['keys'], key: SkillKey) => {
    const keys = { ...value.keys };
    const occupied = (Object.keys(keys) as Array<keyof typeof keys>).find(k => keys[k] === key);
    if (occupied) keys[occupied] = keys[skill];
    keys[skill] = key;
    onChange({ ...value, keys });
  };
  return <dialog ref={dialog} className="play-settings" onCancel={onClose} aria-labelledby="play-settings-title">
    <h2 id="play-settings-title">{ru ? 'Чтение и управление' : 'Reading & controls'}</h2>
    <label><input type="checkbox" checked={value.clearText} onChange={e => onChange({ ...value, clearText: e.target.checked })} /> {ru ? 'Чёткий текст без курсива' : 'Clear text without italics'}</label>
    <label>{ru ? 'Размер текста' : 'Text size'} <select value={value.textSize} onChange={e => onChange({ ...value, textSize: Number(e.target.value) as PlayPreferences['textSize'] })}>
      {[20, 24, 28].map(n => <option key={n} value={n}>{n} px</option>)}
    </select></label>
    <label><input type="checkbox" checked={value.reducedMotion} onChange={e => onChange({ ...value, reducedMotion: e.target.checked })} /> {ru ? 'Уменьшить движение и вспышки' : 'Reduce motion and flashes'}</label>
    {(Object.keys(value.keys) as Array<keyof PlayPreferences['keys']>).map(skill => <label key={skill}>{skill === 'focus' ? (ru ? 'Фокус' : 'Focus') : skill === 'firewall' ? (ru ? 'Щит' : 'Firewall') : (ru ? 'Сброс следа' : 'Purge trace')}
      <select value={value.keys[skill]} onChange={e => remap(skill, e.target.value as SkillKey)}>{SKILL_KEYS.map(key => <option key={key} value={key}>{keyLabel(key)}</option>)}</select>
    </label>)}
    <label>{ru ? 'Цель следующего сюжета' : 'Next story goal'}<select value={value.campaignGoal} onChange={e => onChange({ ...value, campaignGoal: e.target.value as CampaignGoal })}>{(Object.keys(GOAL_COPY) as CampaignGoal[]).map(goal => <option value={goal} key={goal}>{GOAL_COPY[goal][language]}</option>)}</select></label>
    <label>{ru ? 'Громкость звуков' : 'Sound volume'}
      <input type="range" min={0} max={100} value={sfxVol}
        onChange={e => { const v = Number(e.target.value); setSfxVol(v); audioEngine.setSoundVolume(v / 100); }}
        onPointerUp={() => audioEngine.keyHit(0)} onKeyUp={() => audioEngine.keyHit(0)} />
    </label>
    <label>{ru ? 'Громкость музыки' : 'Music volume'}
      <input type="range" min={0} max={100} value={musicVol}
        onChange={e => { const v = Number(e.target.value); setMusicVol(v); audioEngine.setMusicVolume(v / 100); }} />
    </label>
    <p>{ru ? 'Tab перемещает фокус. Совпадающие клавиши меняются местами. Настройки сохраняются на этом устройстве.' : 'Tab moves focus. Assigning an occupied key swaps the two skills. Preferences are saved on this device.'}</p>
    <button type="button" className="btn-cyber" onClick={onClose}>{ru ? 'Готово' : 'Done'}</button>
  </dialog>;
}
