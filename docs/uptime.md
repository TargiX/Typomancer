# External uptime monitoring

`infra/uptime/worker.ts` runs as the Cloudflare Worker `typomancer-uptime`,
independently of Hetzner. It has no public HTTP endpoint. Every five minutes it
checks the website HTML, backend `/health` (including a database query), and
same-origin auth/progress routes through Vercel. Anonymous progress must return
401; a redirect, incorrect JSON, timeout or wrong status is a failed check.

Each failed probe is retried after three seconds, with a 15-second timeout per
attempt. A persistent failure opens one incident and sends a DOWN email to the
owner. Subsequent failed checks update status without repeating the email. A
successful check sends RECOVERED. Delivery failures retain the incident and
retry next time with the same Resend idempotency key. KV is eventually
consistent: rare duplicate concurrent executions are not strictly serialized.

State lives in the dedicated `STATE` KV namespace under `status`: last check,
failed probe names, incident start and notification state. It contains no
account data, cookies or response bodies. Check it with:

```sh
pnpm dlx wrangler kv key get status --namespace-id 2cdd279cc2434ab7a590e770e2de108d --remote
```

Secrets `RESEND_API_KEY`, `ALERT_FROM`, and `ALERT_TO` are stored in Worker secrets.
The Resend key is dedicated to uptime and has sending-only permission. The
owner's secure local recovery directory contains the key and its revocation ID;
never commit these files. Deploy source with:

```sh
pnpm dlx wrangler deploy --config infra/uptime/wrangler.jsonc
```

Cron updates can take up to 15 minutes to propagate. This is one external
vantage point, not a multi-region SLA or proof of browser rendering/login.
Cloudflare or Resend outages can also prevent checks or delivery; there is no
independent monitor of this monitor. Check the KV timestamp and Worker logs
when investigating a missing alert. Routine healthy checks send no email.

References: [Cloudflare cron triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/),
[Resend API key permissions](https://resend.com/docs/api-reference/api-keys/create-api-key).
