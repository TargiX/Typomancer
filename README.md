# Typomancer — Operation Black Ledger

[Play Typomancer](https://typomancer.xyz) · [Source](https://github.com/TargiX/Typomancer)

A consequence-driven RPG typing game. You play as Agent Nox, a field hacker trying to steal and publish the Black Ledger before a megacorp severs the link.

## The Last Relay

**The Last Relay** is the prologue: a newcomer's **Play** (`1` or `ENTER`) starts it; afterwards it stays in the menu as "Prologue again". This authored two-sector mission begins immediately: Mira is trapped, the evidence is ready, and one transmitter remains online. Camera accuracy changes your escape route; rescuing Mira earns help at the relay; publishing her identity or redacting it changes the final verification and ending. English and Russian are supported. Local checkpoints preserve completed lines, choices, rewards and run conditions.

The mission uses authored text with no AI text requests; its scenes and comic pages still use generated art. See [mission design and playtest questions](docs/last-relay.md). The four-sector campaign remains available with `2`, and Daily with `3`.

## Practice and measurement

- Press `6` for five active minutes: a one-minute check, three minutes of targeted practice, and a one-minute recheck. The checks use the same passage order and language. New players can acquire a practice focus from their first check. Completed practice counts toward activity streaks.
- Accuracy counts every physical character attempt, including shielded mistakes and mistakes later corrected with Backspace. Shields still protect health and story rewards. WPM is characters / 5 divided by active minutes; combined results use total characters and time. The last keystroke stops the line clock, so generation waits do not lower speed.
- `Esc` pauses a story run. Losing window focus pauses story, calibration and practice clocks; resuming is explicit. Trace starts on the first character. Debriefs remain visible until the player chooses another action.
- Campaign and prologue checkpoints restart the unfinished line and preserve completed-line statistics, health, credits, skills, language, Pact and initial difficulty. Banking and later finishing update one run record. Checkpoints stay on the current device; account snapshots continue to exclude narrative text. Daily attempts and unfinished practice sessions are not resumable.
- Old history remains readable. New comparisons require measurement metadata and matching language, mode, genre, Pact and case/comfort settings; benchmark comparisons additionally require the same prompt. Recalibration excludes earlier runs from the adaptive baseline. A single-session improvement is not evidence of lasting learning.

## Training, return goals and accessibility

- Targeted practice progresses through patterns, words, and authored context. The checks retain their fixed text; changed corpora have a new prompt ID (`steady-transmission-v2`). Results show actual target attempts and errors.
- Recent diagnosis uses up to eight aggregate batches per pattern from the last 14 days. Lifetime totals remain available in storage. Half of the 64-pattern budget is reserved for supported weaknesses, so a rare difficult pair can survive frequent clean pairs. Missing key timing is shown as missing, never as zero milliseconds.
- A successful review requires at least eight actual attempts at 98% accuracy. Progress advances only on a later day after its due time, with 1/3/7-day revisit intervals. Repeated success is a practice milestone; durable skill transfer still needs a delayed test on unfamiliar text.
- The menu and sector debrief show a next practice action; the weekly table includes completed practice days. Speed summaries use matching language and run conditions. Controlled benchmark anchors and the first five completed runs per condition survive rolling history (up to 24 condition groups).
- Story goals are selected in Settings before the next run: **Story flow**, **Repair** (all characters must be corrected before sending), or **Codes** (seeded numerical transmissions between story beats). The goal is frozen in the checkpoint and comparison metadata. Offline authored context can contain the current target; each line shows target occurrences and offers practice when the story lacks exposure.
- Reading preferences include clear text without italics (off by default), 20/24/28px type, reduced animation/flash effects, untimed story choices, and skill key remapping. Focus defaults to `Tab`, which casts only from the typing line; on a control, Tab still navigates. Preferences are device-local; OS reduced-motion preferences remain supported.
- Story choices run on a 12-second fuse by default: the loud option fires at zero, and pause stops the fuse. "Choices without a timer" in Settings turns it off.
- With at least six measured key intervals, consistency uses variation in active inter-key timing (25–1200ms). Explicit pauses reset the interval clock. Old or insufficient samples retain the legacy line-pace estimate.

## Daily rules v2

Daily uses a UTC date, language-specific attempts and scores, a fixed 50-WPM pressure baseline, standard gear, and no personal Pact/comfort/XP advantage. The same seeded starter options are available to every player. Each language permits three starts per UTC day, including abandoned starts; completion updates the reserved attempt. Daily choices are untimed. A versioned share carries its language and rules; old or mismatched links are labeled informal and do not produce a competitive verdict. Scores and attempt limits are browser-local, not a server-authoritative leaderboard.

XP no longer secretly slows either trace. Explicit comfort settings, gear and skills remain visible campaign choices. The calibrated chase supports speeds through 300 WPM.

## What changed in this version

- **Full four-sector campaign loop** with a real win state and multiple endings.
- **Sectors have a shape:** an authored curve runs from a short opening line through a turning point to a long, maximum-pressure climax, instead of seven interchangeable beats. Escalation is authored rather than derived from Heat, so a clean run still feels the sector tighten.
- **Consequences beyond the current sentence:** typing performance and tactical choices change Heat (how hunted you are), Trust (who is still with you), Evidence (your proof, and the win condition), and Route.
- **You can see the fork:** lose the clean branch and the game quotes the line accurate typing would have earned you instead. Which branch you get is judged on accuracy against the length of the line, not a flat typo count, so a short line is not a free pass and the worst branch is actually reachable.
- **The debrief leads with accuracy**, not speed, and names the one thing to work on next.
- **Strategic decisions:** the mid-sector turning point shows what each option actually costs — every meter it moves, signed and coloured — before you commit, not after. Loud routes gain more evidence and credits but raise Heat; stealth routes lower Heat and build Trust.
- **The Tracer:** the Security Trace runs along the line you are typing. A burn front eats the text behind your cursor at a pace set by your own calibration, so the gap between the front and your caret is your safety margin, drawn where you are already looking. Keep typing and it never reaches you; stall and it does. `PURGE` throws it back.
- **Accuracy is the weapon:** an unbroken clean streak slows the tracer and shoves it backwards at every combo tier. One typo hands the whole advantage back at once. Speed alone already outruns the trace, so this is the pressure that trains accuracy rather than haste.
- **Focus Mode:** charge it by typing correctly, then press `TAB` to pause trace pressure, soften mistakes, and double typing rewards for a short burst.
- **Typing variety:** narrative flow, terminal breach commands, signal/number drills, and dialogue/punctuation drills.
- **Difficulty follows your hands:** the game measures you on your real runs and chases at a fraction of your *current* speed. A newcomer starts playing immediately — calibration is offered from Operator Record once they know what it tunes, not demanded as a typing test before the story. Getting faster makes the game faster with you instead of quietly retiring it.
- **Perks change how you play, never how much you may fail:** a clean streak buys stealth and shoves the trace back; a perfect line heals; a mistake can keep your streak alive if you pay Energy for it. No perk lowers what your fingers are asked to do.
- **Operator Telemetry:** the game measures the one reward that leaves with you. A stepped speed trace across every session, accuracy over the same span, and a Reflex Map showing the average delay before each key and pair lands — hesitation costs runs even when nothing is mistyped, and no other typing trainer shows you that beside your error rate. The menu leads with the headline: how much faster you are than when you started.
- **Operator Record:** the last 60 runs, WPM trend, accuracy, streak, and next training target stay locally on the device. Runs taken under a Pact are marked with what they demanded, so a hard-won clear reads as one.
- **The campaign is the drill:** weak keys and letter pairs are learned locally from aggregate timing/error counts, then seeded into the story the generator writes for you — so you practise what you actually fumble without leaving the mission. They also power standalone drills.

  Only the letters and letter pairs themselves (`q`, `th`, `br`, …) are sent, and only to the story generator, as a soft preference it is told to ignore when a sentence has no natural home for them. Typed text is never stored and never sent anywhere.
- **Player challenges:** Daily Sector results can be shared as a same-sector score target.
- **Perk market expanded:** new run perks and permanent hardware upgrades support Focus Mode, evidence gain, breach rewards, and error recovery.
- **The Pact:** opt into a harder run — a hot start, no forgiven typos, near-perfect accuracy for the clean branch, case sensitivity, a 35% faster trace — and it pays for itself in credits and XP, up to 2.25x. It is the one progression axis that raises the bar instead of lowering it, and it is where a fast typist goes once the ordinary run stops asking anything.
- **Comfort is priced, not free:** the chase has a floor it can never be shopped below, and permanent trace easing pays 25% fewer credits when fully invested. A calm build is a trade rather than a strictly better one — which matters in a game where the pressure is the training.
- **Local campaign fallback:** the game works without a Gemini key. If AI is unavailable, it uses handcrafted cyberpunk branches and procedural SVG scene art.

## Controls

- `1` / `ENTER` on the main menu: **Play** today's session. A newcomer gets the prologue. After that, Play starts the campaign straight away in a rotated world (the one played longest ago), with the starter perk that rewards the current focus, the weak pairs seeded into the text, and the focus measured again in the debrief ("Session focus: accuracy 94% → 97%").
- `2`: choose a world and starter perk by hand.
- `1`, `2`, `3`: choose perks/upgrades/options where shown.
- `TAB`: activate Focus Mode when the Focus meter is full. Skills can be remapped in Settings (for example to `F2`, freeing Tab for navigation).
- `↑` / `↓`: activate Firewall or Purge when they appear beside the typing caret. Purge also throws the tracer back down the line.
- `4`: open Black Market. `5`: open Operator Record. `6`: start five-minute practice.
- The status strip carries the wallet, account, **Settings** (sound, switches, reading, play and keys) and language.
- `ESC`: pause/resume play or return from the Black Market. Pause also offers settings and a return to the menu.
- `SPACE` / `ENTER`: return to the menu after a win/loss.

## Run locally

Prerequisites: Node.js and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev
```

Open the local Vite URL shown in the terminal.

## Optional AI setup

The game runs without AI, but you can enable Gemini text and image generation with a server-side environment variable:

```bash
GEMINI_API_KEY=your_key_here vercel dev
```

Do not use a `VITE_` prefix for secrets. Vite exposes `VITE_*` values to browser bundles. In production, set `GEMINI_API_KEY` on the Vercel project.

## Optional anonymous product analytics

To measure the landing-to-second-run funnel, set a public PostHog project token:

```bash
VITE_POSTHOG_KEY=your_public_project_token
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

Analytics is disabled when the token is absent. Events use a random local anonymous ID, do not create person profiles, and accept only allowlisted aggregate properties. Prompts, generated story text, and typed text are never included.

## Optional crash reporting

Set a public Sentry DSN to report unhandled render crashes:

```bash
VITE_SENTRY_DSN=your_public_dsn
```

Crash reporting is disabled when the DSN is absent, and the SDK is not bundled into the entry chunk — it is lazy-loaded only when configured. No PII or typed text is attached.

## Build

```bash
pnpm build
```

Unit tests and browser regression coverage:

```bash
pnpm test
pnpm test:e2e
```

The production build is generated in `dist/`.
