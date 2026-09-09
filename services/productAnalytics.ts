export const ANALYTICS_STORAGE_KEY = 'typomancerAnonymousAnalytics';
export const ANALYTICS_VERSION = 1;

export type DeviceClass = 'mobile' | 'tablet' | 'desktop';
export type ProductEventName =
  | 'typomancer_landing_viewed'
  | 'typomancer_calibration_started'
  | 'typomancer_calibration_completed'
  | 'typomancer_run_started'
  | 'typomancer_first_segment_completed'
  | 'typomancer_skill_became_ready'
  | 'typomancer_skill_used'
  | 'typomancer_run_completed'
  | 'typomancer_debrief_viewed'
  | 'typomancer_drill_started'
  | 'typomancer_drill_completed'
  | 'typomancer_challenge_opened'
  | 'typomancer_challenge_shared';

export interface CampaignAttribution {
  source: string;
  medium: string;
  campaign: string;
  challenge: boolean;
}

interface AnalyticsIdentity {
  version: 1;
  anonymousId: string;
  firstTouch: CampaignAttribution;
  firstSeenAt: string;
}

export type SafeEventProperty = string | number | boolean;
export type SafeEventProperties = Record<string, SafeEventProperty | undefined>;

interface AnalyticsRuntime {
  storage?: Storage;
  search?: string;
  fetch?: typeof fetch;
  projectToken?: string;
  host?: string;
  now?: () => Date;
  randomId?: () => string;
}

const EMPTY_ATTRIBUTION: CampaignAttribution = {
  source: 'direct',
  medium: 'none',
  campaign: 'none',
  challenge: false
};

const COMMON_PROPERTIES = [
  'language',
  'device_class',
  'source',
  'medium',
  'campaign',
  'challenge'
] as const;

const EVENT_PROPERTY_ALLOWLIST: Record<ProductEventName, readonly string[]> = {
  typomancer_landing_viewed: COMMON_PROPERTIES,
  typomancer_calibration_started: [...COMMON_PROPERTIES, 'recalibration'],
  typomancer_calibration_completed: [...COMMON_PROPERTIES, 'recalibration', 'skipped', 'wpm_bucket', 'accuracy_bucket', 'preset'],
  typomancer_run_started: [...COMMON_PROPERTIES, 'daily', 'genre', 'mission', 'preset', 'run_number', 'returning_player', 'resumed'],
  typomancer_first_segment_completed: [...COMMON_PROPERTIES, 'daily', 'genre', 'level', 'wpm_bucket', 'accuracy_bucket'],
  typomancer_skill_became_ready: [...COMMON_PROPERTIES, 'skill', 'level'],
  typomancer_skill_used: [...COMMON_PROPERTIES, 'skill', 'level'],
  typomancer_run_completed: [
    ...COMMON_PROPERTIES,
    'mission',
    'daily',
    'genre',
    'level',
    'outcome',
    'wpm_bucket',
    'accuracy_bucket',
    'consistency_bucket',
    'duration_bucket',
    'run_number'
  ],
  typomancer_debrief_viewed: [...COMMON_PROPERTIES, 'daily', 'outcome', 'focus', 'run_number'],
  typomancer_drill_started: [...COMMON_PROPERTIES, 'samples_bucket', 'weak_pattern_count'],
  typomancer_drill_completed: [...COMMON_PROPERTIES, 'wpm_bucket', 'accuracy_bucket', 'samples_bucket'],
  typomancer_challenge_opened: [...COMMON_PROPERTIES, 'daily_id_present', 'target_score_bucket'],
  typomancer_challenge_shared: [...COMMON_PROPERTIES, 'daily', 'outcome', 'target_score_bucket']
};

const truncateToken = (value: string, fallback: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:/-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return normalized || fallback;
};

const getStorage = (storage?: Storage): Storage | undefined => (
  storage || (typeof localStorage !== 'undefined' ? localStorage : undefined)
);

const defaultRandomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

export const getDeviceClass = (width: number): DeviceClass => {
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

export const getMetricBucket = (value: number, size = 10, max = 200): string => {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0;
  const lower = Math.floor(safe / size) * size;
  const upper = Math.min(max, lower + size - 1);
  return lower >= max ? `${max}-plus` : `${lower}-${upper}`;
};

export const getAccuracyBucket = (accuracy: number): string => {
  const safe = Number.isFinite(accuracy) ? Math.max(0, Math.min(100, accuracy)) : 0;
  if (safe < 90) return 'under-90';
  if (safe < 95) return '90-94';
  if (safe < 98) return '95-97';
  if (safe < 100) return '98-99';
  return '100';
};

export const getDurationBucket = (seconds: number): string => {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  if (safe < 60) return 'under-1m';
  if (safe < 180) return '1-3m';
  if (safe < 420) return '3-7m';
  if (safe < 900) return '7-15m';
  return '15m-plus';
};

export const parseCampaignAttribution = (search = ''): CampaignAttribution => {
  const params = new URLSearchParams(search);
  const challenge = params.has('challenge') || params.get('ref') === 'challenge';
  return {
    source: truncateToken(params.get('utm_source') || (challenge ? 'player-challenge' : ''), 'direct'),
    medium: truncateToken(params.get('utm_medium') || (challenge ? 'share' : ''), 'none'),
    campaign: truncateToken(params.get('utm_campaign') || (challenge ? 'daily-challenge' : ''), 'none'),
    challenge
  };
};

const normalizeIdentity = (value: unknown): AnalyticsIdentity | null => {
  if (!value || typeof value !== 'object') return null;
  const stored = value as Partial<AnalyticsIdentity>;
  if (
    stored.version !== ANALYTICS_VERSION
    || typeof stored.anonymousId !== 'string'
    || !stored.anonymousId.trim()
    || typeof stored.firstSeenAt !== 'string'
    || !stored.firstTouch
  ) return null;
  return {
    version: ANALYTICS_VERSION,
    anonymousId: stored.anonymousId.slice(0, 200),
    firstSeenAt: stored.firstSeenAt,
    firstTouch: {
      source: truncateToken(stored.firstTouch.source || '', 'direct'),
      medium: truncateToken(stored.firstTouch.medium || '', 'none'),
      campaign: truncateToken(stored.firstTouch.campaign || '', 'none'),
      challenge: stored.firstTouch.challenge === true
    }
  };
};

export const getAnalyticsIdentity = (runtime: AnalyticsRuntime = {}): AnalyticsIdentity => {
  const storage = getStorage(runtime.storage);
  try {
    const existing = storage?.getItem(ANALYTICS_STORAGE_KEY);
    const normalized = existing ? normalizeIdentity(JSON.parse(existing)) : null;
    if (normalized) return normalized;
  } catch {
    // A fresh anonymous identity is safe when storage is corrupt or restricted.
  }

  const now = (runtime.now || (() => new Date()))();
  const identity: AnalyticsIdentity = {
    version: ANALYTICS_VERSION,
    anonymousId: (runtime.randomId || defaultRandomId)().slice(0, 200),
    firstSeenAt: now.toISOString(),
    firstTouch: parseCampaignAttribution(runtime.search ?? (
      typeof location !== 'undefined' ? location.search : ''
    ))
  };
  try {
    storage?.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Analytics must never block the game.
  }
  return identity;
};

export const sanitizeEventProperties = (
  event: ProductEventName,
  properties: SafeEventProperties,
  attribution: CampaignAttribution = EMPTY_ATTRIBUTION
): Record<string, SafeEventProperty> => {
  const allowed = new Set(EVENT_PROPERTY_ALLOWLIST[event]);
  const merged: SafeEventProperties = {
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign,
    challenge: attribution.challenge,
    ...properties
  };
  const safe: Record<string, SafeEventProperty> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (!allowed.has(key) || value === undefined) continue;
    if (typeof value === 'boolean') safe[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === 'string') safe[key] = truncateToken(value, 'unknown');
  }
  return safe;
};

export const buildPostHogPayload = (
  projectToken: string,
  event: ProductEventName,
  identity: AnalyticsIdentity,
  properties: SafeEventProperties
) => ({
  api_key: projectToken,
  event,
  distinct_id: identity.anonymousId,
  properties: {
    $process_person_profile: false,
    ...sanitizeEventProperties(event, properties, identity.firstTouch)
  }
});

const getEnv = (): Record<string, string | undefined> => (
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {}
);

export const captureProductEvent = (
  event: ProductEventName,
  properties: SafeEventProperties = {},
  runtime: AnalyticsRuntime = {}
): void => {
  const env = getEnv();
  const projectToken = runtime.projectToken ?? env.VITE_POSTHOG_KEY;
  if (!projectToken) return;
  const host = (runtime.host ?? env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com').replace(/\/+$/, '');
  if (!/^https:\/\//.test(host)) return;
  const send = runtime.fetch ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!send) return;

  const identity = getAnalyticsIdentity(runtime);
  const payload = buildPostHogPayload(projectToken, event, identity, properties);
  void send(`${host}/i/v0/e/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
    credentials: 'omit'
  }).catch(() => {
    // Product analytics is best-effort and must never interrupt play.
  });
};
