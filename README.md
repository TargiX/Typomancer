# Typomancer — Operation Black Ledger

[Play Typomancer](https://typomancer.xyz) · [Source](https://github.com/TargiX/Typomancer)

A consequence-driven RPG typing game. You play as Agent Nox, a field hacker trying to steal and publish the Black Ledger before a megacorp severs the link.

## What changed in this version

- **Full four-sector campaign loop** with a real win state and multiple endings.
- **Consequences beyond the current sentence:** typing performance and tactical choices change Heat (how hunted you are), Trust (who is still with you), Evidence (your proof, and the win condition), and Route.
- **You can see the fork:** lose the clean branch and the game quotes the line accurate typing would have earned you instead.
- **Strategic decisions:** each mid-level decision has visible tradeoffs. Loud routes gain more evidence and credits but raise Heat; stealth routes lower Heat and build Trust.
- **The Tracer:** the Security Trace runs along the line you are typing. A burn front eats the text behind your cursor at a pace set by your own calibration, so the gap between the front and your caret is your safety margin, drawn where you are already looking. Keep typing and it never reaches you; stall and it does. `PURGE` throws it back.
- **Accuracy is the weapon:** an unbroken clean streak slows the tracer and shoves it backwards at every combo tier. One typo hands the whole advantage back at once. Speed alone already outruns the trace, so this is the pressure that trains accuracy rather than haste.
- **Focus Mode:** charge it by typing correctly, then press `TAB` to pause trace pressure, soften mistakes, and double typing rewards for a short burst.
- **Typing variety:** narrative flow, terminal breach commands, signal/number drills, and dialogue/punctuation drills.
- **Adaptive first run:** a short keystroke calibration tunes trace pressure and mistake grace to the player's pace.
- **Operator Record:** the last 20 runs, WPM trend, accuracy, streak, and next training target stay locally on the device.
- **Targeted training:** weak keys and bigrams are learned locally from aggregate timing/error counts, then turned into repeatable drills. Typed text is never stored for training or sent to analytics.
- **Player challenges:** Daily Sector results can be shared as a same-sector score target.
- **Perk market expanded:** new run perks and permanent hardware upgrades support Focus Mode, evidence gain, breach rewards, and error recovery.
- **Local campaign fallback:** the game works without a Gemini key. If AI is unavailable, it uses handcrafted cyberpunk branches and procedural SVG scene art.

## Controls

- `1`, `2`, `3`: choose perks/upgrades/options where shown.
- `TAB`: activate Focus Mode when the Focus meter is full.
- `↑` / `↓`: activate Firewall or Purge when they appear beside the typing caret. Purge also throws the tracer back down the line.
- `4`: open Operator Record from the main menu.
- `ESC`: return from the Black Market.
- `SPACE` / `ENTER`: return to the menu after a win/loss.

## Run locally

Prerequisites: Node.js.

```bash
npm install
npm run dev
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
npm run build
```

The production build is generated in `dist/`.
