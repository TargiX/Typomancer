# Art direction: perks, upgrades, worlds

The UI is a keycap colourway: warm charcoal, cream legends, one accent per world.
The generated art predates it and is neon green. These prompts replace it.

- **Perks and upgrades are artisan keycaps.** One resin keycap per item, with a small scene sealed inside the resin. Artisan caps are what the keyboard hobby collects, so an item becomes a thing you own, not an icon.
- **Worlds are keyboards.** Each world is a mechanical keyboard in its colourway, lit by that world.

## Shared style block

Paste this in front of every prompt:

> Studio product photograph, single object centred, three-quarter view from slightly above. Dark warm charcoal background (#0e0d10) with a soft warm top light and a gentle floor shadow. Shallow depth of field, crisp focus on the object. Physical materials only: PBT plastic, cast resin, brushed aluminium, brass. Colour palette: charcoal, cream (#efe7d6), and one accent colour named in the prompt. No neon glow, no green unless named, no text, no letters, no logos, no watermark. Square 1:1.

Artisan keycap base, for perks and upgrades:

> A Cherry-profile artisan keycap cast in clear resin over a cream sculpted base. Inside the resin is a miniature diorama: {SCENE}. Accent colour: {ACCENT}.

## Perks (`public/assets/perks/<id>.png`)

Accent for all perks: orange (#ff6a2b).

| id | {SCENE} |
|---|---|
| `neural_buffer` | a tiny coiled spring cushioned in grey foam, one bead of light resting on it |
| `ghost_protocol` | a faint translucent figure walking through a wall of fog |
| `adrenaline_spike` | a single orange lightning bolt frozen mid-strike |
| `titanium_firewall` | a miniature riveted titanium shield standing in flame |
| `critical_override` | a small broken padlock with a key snapped inside it |
| `focus_lattice` | a crystal lattice of thin cream rods focusing one beam of light |
| `error_siphon` | a red droplet being drawn up a thin glass pipe into a tiny tank |
| `evidence_lens` | a brass magnifying lens over a stack of tiny paper files |

## Upgrades (`public/assets/upgrades/<id>.png`)

Accent for all upgrades: brass and cream. These are permanent, so they read as heavier metal pieces than perks.

| id | {SCENE} |
|---|---|
| `synapticWeave` | a woven heart of fine brass wire |
| `cryptoMiner` | a tiny stack of stamped brass coins with a miniature pickaxe |
| `signalDampener` | a small radio dish muffled under a thick felt cloth |
| `bufferExpansion` | a stepped tower of small glass capacitors, the top one full of amber light |
| `focusLens` | a thick convex lens in a brass ring, light pooling beneath it |
| `patternScanner` | a miniature punch card being read by a thin line of light |

## Worlds (`public/assets/worlds/<genre>.png`)

Prompt base:

> A compact 65% mechanical keyboard in the {COLOURWAY} colourway on a desk, low angle, keycaps in focus. The desk and background belong to {WORLD}. Accent keycaps (Escape, Enter, spacebar) in {ACCENT}; alphas in {ALPHAS}.

| file | {COLOURWAY} / {ACCENT} / {ALPHAS} | {WORLD} |
|---|---|---|
| `cyberpunk.png` | Ember / orange #ff6a2b / charcoal with cream legends | a rain-streaked window over a night city, wet reflections |
| `space_horror.png` | Abyss / teal #40c4c4 / dark navy with cream legends | a cramped station console, frost on the viewport, stars beyond |
| `noir.png` | Ribbon / typewriter red #e23c40 / cream with black legends | a detective's desk, venetian-blind shadows, cigarette smoke, an old typewriter behind |
| `dark_fable.png` | Moss / moss green #a4be5c / dark bark brown with cream legends | a forest cottage table, candle wax, dried herbs, an old book |
| `dead_channel.png` | Phosphor / CRT yellow-green #d4c848 / warm grey with cream legends | a night broadcast booth, CRT monitors glowing, reel-to-reel tape |

`dead_channel.png` does not exist yet; the Dead Channel card falls back to an icon until it is added.

## Delivery

- Generate at 1024×1024 and export PNG at 512×512. That is the size the current assets use.
- Keep the object's silhouette inside the central 80% of the frame. Cards crop the edges.
- Compare every set side by side before replacing files. One off-palette image breaks the whole grid.
