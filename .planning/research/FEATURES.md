# Feature Landscape: World & Exploration Systems

**Domain:** UO-style sandbox MMO world, exploration, and PvP flagging
**Researched:** 2026-03-19
**Confidence:** MEDIUM (training data only -- UO systems are extensively documented in fan resources, but no live verification performed)

## Table Stakes

Features users of a UO-inspired sandbox MMO expect. Missing any of these and the world feels hollow or broken.

### World Structure & Geography

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multi-continent world map | UO defined the genre with Britannia + Trammel + Ilshenar etc. Players expect distinct landmasses. A single flat plane is not an MMO world. | High | Three continents (Human/Elf/Dwarf) with ocean separation. Needs a macro-level world definition layer above existing chunk system. |
| Terrain biome classification | Every tile-based MMO has terrain types that affect gameplay and atmosphere. Grass, forest, mountain, swamp, desert, snow -- these define regions visually and mechanically. | Medium | Expand current 7 tile types significantly. Terrain classification is pre-set (deterministic), visual detail is procedural. |
| Water bodies (ocean, rivers, lakes) | Water separating continents and dividing landmasses is fundamental geography. Without it, continents are just labeled areas of one flat world. | Medium | Water tiles (id 4) already exist but only as cosmetic. Need impassable ocean, navigable rivers/coastlines, lake features. |
| Safe zones (cities/towns) | UO towns like Britain and Moonglow were essential safe harbors. Without safe zones, new players get killed immediately and quit. | Medium | Zone system exists but only has one hardcoded 8-radius town. Need a hierarchy: cities (large), towns (medium), settlements (small). |
| Movement blocking / collision | Mountains, water, walls must block player movement. Currently all tiles except water/void are walkable. | Low | TileRegistry has `walkable` boolean. Need elevation-based blocking (cliffs, steep mountains) and expanded tile type blocking. |
| Region entry notifications | When crossing into a new area, player needs to know. UO showed "Entering Britain" etc. Without this, the world has no sense of place. | Low | Client-side region detection + server region lookup. Display region name, discoverer info, and notes overlay. |
| Minimap / world map | Players need spatial orientation. UO's paper map and radar display were essential navigation tools. | Medium | MiniMap.ts already exists as a UI component. Needs terrain data feed, fog of war for undiscovered areas, and player position. |
| Day/night cycle | UO's day/night cycle created atmosphere and affected gameplay (visibility, monster spawns). Sandbox MMOs without time feel static. | Low | Client-side lighting changes on a server-synced timer. Purely atmospheric for now -- no gameplay effect needed initially. |

### Exploration & Discovery

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Procedural region seeding on first exploration | Core project vision. First explorer triggers permanent terrain detail generation within pre-classified biome bounds. This is the hook. | High | Server-authoritative seeding using deterministic PRNG (world seed + region coordinates). Stores result in PostgreSQL for all future loads. |
| Persistent discovered regions | Once seeded, a region stays that way forever. UO's world was persistent -- changes lasted. This is fundamental to the "your exploration matters" promise. | Medium | Region data stored in PostgreSQL. Redis caches hot regions. Chunk system loads from DB instead of local generation. |
| Region discoverer attribution | "Discovered by [PlayerName]" -- gives exploration real social weight. Without it, discovering a region has no lasting personal impact. | Low | Simple DB column: discoverer_character_id, discovered_at timestamp. |
| Procedural region names | Each region gets a generated name on discovery (e.g., "Whispering Hollow," "Thornfield Ridge"). UO named every area; nameless wilderness feels unfinished. | Low | Name generation from biome-weighted word lists. Server-side generation, stored permanently. Deterministic from seed so it is reproducible. |
| Wildlife encounters | Wilderness must have creatures. UO had deer, bears, mongbats, ettins everywhere. Empty wilderness is not wilderness -- it is a loading screen you walk through. | Medium | Extends existing spawn point system. Wildlife templates per biome (wolves in forests, scorpions in desert, etc.). Sleep optimization pattern already exists in NPC system. |
| Varying creature difficulty by distance | Areas farther from safe zones should be more dangerous. UO had this implicitly -- ettins near Covetous, rabbits near Britain. Players need danger escalation. | Low | Spawn point templates already support variable stats. Distance-from-nearest-safe-zone calculation determines tier of wildlife templates. |

### PvP & Safety Systems

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| PvP flagging system (criminal flag) | Core UO mechanic. Attacking a non-flagged player in the wilderness turns you "criminal" (grey). This is THE system that makes UO-style PvP work. Without it, PvP devolves into grief-fest or is disabled entirely. | Medium | Server-side flag state machine. Criminal flag has duration (2-5 minutes). Flagged players can be attacked freely by anyone without penalty. |
| Safe zone PvP enforcement | Cannot attack other players in towns/cities. UO's guard zones were inviolable. Without this, new player experience is destroyed. | Low | Extend existing `isInSafeZone()` check. Combat system rejects attack commands when attacker or target is in safe zone. Already have the zone infrastructure. |
| Murder count / long-term penalty | UO tracked total murders. Five murders = "murderer" (red name), permanent until worked off. This graduated system prevents casual griefing while allowing committed PvP. | Medium | Persistent murder count in character DB record. Red status visible to all players. Murderers are kill-on-sight by NPCs in towns. |
| Innocent/criminal/murderer visual indicators | Players MUST be able to tell who is dangerous at a glance. UO used blue (innocent), grey (criminal), red (murderer) name colors. This is load-bearing UI. | Low | Name color sent with entity data. Client renders name plates with appropriate color. Three-state enum: innocent, criminal, murderer. |
| Resurrection / death penalty | When killed, player needs a path back. UO had ghost form, resurrection shrines, and healers. Death must have cost but not be game-ending. | Medium | Ghost state, respawn at nearest safe zone (or shrine), stat/skill loss on death in PvP (mild -- this is a penalty, not a punishment). |

### Technical Foundation

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| World map data layer | The macro-level definition of where continents, oceans, biomes, and cities are. Everything else builds on this. Currently the game has no concept of world-level geography. | High | New data structure above chunks. A world heightmap + biome map + political map (faction territories). Could be a large image/binary blob interpreted at server startup. |
| Hierarchical spatial system | Continent > Region > Chunk > Tile. Current system only has Map > Chunk > Tile. The region layer is missing entirely and is needed for discovery, naming, notifications. | Medium | Region = collection of chunks with shared biome, name, discoverer, notes. Regions are defined at the world map level, not procedurally created. |
| Chunk data from server | Currently chunks generate terrain client-side locally. For server-authoritative seeding, chunk data MUST come from server. The protocol already defines CHUNK_REQUEST/CHUNK_DATA opcodes but they are not implemented. | High | Server generates/loads chunk tile data. Client requests chunks within load radius. Existing opcodes 10-13 in protocol.json already reserved for this. |
| Region-aware spawn system | Wildlife spawns should be driven by region biome, not hardcoded spawn points. The current spawn system is a single point near origin. | Medium | Region biome determines which wildlife templates are available. Spawn points created dynamically per region based on biome rules. Reuses existing SpawnPoint infrastructure. |

## Differentiators

Features that set this project apart. Not expected by default, but create competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Player notes on discovered regions | First explorer can leave a note visible to all future visitors. "Beware the wolves here" or "Rich iron veins to the north." Creates emergent social narrative. No mainstream MMO does this. | Low | Text field (120 chars) stored with region record. Shown on region entry. Could be updated by discoverer only, or allow community annotations later. |
| Cross-continent minority settlements | Small Elf outposts on the Human continent, Dwarf trading posts on Elf lands. Creates political texture and reason to explore other continents. UO did not have this -- it is an evolution of the faction concept. | Low | Just additional safe zones with different faction flags. Low implementation cost, high world-building value. Establishes inter-racial relationships before economic systems exist. |
| Progressive fog of war on world map | Players only see areas they (or their faction) have explored on the world map. Creates real discovery incentive. Most MMOs show the full map from day one. | Medium | Per-character discovered-regions bitmask. World map UI renders unknown areas as fog. Faction-shared discovery optional (e.g., all humans see what any human discovered). |
| Biome-specific ambient systems | Desert regions have heat shimmer, forests have denser shadow, swamps have fog particles. Not just tile colors -- atmospheric differentiation per biome. | Medium | Client-side particle systems and post-processing per biome type. Babylon.js supports this well with its particle system and shader pipeline. |
| Region reputation / danger rating | Regions track aggregate player death counts. Regions where many players die get a "dangerous" reputation visible to new explorers. Emergent difficulty information. | Low | Server tracks death events per region. Simple counter, displayed in region entry notification. "Thornfield Ridge -- 47 adventurers have fallen here." |
| Procedural points of interest | Within seeded regions, generate interesting landmarks: ruins, caves (entrance only, no interior), ancient trees, rock formations. Gives exploration visual payoff beyond flat terrain. | High | Extension of procedural seeding. POI templates per biome. Placed during region seeding, persisted permanently. Requires 3D model loading (or primitive mesh composition). |
| Territory control indicators | Faction banners, patrol NPCs, and visual markers showing which race controls an area. Not mechanical -- purely atmospheric to establish world identity. | Low | Cosmetic entities spawned in faction-controlled regions. Banners at settlement entrances, patrol NPCs that walk predefined routes near towns. |

## Anti-Features

Features to explicitly NOT build in this milestone. Including rationale to prevent scope creep.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Player housing / land claims | UO's most beloved AND most controversial feature. Requires stable world, economy, and anti-grief systems first. Building it now would be a 3-month detour. | Defer to dedicated housing milestone after economy exists. The region system can be designed to accommodate future housing plots. |
| Interior spaces / dungeons | Dungeons require separate map instances, loading transitions, pathfinding in enclosed spaces, and camera management changes for isometric view. Massive scope. | Focus on outdoor world. Caves and ruins are exterior landmarks only. Dungeon milestone comes after world is solid. |
| Naval travel / boats | Ocean exists to separate continents, but boat mechanics (movement on water, wind, pirates) is an entire subsystem. UO boats were beloved but complex. | Continents are separate starting zones. Ocean is impassable terrain. Ship travel can be added as a dedicated milestone after continents work. |
| NPC merchants / quest givers | Cities are safe zones with visual structures, but interactive NPCs (buying, selling, quests) require inventory, economy, and dialogue systems that do not exist yet. | Place cosmetic NPC entities in cities for atmosphere. Actual interaction deferred to economy milestone. |
| Skills affecting exploration | Cartography, tracking, detecting hidden -- UO had exploration-enhancing skills. These need the skill progression system which is out of scope. | Keep exploration skill-independent. All players discover equally. Skill system is a separate milestone. |
| Player-placed markers / waypoints | Custom map markers and waypoints are nice QoL but add client state management, sync complexity, and UI work that is not core to exploration. | Region discovery and notes serve the wayfinding purpose. Personal markers can be added in a QoL pass. |
| Resource nodes / gathering | Mining, lumberjacking, fishing -- UO's resource gathering gave exploration economic purpose. But this requires inventory and crafting systems first. | Regions can be tagged with resource richness metadata during seeding. Actual gathering deferred to economy milestone. Future-proof the data model. |
| Weather system | Rain, snow, storms affecting visibility or movement. Atmospheric but significant client-side work and no gameplay impact without skills/survival systems. | Day/night cycle is the atmospheric system for this milestone. Weather deferred. Region biome already implies climate. |
| Guard NPCs that kill criminals | UO had insta-kill town guards. Tempting to implement alongside PvP flagging, but requires NPC AI targeting of flagged players, town patrol routing, and combat system changes. | Safe zones simply prevent combat actions. No guard NPCs needed -- the mechanic is "you cannot attack here" not "guards will kill you." Simpler, equally effective. |
| Faction warfare / racial PvP | Racial economic competition is a future goal, but mechanical faction war (territory capture, faction scores) is a massive system requiring balanced armies, objectives, and rewards. | Three racial continents establish faction identity. Cross-continent settlements hint at tensions. Actual warfare deferred to faction milestone. |

## Feature Dependencies

```
World Map Data Layer
  |-> Continent Definition (ocean/land boundaries)
  |     |-> Biome Classification Map
  |     |     |-> Region Grid Definition
  |     |     |     |-> Region Entry Notifications
  |     |     |     |-> Procedural Region Names
  |     |     |     |-> Player Notes on Regions
  |     |     |     |-> Region Discoverer Attribution
  |     |     |     |-> Progressive Fog of War (differentiator)
  |     |     |     |-> Region Reputation / Danger Rating (differentiator)
  |     |     |
  |     |     |-> Terrain Tile Type Expansion
  |     |     |     |-> Movement Blocking (elevation, water)
  |     |     |
  |     |     |-> Procedural Region Seeding
  |     |     |     |-> Persistent Discovered Regions (PostgreSQL)
  |     |     |     |-> Chunk Data from Server
  |     |     |     |-> Wildlife Spawn per Biome
  |     |     |     |     |-> Varying Creature Difficulty
  |     |     |     |-> Procedural Points of Interest (differentiator)
  |     |     |
  |     |     |-> Biome-Specific Ambient Systems (differentiator)
  |     |
  |     |-> Safe Zone Hierarchy (cities, towns, settlements)
  |           |-> Cross-Continent Minority Settlements (differentiator)
  |           |-> Territory Control Indicators (differentiator)
  |
  |-> Minimap / World Map (reads world map data)

PvP Flagging System (independent of world, depends on combat)
  |-> Criminal Flag (timer-based)
  |     |-> Safe Zone PvP Enforcement (uses existing zone system)
  |     |-> Innocent/Criminal/Murderer Visual Indicators
  |
  |-> Murder Count / Long-term Penalty
  |     |-> Murderer Status (red name)
  |
  |-> Resurrection / Death Penalty

Day/Night Cycle (independent, client-side + server time sync)
```

Key dependency observations:

1. **World map data layer is the critical path.** Nothing else can be built without knowing where continents, biomes, and regions are. This must be designed and implemented first.

2. **PvP flagging is independent of world generation.** It only needs the existing combat system and zone system. Can be built in parallel with world systems.

3. **Procedural seeding depends on biome classification.** The seeding algorithm needs to know what biome it is generating for -- forest chunks look different from desert chunks.

4. **Server-side chunk delivery is a prerequisite for persistent seeded regions.** Currently chunks generate client-side. This transport must change before seeded regions can work.

5. **Wildlife spawns depend on both region seeding and biome data.** Wildlife templates per biome can be defined early, but actual spawning depends on the region system existing.

## MVP Recommendation

### Must Build (ordered by dependency)

1. **World map data layer + continent definition** -- Everything else depends on this. Define the macro-level world: where land is, where ocean is, which continent is which, where biomes are.

2. **Expanded terrain types + biome system** -- Expand from 7 tile types to 15-20. Forest, mountain, swamp, desert, snow, deep water, shallow water, cliff, etc. Map biomes to terrain type palettes.

3. **Region grid + hierarchical spatial system** -- Define regions as collections of chunks. Each region has a biome, state (unexplored/explored), and metadata slots (name, discoverer, notes).

4. **Server-side chunk generation + delivery** -- Implement the CHUNK_REQUEST/CHUNK_DATA protocol. Server generates chunk data from biome classification when region is first explored, persists to PostgreSQL.

5. **Safe zone hierarchy** -- Convert the single hardcoded town into a data-driven system with cities, towns, and settlements placed on the world map. Different sizes, all enforce no-PvP.

6. **PvP flagging (criminal/murderer system)** -- Implement alongside world but independently. Criminal flag for attacking innocents, murder count for kills, visual indicators.

7. **Region discovery + names + notifications** -- When a player enters an unseeded region, seed it, generate name, attribute discoverer. Show entry notification to all future visitors.

8. **Wildlife per biome** -- Extend spawn point system to create biome-driven spawn points within seeded regions. Wolf packs in forests, scorpions in deserts, etc.

### Defer to Later in Milestone (if time allows)

- Player notes on discovered regions (low complexity, high value -- try to include)
- Progressive fog of war on world map
- Day/night cycle
- Minimap terrain data (minimap exists but needs world data feed)

### Defer to Future Milestones

- Procedural points of interest (needs 3D assets or mesh generation)
- Biome-specific ambient systems (nice-to-have, not essential)
- Region reputation / danger rating (needs more player population)
- Cross-continent minority settlements (needs faction identity work)
- Resurrection / death penalty refinement (basic respawn suffices initially)

## Implementation Complexity Estimates

| Feature | Effort | Risk | Notes |
|---------|--------|------|-------|
| World map data layer | 2-3 weeks | HIGH | Foundational. Design mistakes here cascade everywhere. Needs careful planning of data format, storage, and coordinate mapping to existing chunk system. |
| Terrain type expansion | 3-5 days | LOW | Mechanical work extending TileRegistry and Chunk rendering. Well-understood. |
| Region grid system | 1-2 weeks | MEDIUM | New concept layer. Design the region size (how many chunks per region), storage schema, and lookup APIs. |
| Server-side chunk delivery | 1-2 weeks | MEDIUM | Protocol opcodes already reserved. Main risk is performance -- chunk data must be compressed and cached in Redis to avoid DB hits on every chunk load. |
| Safe zone hierarchy | 3-5 days | LOW | Extending existing zone system. Data-driven placement on world map. |
| PvP flagging | 1 week | LOW | Well-understood state machine. Flag states, timers, combat system integration. The design from UO is battle-tested over 25 years. |
| Region discovery/names | 1 week | LOW | DB schema, name generator, client notification UI. Straightforward. |
| Wildlife per biome | 1 week | LOW | Extends existing spawn point system. Template data per biome. |

## Sources

- Training data on Ultima Online systems (UO Stratics, UOGuide, UO-related game design discussions). Confidence: MEDIUM -- these are well-documented systems but not verified against live sources in this session.
- Direct analysis of existing codebase (zones.ts, spawn-points.ts, ChunkManager.ts, TileRegistry.ts, protocol.json, constants.json). Confidence: HIGH -- read directly from source files.
- Game design patterns from sandbox MMO genre (Darkfall, Albion Online, EVE Online territory systems). Confidence: MEDIUM -- training data, well-established patterns.
