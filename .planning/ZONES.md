# Zones, Ownership, and Data Location

Design note captured during ATProto/PDS architecture discussion. Forward-looking; not yet implemented.

## Core design assumptions

- **Always-online, coop-only.** No PVP. All play requires server.
- **No spatial continuity.** Zones are discrete UUIDs in the DB. Travel is teleport. There are no neighbour relationships, no contiguous world geometry.
- **Travel primitive = teleporter.** Overt (portal tile, menu) or diegetic (tunnel mouth, cave entrance, castle gate, dock/sailing). Mechanically identical under the hood.
- **Server is authoritative for everything that affects gameplay outcomes.** User's PDS is for identity + creations + async-mirrored backup of user-authored content.

## Zone taxonomy

### Server-authored zones (team content, DB-only, never on any PDS)

| Type | Notes |
|---|---|
| Starter areas | Onboarding, tutorial-shaped |
| Capital cities | One per race; hubs, shops, NPCs; teleport destination targets |
| Adventure areas | Overworld content; difficulty scales with time (server-tuned over months) |
| Dungeon / cave / battle instances | Procedurally or AI-generated map + encounter. Instanced per party. Party sizes: 5 / 10 / 15 / 20 |
| World boss battles | Can occur in any zone. Party sizes: 20 / 25 / 40 |
| Player-scheduled timed events | Hosted by players inside server-owned zones (borrowed venue). See event section below. |

All server zones: operator-owned data, lives in `zones` / `zone_contents` tables. Not mirrored anywhere else. Team continues authoring via the in-game builder or `tools/paint-map/`.

### Player-accessible procedural zones

- **Unclaimed state:** UUID generated on first visit. Server records generator seed + biome + generator version. No owner. Player can walk around, build nothing permanent.
- **Access triggers:** special item (shop-bought), OR high-level spell with expensive / RMT-gated reagents.
- **Claim prerequisite:** player must build a house inside the zone to save it as a home.
- **Home slots:**
  - Exactly one **primary home** per player (designated, used by "teleport home" action).
  - Unlimited **secondary homes** (any zone where they've built a house).
- **Exit tiles:**
  - Default destination: player's race's capital city.
  - After building a house in the zone: owner can reconfigure exit destination to any zone they own OR any capital they've personally visited.
  - If owner has never visited any capital: exit defaults to race's capital.

### Building rules inside player-owned zones

- Players buy world-builder tiles (economy gate — server-authoritative ledger).
- **Cannot change zone type** (biome: desert, tundra, forest, etc. — immutable attribute of the zone row).
- Decoration must be consistent with the biome — tile allowlist enforced server-side on every placement.
- Allowed within constraint: trees, walls, mazes, paths, interior layouts.
- **Unrestricted:** outdoor decoration, structures, lamps, and similar props that don't alter biome identity.

## Data ownership matrix (DB vs PDS)

Guiding rule: **authorship and cheatability determine location.**

- Things the **server decided** (stats, ownership, economy, combat outcomes) → server DB authoritative, never on PDS.
- Things the **user authored** (profile, decorations, messages, visit logs, event RSVPs) → user's PDS authoritative, server DB caches for query speed.
- Things the **user owns but server validated** (zone deed, event attendance) → server DB authoritative + server-signed record mirrored to user's PDS as portable proof.

### Server DB only (never touches any PDS)

| Data | Why |
|---|---|
| Server zones (starter / capital / adventure / instanced / boss) | Operator-owned, team-authored |
| Procedural zone generator seeds and parameters | Canonical rehydration source |
| Zone ownership table (UUID → owner DID) | Authoritative; PDS deed is proof, not source |
| UUID pool (unclaimed / reserved / owned / released) | Must be globally consistent |
| Biome / zone type immutable attribute | Server-enforced invariant |
| Tile allowlist per biome | Validation ruleset, not user data |
| Economy ledger (gold, purchases, RMT transactions) | Absolutely never on PDS |
| Inventory authoritative state | Cheatable, server-decided |
| Character stats, HP, level, progression | Cheatable |
| Party / raid composition (live session) | Ephemeral, server-managed |
| Live zone instance state (entities, spawned mobs, combat) | Realtime, 20Hz |
| Event schedule (authoritative record) | Server gates access at event time |
| Gift / message queue for offline zone owners | Server holds for delivery |
| List of "capitals visited by player X" | Progression data, server-observed |
| List of "zones owned by player X" | Authoritative ownership register |
| Spawn-point and NPC definitions (server zones) | Operator data |

### User PDS (authoritative for user-authored content; server indexes via AppView)

| Record type (lexicon TBD) | Contents |
|---|---|
| `online.16bit.actor.profile` | Character name, cosmetic appearance, bio, race choice |
| `online.16bit.actor.settings` | UI prefs, keybindings, accessibility, volume — syncs across devices |
| `online.16bit.zone.deed` | Server-signed grant: zoneUuid + owner DID + claimedAt + server signature |
| `online.16bit.zone.contents` | Async mirror of player's zone build state (tile overlay on top of generator seed, NOT the whole generated terrain) |
| `online.16bit.zone.home` | Which owned zones are designated homes; which is primary |
| `online.16bit.zone.exitConfig` | Player-configured exit destinations for their owned zones (only if destination is a zone they own or a capital they've visited — server validates) |
| `online.16bit.chat.message` | Async-persisted chat history (delivery is WebRTC, persistence is PDS) |
| `online.16bit.visit.log` | "I visited zone X on date Y" — permanent travel record |
| `online.16bit.gift.given` | "I left this gift for owner Z on date Y" |
| `online.16bit.gift.received` | "I received this from giver Z on date Y" (server-cosigned) |
| `online.16bit.event.scheduled` | Player-hosted event: zone UUID, time, host DID (server-cosigned) |
| `online.16bit.event.attended` | "I attended host's event on date Y" (server-cosigned attestation) |
| `online.16bit.pilgrimage.list` | Curated collection of zones ("10 gardens I loved") |
| `online.16bit.social.follow` | Friends / follows (or reuse `app.bsky.graph.follow` if appropriate) |
| `online.16bit.achievement.earned` | Server-computed, server-cosigned, user displays |

### Hybrid (server authoritative, mirrored to PDS for portability/backup)

| Data | Primary home | Mirror |
|---|---|---|
| Zone ownership | Server DB `zones.owner` | Deed record on owner's PDS, server-signed |
| Zone build state | Server DB `user_map_tiles` | Snapshot record on owner's PDS, debounced writes (≤ 1 per 5 min or per 50 edits) |
| Event attendance | Server DB `event_attendance` | Cosigned record on attendee's PDS |
| Achievements | Server computes | Record on earner's PDS |

## Rationale for the split

- **Server-authored zones never touch any PDS.** They're operator-owned. Putting them on user PDSes would make zero sense — no user authored them, no user can claim them, no user needs a portable copy.
- **Procedural zones become player-mirrored only after claim.** Before claim, no owner, no PDS involvement. After claim, the seed stays on server (canonical), player-added overlays async-mirror to their PDS.
- **Only the overlay goes to PDS, never the full generated terrain.** Generated terrain is reproducible from seed. The PDS snapshot only needs the *diff* the player created. This keeps record sizes small and respects PDS rate limits.
- **Biome immutability is server-side.** Even if a user forges a PDS record claiming they changed their zone biome, the server rejects it on validation. The PDS mirror cannot contradict the server DB on any authoritative attribute.
- **Exit tile configuration is validated on every change.** If a user tries to set an exit destination they don't legitimately have (zone they don't own, capital they never visited), server rejects. Even if they forge the PDS record, it's meaningless without server agreement.

## Emergent properties this architecture gives us

- **Disaster recovery via network of PDSes.** If the game's DB is catastrophically lost, zone ownership and player-authored zone content can be rehydrated from users' PDSes.
- **Portability.** A fork of the game (or a future successor) could re-ingest users' identity + creations by reading public PDS records.
- **Third-party apps for free.** External sites can build "map galleries", "recent visitor feeds", "event calendars", "creator showcases" from public PDS records, without permission or API keys.
- **GDPR-clean deletion.** Users self-custody their content. Account deletion = release server-side resources + let user delete their own PDS records.
- **Historical record survives owner absence.** Visit logs on visitors' PDSes persist even after zone owner deletes account. "I was there" is preserved by the witnesses, not the subject.

## Constraints and open questions

- **PDS rate limits.** Aggressive decorating could trigger many writes. Must batch / debounce snapshots. 5-minute / 50-edit threshold is a starting guess.
- **Write delegation model.** Game server writes zone snapshots on behalf of users (server has canonical state, user doesn't need to round-trip). Requires narrow OAuth scope: `repo:write:online.16bit.*` only. Users grant at login.
- **Server-cosigning mechanism.** Server holds a signing key, publishes its public key, signs grants/attestations embedded in user PDS records. Key rotation strategy TBD.
- **Lexicon namespace.** Tentative `online.16bit.*`. Real namespace will be finalised when lexicons are formalised.
- **Discovery layer.** Entirely carries the weight that geography would in a spatial game. Needs dedicated design: directory, search, tags, portals-as-links, feeds, invites, algorithmic surfacing. Not addressed in this document.
- **Instance scaling.** A popular zone (server or player) may need multi-instance sharding. Out of scope for this design note; flagged as future concern.
- **Home migration.** If a player's primary home zone is somehow invalidated (edge cases TBD), fallback to race's capital as home. Edge cases TBD.
- **Event visibility on server zones.** Server-owned zones that allow player-scheduled events need per-zone policy (e.g. "capital town square allows events with cooldown", "dungeon instance does not"). Policy stored in `zones.eventPolicy`.
