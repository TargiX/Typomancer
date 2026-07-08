# Narrative Flow — Operation Black Ledger

A consequence-driven RPG typing game. You play as Agent Nox, a field hacker trying to steal and publish the Black Ledger before a megacorp severs the link.

## What changed in this version

- **Full four-sector campaign loop** with a real win state and multiple endings.
- **Consequences beyond the current sentence:** typing performance and tactical choices now change Heat, Trust, Evidence, Corruption, Signal, and Route.
- **Strategic decisions:** each mid-level decision has visible tradeoffs. Loud routes gain more evidence and credits but raise Heat; stealth routes lower Heat and build Trust.
- **Focus Mode:** charge it by typing correctly, then press `TAB` to pause trace pressure, soften mistakes, and double typing rewards for a short burst.
- **Typing variety:** narrative flow, terminal breach commands, signal/number drills, and dialogue/punctuation drills.
- **Perk market expanded:** new run perks and permanent hardware upgrades support Focus Mode, evidence gain, breach rewards, and error recovery.
- **Local campaign fallback:** the game works without a Gemini key. If AI is unavailable, it uses handcrafted cyberpunk branches and procedural SVG scene art.

## Controls

- `1`, `2`, `3`: choose perks/upgrades/options where shown.
- `TAB`: activate Focus Mode when the Focus meter is full.
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

## Build

```bash
npm run build
```

The production build is generated in `dist/`.
