/** Menu labels carry their key hint inline ("[1] INITIALIZE LINK"); strip it where a keycap is drawn instead. */
export const stripKeyHint = (label: string): string => label.replace(/^\[[^\]]+\]\s*/, '');
export const stripLeadingGlyph = (label: string): string => label.replace(/^[^\p{L}\p{N}]+/u, '');
