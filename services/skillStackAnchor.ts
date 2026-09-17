export const SKILL_STACK_ANCHOR_KEY = 'typomancerSkillStackAnchor';
export type SkillStackAnchor = 'caret' | 'corner';

export const readSkillStackAnchor = (storage?: Pick<Storage, 'getItem'> | null): SkillStackAnchor => {
  try {
    return storage?.getItem(SKILL_STACK_ANCHOR_KEY) === 'corner' ? 'corner' : 'caret';
  } catch {
    return 'caret';
  }
};

export const writeSkillStackAnchor = (anchor: SkillStackAnchor, storage?: Pick<Storage, 'setItem'> | null): void => {
  try {
    storage?.setItem(SKILL_STACK_ANCHOR_KEY, anchor);
  } catch {
    /* private mode */
  }
};

export const toggleSkillStackAnchor = (current: SkillStackAnchor): SkillStackAnchor => (
  current === 'caret' ? 'corner' : 'caret'
);
