# Model workbench — completed log

Standalone tool at `tools/model-workbench/` that generates character / NPC / weapon sprites. Work completed in session 15 (2026-03-27). All 22 backlog items done; final status: COMPLETE.

## Running it

```bash
cd tools/model-workbench
# Port 5180 (separate from the game's 5173).
```

## Architecture

- Registry singleton — models registered on import.
- Skeleton system — shared skeletons for animation.
- DrawCall pattern — each frame emits a list of DrawCalls (position, sprite, tint).
- Palette — shared colour palettes for body / skin / hair / armour.
- Attachment slots — weapon / shield / offhand anchored per-frame.

## Final model count

**72 models** shipped:

- **Bodies** — all variants (male / female / child / short / tall / heavy).
- **Hair** — all core styles (short / long / ponytail / bun / bald / styled).
- **Headgear** — hats, helmets, crowns, hoods.
- **Armour** — torso, legs, shoulders, gauntlets, boots (light / medium / heavy).
- **Weapons** — sword, axe, bow, staff, dagger, spear, hammer.
- **Off-hand** — shield, lantern, tome.
- **NPCs** — Witch, skeleton variants, imp variants, goblin variants, rabbit + king-rabbit.

## What changed since

- Feed into the DB-backed `npc_templates` table via `tools/seed-npc-templates.ts` (see `docs/history/db-migration-2026-04.md`).
- Sprite indexing still happens via the workbench; server stores `bodyColor` / `skinColor` per NPC template as hex strings.

## Post-completion TODOs

None tracked here — ongoing sprite work lives in the workbench tool's own README.
