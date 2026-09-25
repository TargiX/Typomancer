# First player test

## Goal

Observe 5–10 first-time players before expanding missions or skill loadouts.
Then recruit toward 100 qualified players with source attribution. Keep game
and typing-practice cohorts separate, and never combine English/Russian typing
scores as evidence of improvement.

## Measurement readiness

The application emits allowlisted anonymous events for landing, run start,
first segment, run completion, debrief and practice. They go to self-hosted
Umami (stats.phosphene.cc, see UMAMI.md) and, during the migration, to PostHog
as well. On 2026-09-25 the production bundle carried a PostHog key. Verify
ingestion in Umami from the deployed site before recruiting.

Use `utm_source=observed-playtest`, `utm_medium=invite`, and
`utm_campaign=first-10-game` or `first-10-trainer` on invitation URLs. Internal
smoke runs use `utm_source=release-smoke` and must be excluded from every KPI.
Attribution is first-touch: use a fresh browser profile for synthetic checks.

Required event sequence: landing -> run_started -> first_segment_completed ->
run_completed -> debrief_viewed. A completed segment is the activation milestone
for the story cohort; calibration is optional and must not block that funnel.
For training, record calibration and at least one segment, then compare a
repeat calibration in the same language after five practice sessions.

`returning_player` means a stored previous run exists, not retention. Measure
returning play using the same anonymous distinct_id with run_started on a later
UTC date. Exclude `resumed=true` from new-run counts, distinguish Daily/story,
and report actual observation windows. Identity is browser-local and is not
merged across devices or account login; cleared storage creates a new identity.
The saved run list is capped, so run_number is not a lifetime session counter.
Analytics uses score buckets; use consenting participant measurements for
precise paired learning comparisons, not an invented precision from buckets.

No email, password, typed text, story text or auth token belongs in analytics.
Do not add session replay or identify calls as part of this experiment.

## Observe without coaching

1. Give the player the URL and ask them to try the short story.
2. Note whether they start, understand typing pressure and finish or stop.
3. Ask why Mira escaped through the lift or shaft, and what their choice cost.
4. Ask what the result screen says about their typing and whether they can find
   a useful drill. Do not point to the controls first.
5. Observe whether they choose another run themselves.
6. Invite an optional later session; distinguish voluntary return from a
   prompted test appointment.

Record anonymous participant code, cohort/language/device, source, start and
completion, first confusion, remembered consequence, drill discovery and
voluntary replay. Do not collect passwords or record typing without consent.
Recruitment and messages to participants require a separate explicit request.

## Decision gate

Review recordings/notes and the validated event funnel after the first 5–10
players. Fix recurring blockers before adding content. Then choose one next
experiment: another authored mission if narrative replay is promising, or the
training loop if players return for measurable practice. Counts from a small
observed sample are qualitative evidence, not population retention estimates.
