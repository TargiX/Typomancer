# Typomancer — Operation Black Ledger

[Play Typomancer](https://typomancer.xyz) · [Source](https://github.com/TargiX/Typomancer)

A consequence-driven RPG typing game. You play as Agent Nox, a field hacker trying to steal and publish the Black Ledger before a megacorp severs the link.

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

- `1`, `2`, `3`: choose perks/upgrades/options where shown.
- `TAB`: activate Focus Mode when the Focus meter is full.
- `↑` / `↓`: activate Firewall or Purge when they appear beside the typing caret. Purge also throws the tracer back down the line.
- `4`: open Operator Record from the main menu.
- `ESC`: return from the Black Market.
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
