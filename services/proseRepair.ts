/**
 * PROSE REPAIR — the last gate before generated text becomes something a player
 * types character by character.
 *
 * Everywhere else a language model's output is read. Here it is *reproduced*: a
 * missing capital or a dropped full stop is not a cosmetic blemish, it is a
 * keystroke the player must copy. A typing trainer that asks you to type
 * ungrammatical English is training the wrong thing.
 *
 * The generator is asked for well-formed sentences and mostly obliges, but
 * "mostly" is not good enough when every failure lands directly under the
 * player's fingers. This repairs the mechanical defects that keep recurring —
 * lowercase openings, missing terminal punctuation, whole-line shouting — and
 * deliberately does nothing else. Grammar cannot be fixed by string surgery, so
 * this does not try.
 *
 * Drill lines (terminal commands, signal codes) are never passed through here:
 * `>> inject_key --silent 47A9` is correct exactly as written.
 */

const TERMINAL_PUNCTUATION = '.!?…';

/** Closing quotes and brackets that may legitimately follow terminal punctuation. */
const CLOSERS = '"\'»”’)]';

const isLetter = (character: string) => /\p{Letter}/u.test(character);

/**
 * A line is "shouting" only when essentially all of its letters are uppercase.
 * Checking the whole line rather than individual words leaves acronyms and
 * proper nouns — ICE, ARASAKA — alone.
 */
const isShouting = (text: string): boolean => {
  const letters = [...text].filter(isLetter);
  if (letters.length < 8) return false;
  return letters.every((character) => character === character.toUpperCase());
};

const sentenceCase = (text: string): string => {
  const lowered = text.toLowerCase();
  // Reopen each sentence after terminal punctuation, so shouting collapses into
  // readable prose rather than one long lowercase run.
  let shouldCapitalise = true;
  return [...lowered].map((character) => {
    if (shouldCapitalise && isLetter(character)) {
      shouldCapitalise = false;
      return character.toUpperCase();
    }
    if (TERMINAL_PUNCTUATION.includes(character)) shouldCapitalise = true;
    return character;
  }).join('');
};

const capitaliseOpening = (text: string): string => {
  // Skip leading quotes and dashes so dialogue keeps its opening mark.
  const index = [...text].findIndex(isLetter);
  if (index < 0) return text;
  const characters = [...text];
  characters[index] = characters[index].toUpperCase();
  return characters.join('');
};

const hasTerminalPunctuation = (text: string): boolean => {
  const characters = [...text.trimEnd()];
  for (let i = characters.length - 1; i >= 0; i -= 1) {
    const character = characters[i];
    if (CLOSERS.includes(character)) continue;
    return TERMINAL_PUNCTUATION.includes(character);
  }
  return false;
};

const addTerminalPunctuation = (text: string): string => {
  const characters = [...text];
  // Place the full stop inside any trailing closers, where it belongs.
  let insertAt = characters.length;
  while (insertAt > 0 && CLOSERS.includes(characters[insertAt - 1])) insertAt -= 1;
  characters.splice(insertAt, 0, '.');
  return characters.join('');
};

/**
 * Repairs one line of generated prose. Whitespace is normalised, a stray space
 * before punctuation is closed up, whole-line shouting is brought back to
 * sentence case, the opening letter is capitalised, and a missing full stop is
 * supplied inside any closing quote.
 */
export const repairProseLine = (text: string): string => {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (!collapsed) return collapsed;

  const despaced = collapsed.replace(/\s+([,.!?;:…])/g, '$1');
  const unshouted = isShouting(despaced) ? sentenceCase(despaced) : despaced;
  const opened = capitaliseOpening(unshouted);
  return hasTerminalPunctuation(opened) ? opened : addTerminalPunctuation(opened);
};

/**
 * Whether a segment type is prose a player reads as a sentence, as opposed to a
 * drill whose exact characters are the point.
 */
export const isProseSegmentType = (type: string): boolean => (
  type === 'NARRATIVE' || type === 'DIALOG'
);
