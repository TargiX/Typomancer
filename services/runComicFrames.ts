import type { ComicFrame } from '../types.ts';

/**
 * Builds a visual run summary without repeating held shots.
 *
 * Gameplay intentionally keeps the same image on screen across several typed
 * sentences. The report should treat those sentences as one visual beat. When
 * at least one image exists, caption-only placeholders are omitted as well.
 */
export const selectRunComicFrames = (frames: ComicFrame[], max: number): ComicFrame[] => {
  if (max <= 0) return [];

  const usable = frames.filter((frame) => frame.caption.trim().length > 0);
  const framesWithImages = usable.filter((frame) => Boolean(frame.image));
  const candidates = framesWithImages.length > 0 ? framesWithImages : usable;
  const seenImages = new Set<string>();
  const unique = candidates.filter((frame) => {
    if (!frame.image) return true;
    if (seenImages.has(frame.image)) return false;
    seenImages.add(frame.image);
    return true;
  });

  if (unique.length <= max) return unique;
  if (max === 1) return [unique[0]];

  const picked: ComicFrame[] = [];
  const step = (unique.length - 1) / (max - 1);
  for (let index = 0; index < max; index += 1) {
    picked.push(unique[Math.round(index * step)]);
  }
  return picked;
};
