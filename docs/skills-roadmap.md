# Active Skills — Roadmap

Three separate power layers. Don't merge them.

| Layer | When | Type | Resource | Example |
|---|---|---|---|---|
| **Perks** | mid-run (cards) | passive, random, 1 run | — | Ghost Protocol: slower trace |
| **Black Market** | between runs | passive, permanent, credits | credits | +Max HP, +credits |
| **Skills** (this doc) | **triggered in combat**, skill bar | active | **Energy** (the Focus charge) | Focus (TAB) |

Core idea: skills spend the shared **Energy** bar (right rail). Focus costs the whole bar;
cheaper skills cost a fraction — so Energy becomes a *choice*, and that choice is what
creates builds (which the passive layers alone never did).

## Phase 1 — SHIPPED (v1, "try it")
Goal: feel the Energy-spend loop with zero overload. Instant, one-click skills.
- **Focus** (slot 1, TAB, full Energy) — pause trace, soften mistakes, 2x rewards. *(existing)*
- **Firewall** (slot 2, ~40% Energy) — shield the next 3 mistakes (charges persist across
  segments, shown as `×N`).
- **Purge Trace** (slot 3, ~55% Energy) — instantly cut Security Trace by 25%. Panic button.
- Slot 4 locked (reserved).
Cost is shown as 1–3 dots under each icon; slot glows when affordable, dims when not.
Focus keeps its TAB hotkey; the others are click-to-use (letter hotkeys conflict with typing —
see Phase 3).

## Phase 2 — more skills + loadout
- New skills: **Evidence Surge** (next clean segment 2–3x evidence), **Stabilize** (freeze
  trace growth a few seconds — cheaper Focus), **Ghost** (trace can't rise for the next segment),
  **Rewind** (remove the last mistake — great in Perfectionist mode).
- **Loadout screen**: unlock skills permanently, equip up to 4 into the slots before a run.
  Suggested unlock path: a second **Black Market tab "PROGRAMS"** (fiction: buy hardware vs
  install software), or XP-mastery unlocks. Keep the current market tab for passive stats.
- Perks can buff a specific equipped skill (Focus Lattice already extends Focus — extend the
  pattern).

## Phase 3 — signature / "wow" skills + polish
- **Bend Fate** — force the next branch to the good path regardless of typing (1/run, expensive).
  Leans directly into the game's hook.
- **Foresight** — preview the next segment's consequence before typing it.
- **Time Dilation** — brief slow-mo skill-check (save it for the boss/climax).
- Hotkeys: assign F1–F4 (non-typing keys) so all skills are keyboardable without clashing with
  the typing input.

## Notes
- Energy = `overclockCharge` (0..`maxOverclock`). `Buffer Expansion` (market) raises the cap,
  so it now also = "more skill uses per run" — nice existing synergy.
- Costs live in `TypingEngine.tsx` (`skillCost`, `FIREWALL_COST`, `PURGE_COST`). Skill data is
  a small array in the skill-bar render — add a skill by pushing one entry + an `onUse` helper.
