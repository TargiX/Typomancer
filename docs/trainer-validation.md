# Trainer validation protocol

The implementation measures attempts, practice completion and return activity. These measurements do not establish learning, enjoyment, or retention by themselves.

## A bounded human playtest

Recruit 10–20 willing players across English and Russian, with both new and experienced typists. Recruitment and contact are a separate authorized action; no outreach is part of this change.

1. Record language, physical versus touch keyboard, prior typing practice, and accessibility preferences. Do not collect the contents of personal typing.
2. Ask the player to start unaided, read a line, make a deliberate correction, pause, resume, and reach a story choice. Observe whether they understand that the choice is untimed and what its consequences mean.
3. Finish one sector, read the debrief, and ask: “What would you practice next, and why?” Check whether the answer follows their actual target evidence.
4. Complete the five-minute practice. Record check/recheck raw accuracy, WPM, actual target attempts and errors, and chosen next action. Keep the immediate same-text change separate from skill transfer.
5. Invite an optional return at the scheduled interval. Use a new passage matched for language, length and target frequency, followed by the original controlled passage. This separates memorization from transfer.
6. Ask which moment was satisfying, confusing or frustrating, and whether the player wants another session. A completion click is not an enjoyment rating.

## Outcome definitions

- Activation: first completed sector **and** a player who can explain one measured next action. Report numerator and all starters, including abandoned attempts.
- Practice completion: completed check/practice/recheck divided by practice starts. Exclude synthetic QA and development origins.
- Return: distinct players returning to active typing on D1/D3/D7, in complete time windows; define the timezone and cohort before calculation.
- Target performance: errors / actual attempts, per target, language and exercise stage. Show exposure; fewer than eight attempts is insufficient for the practice milestone.
- Learning: delayed performance on unfamiliar matched text, including accuracy and WPM together. Report uncertainty and individual trajectories. Never infer this from XP, rewards, aggregate playtime, or a same-session recheck alone.
- Game quality: observed confusion at choices, pause/recovery problems, abandoned sectors, and voluntary replay with a different goal.

Existing anonymous event names cover practice starts/completions, first segment, run outcomes and skill use. Events carry allowed aggregate buckets, never typed passages or target tokens. The implementation and local automated test data are not a live cohort. Live analytics, remote AI quality, signed-in device-to-device recovery and touch-keyboard training require their own validation.
