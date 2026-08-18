# Trash Panda Terror

A Three.js backyard strategy game about feeding feral cats while outsmarting an increasingly savvy raccoon.

## Play it

**Live build:** https://hmarquardt.github.io/trashpandaterror/

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. No package installation, build, or bundler is required.

The loop: the game opens in **PROVISIONS** — a compact shop where you spend **Chow** earned last night on upgrades to the feeding station. Head out at dusk, drag bowls, barriers, and the sprinkler into place, then start the night. Feed the three cats while keeping Gary off the buffet. Dawn pays out Chow based on cats fed, food left in the bowls, raccoon theft, and startled cats, and spins a short headline about what went down.

During dusk, select a bowl, barrier, or sprinkler and click the lawn to place it; drag existing objects to reposition them. Start the night with the button or Space. Select the garden hose (H), then hold and aim on the yard to spray. Click a cat to survey its temperament (they eat at different paces, spook at different rates, and have distinct tolerances).

Gary adapts across nights: feed him a steady diet of sprinkler, hose, fence, or floodlight and he gets measurably smarter about it. Later nights bring earlier arrivals, fewer free rounds, and extra raid attempts.

## Controls

**Mouse**
- **Drag** — orbit the camera
- **Scroll** — zoom
- **Right-drag** — pan
- **Click a bowl / barrier / sprinkler** — select; drag it to move it (DUSK)
- **Click a cat** — inspect its temperament (DUSK)
- **Pick a build tool, then click the lawn** — place a defense (DUSK)
- **Hold with the garden hose** — aim and spray (NIGHT)

**Keyboard**
- `1` Inspect · `2` Food bowl · `3` Barrier · `4` Sprinkler · `H` Garden hose · `Space` Start night

For the full guide (objective, game flow, strategy), open the **? · HOW TO PLAY** control in the top-right corner.

The developer panel (backtick) can scrub the time of night, summon Gary, accelerate the simulation, add Chow, and **Reset save** (clears only Trash Panda Terror's own `localStorage` key).

## Architecture

Static native ES modules — no bundler, no build step, no package install. Three.js and OrbitControls are vendored under `vendor/three`; the UI fonts are vendored under `vendor/fonts`. There are no CDN references, no Google Fonts calls, and no external runtime dependencies. `index.html` ships an import map that resolves `three` and `three/addons/` to the local vendor files, and it also works when served from the `/trashpandaterror/` GitHub Pages subdirectory.

## Structure

- `src/world` — procedural backyard diorama and ambience
- `src/agents` — local-state cat and raccoon behavior (incl. Gary's multi-tactic adaptation memory)
- `src/objects` — food and deterrent affordances (bowls, anchored decks, barriers, sprinklers)
- `src/data` — extensible persistent animal definitions
- `src/systems` — progression, the Chow economy, upgrade catalog, rewards, and results headlines
- `src/ui` — HUD, event feedback, shop, and dawn report
- `src/Game.js` — lifecycle (PREP → DUSK → NIGHT → DAWN → RESULTS), interaction, persistence, orchestration
- `vendor/three` — Three.js 0.179.1 native ES modules and license
- `vendor/fonts` — locally hosted UI font files

The game is served directly as native browser ES modules. `index.html` provides the import map that resolves the clean `three` and `three/addons/` imports to the checked-in vendor files. Progress (cat trust, Gary's memory, Chow, night count, and purchased upgrades) persists in `localStorage`.
