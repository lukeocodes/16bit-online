# Server — index

Node.js + tsx (not Bun), Fastify on port 8000, PostgreSQL on 5433 via Drizzle, Redis on 6379.

## Supplemental docs

- [`docs/server-architecture.md`](docs/server-architecture.md) — boot order, file map, how to add NPCs / spawn points, position broadcast format.
- [`docs/data-policy.md`](docs/data-policy.md) — what belongs in the DB (everything queryable) vs in code (logic + images only).
- [`docs/binary-protocol.md`](docs/binary-protocol.md) — wire format + opcode table + "adding a new binary opcode" end-to-end.

## Run it

```bash
cd packages/server && node --watch --import tsx src/index.ts
```

## At-a-glance

- **Server owns the data.** Client fetches, server is source-of-truth. Adding a field = Drizzle migration → typed endpoint → client reads. Never put static data in `*.ts` files.
- **Authoritative game loop** at 20Hz — wander → combat → broadcast damage/death → broadcast state → broadcast positions.
- **Binary on reliable channel** for anything sent every tick (combat, state, XP). JSON for rare (chat, quests, zone change, inventory).
- **Unreliable channel** for positions only; batched 20 B per entity.
