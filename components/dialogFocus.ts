import type { KeyboardEvent } from 'react';
/** Keep native Tab navigation inside the active modal. Escape belongs to its owner. */
export function keepDialogFocus(event: KeyboardEvent<HTMLElement>): void {
  if (event.key !== 'Tab') return;
  const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]');
  const first = controls[0];
  const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
}
