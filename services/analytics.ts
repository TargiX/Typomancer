type PostHogClient = {
  capture?: (event: string, props?: Record<string, unknown>) => unknown;
};

declare global {
  interface Window {
    posthog?: PostHogClient;
  }
}

export const RUN_START = 'run_start' as const;
export const WORLD_SELECTED = 'world_selected' as const;
export const SEGMENT_COMPLETE = 'segment_complete' as const;
export const DECISION_MADE = 'decision_made' as const;
export const RUN_END = 'run_end' as const;
export const COMIC_OPEN = 'comic_open' as const;
export const COMIC_SHARE = 'comic_share' as const;
export const COMIC_DOWNLOAD = 'comic_download' as const;
export const COMIC_COPY = 'comic_copy' as const;
export const DAILY_ATTEMPT = 'daily_attempt' as const;

export const track = (event: string, props?: Record<string, unknown>): void => {
  try {
    if (typeof window === 'undefined') return;
    window.posthog?.capture?.(event, props);
  } catch {
    // Analytics must never interrupt game logic.
  }
};
