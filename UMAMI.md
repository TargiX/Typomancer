# Website traffic

Prepared for self-hosted Umami at https://stats.phosphene.cc. Website ID: `1bb0c07e-4980-49d0-ae22-00c47dc9b746`. Production hosts: typomancer.xyz, www.typomancer.xyz.

Pageviews and the game's product events are sent. Static route names are allowlisted; all other routes become `/other`. Titles are a fixed product name. Referrers retain only their origin. Queries, hashes, user IDs, form values, journal content, resume content and replay are excluded.

Product events (`typomancer_*`) come from `services/productAnalytics.ts`, which sends the same allowlisted, bucketed properties it sends to PostHog. No anonymous ID, typed text or story text is included. `public/traffic.js` is the second gate: it accepts only `typomancer_` names and flat short values, and drops everything else. Recovery/token URLs skip tracker loading. Do Not Track and Global Privacy Control are respected. Localhost, native app origins and previews do not load the tracker.

Production activation requires a healthy HTTPS collector and verification of ingestion from the deployed site. This source change alone does not prove live tracking. Remove the loader and redeploy to disable; historical data stays on the server.

## Moving product analytics off PostHog

Events go to Umami and PostHog in parallel. Compare a week of the funnel (landing → run_started → first_segment_completed → run_completed → debrief_viewed) in both. If the counts agree, remove `VITE_POSTHOG_KEY` from Vercel and the PostHog call from `productAnalytics.ts`.

Umami groups events by its own session, not by the app's anonymous ID. Returning-player measures rely on the `returning_player` and `run_number` properties rather than on identity.
