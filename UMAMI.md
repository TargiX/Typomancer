# Website traffic

Prepared for self-hosted Umami at https://stats.phosphene.cc. Website ID: `1bb0c07e-4980-49d0-ae22-00c47dc9b746`. Production hosts: typomancer.xyz, www.typomancer.xyz.

Only pageviews are sent. Static route names are allowlisted; all other routes become `/other`. Titles are a fixed product name. Referrers retain only their origin. Queries, hashes, user IDs, form values, journal content, resume content, custom events and replay are excluded. Recovery/token URLs skip tracker loading. Do Not Track and Global Privacy Control are respected. Localhost, native app origins and previews do not load the tracker.

Production activation requires a healthy HTTPS collector and verification of ingestion from the deployed site. This source change alone does not prove live tracking. Remove the loader and redeploy to disable; historical data stays on the server.
