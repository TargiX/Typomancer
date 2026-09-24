import type { Language, StoryGenreId } from '../types';

// Each world is played on its own keycap colourway. Ember is the house set:
// the menu, the meta screens and the cyberpunk campaign stay on it.
export type ColorwayId = 'ember' | 'abyss' | 'ribbon' | 'moss' | 'phosphor';

export const GENRE_COLORWAY: Record<StoryGenreId, ColorwayId> = {
  cyberpunk: 'ember',
  space_horror: 'abyss',
  noir: 'ribbon',
  dark_fable: 'moss',
  dead_channel: 'phosphor'
};

export const COLORWAY_NAMES: Record<ColorwayId, Record<Language, string>> = {
  ember: { en: 'Ember', ru: 'Уголь' },
  abyss: { en: 'Abyss', ru: 'Бездна' },
  ribbon: { en: 'Ribbon', ru: 'Лента' },
  moss: { en: 'Moss', ru: 'Мох' },
  phosphor: { en: 'Phosphor', ru: 'Люминофор' }
};

export const colorwayForGenre = (genre: StoryGenreId): ColorwayId => GENRE_COLORWAY[genre] ?? 'ember';
