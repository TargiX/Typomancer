# The Last Relay

A short authored mission available directly from the main menu in English and Russian. It uses two seven-line sectors and the existing typing, trace, Focus, perk and checkpoint systems. The first sector starts without a genre or starter-perk selection. Between sectors, players can choose a perk or resume later.

## Dramatic structure

1. Mira is trapped behind a locked door. Nox can maintain her connection.
2. Completing the camera line cleanly leaves the service lift available. An imperfect result identifies Mira and forces a longer, higher-pressure maintenance-shaft escape.
3. The first decision spends the remaining power cell on either Mira's door or the full archive. Rescuing her raises the alarm but earns her help later. Taking the archive grants more evidence and leaves her trapped.
4. On the rooftop, the second decision publishes either the original archive or a redacted copy. Redaction protects Mira's identity but requires a longer verification line and adds trace.
5. A rescued Mira clears 18 trace once, after her cover line, and reduces the pressure of the final transmission.
6. The final line's accuracy determines whether verified evidence or only an unverified fragment reaches the receiver. Rescue and redaction determine the human cost of the ending.

## Implementation boundaries

`services/lastRelay.ts` owns the authored text, decisions, event effects and ending rules. The existing mission flags persist its version and events through checkpoints. `StorySegment.missionBeat` tags only the camera, cover and upload lines; event effects require the mission marker and are idempotent.

The engine resolves each next authored line **after** applying the completed line's event, avoiding a stale prefetched route. The line before each decision is settled before the choice opens so decision-reading time is excluded from typing speed. There is no AI text or image request in this mission; it uses the bundled cyberpunk artwork. Ordinary campaigns and Daily retain their existing generation paths.

The mission ends after sector two, including fragment outcomes. Reaching the debrief is recorded as `victory` under the existing run schema; the authored ending distinguishes publication from partial transmission. Do not interpret this event alone as successful publication.

## Playtest questions

Target roughly 5–8 minutes at an ordinary typing pace; duration has not yet been validated with human players.

- Can players explain why they used the lift or shaft?
- Do they understand what saving Mira buys, and what leaving her costs?
- Does redaction feel like a meaningful sacrifice rather than a mandatory answer?
- Can they recall Mira and one consequence without being prompted?
- Do they voluntarily start another run to try a different choice?

Automated coverage checks both languages, the combinations of camera result / rescue / redaction / upload result, checkpoint restoration, one-time support, and isolation from ordinary campaigns. Browser journeys cover complete missions, a damaged upload, a camera failure, and a resumed second sector. Human playtesting is still needed to judge tension, reading load and replay interest.
