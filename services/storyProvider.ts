/** Load the optional story provider only when a run requests it. */
export const generateStoryStart: typeof import('./geminiService')['generateStoryStart'] = (...args) => import('./geminiService').then(service => service.generateStoryStart(...args));
export const generateCharacterProfile: typeof import('./geminiService')['generateCharacterProfile'] = (...args) => import('./geminiService').then(service => service.generateCharacterProfile(...args));
export const generateLevelSummary: typeof import('./geminiService')['generateLevelSummary'] = (...args) => import('./geminiService').then(service => service.generateLevelSummary(...args));
export const generateNextLevelStart: typeof import('./geminiService')['generateNextLevelStart'] = (...args) => import('./geminiService').then(service => service.generateNextLevelStart(...args));
