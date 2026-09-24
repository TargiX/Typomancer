// A hotkey sinks its on-screen cap ([data-hotkey]) first. Navigating actions
// run a beat later so the press is seen; reduced motion skips the beat.
const PRESS_MS = 110;
let pending = false;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Sinks the on-screen key for `hotkey`, if one is rendered. */
export const flashKey = (hotkey: string): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector<HTMLElement>(`[data-hotkey="${hotkey.toLowerCase()}"]`);
  if (!el) return null;
  el.setAttribute('data-pressed', 'true');
  window.setTimeout(() => el.removeAttribute('data-pressed'), PRESS_MS + 60);
  return el;
};

/** Sinks the key, then runs `action` once it has visibly bottomed out. */
export const pressThen = (hotkey: string, action: () => void) => {
  if (pending) return;
  const el = flashKey(hotkey);
  if (!el || prefersReducedMotion()) {
    action();
    return;
  }
  pending = true;
  window.setTimeout(() => {
    pending = false;
    action();
  }, PRESS_MS);
};
