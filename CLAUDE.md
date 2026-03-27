# Isometric MMO Game

## Context Hygiene (IMPORTANT)
Keep API request size small. Context bloat causes failures. Follow these rules strictly:
- **Read files with offset+limit** — never read an entire large file. Read only the 20-50 lines you need.
- **Use grep/glob first** — find the exact line numbers, then read only that range.
- **Pipe bash output through `| tail -N` or `| head -N`** — never dump full command output. 5-15 lines is usually enough.
- **Don't echo file contents back** — after reading a file, note what you learned, don't quote it back.
- **Avoid redundant reads** — if you already read a section, don't re-read it. Take notes in your response.
- **Minimize screenshot frequency** — one screenshot to verify, not one per change.
- **Prefer Edit over Write** — sends only the diff, not the whole file.
- **Suppress noisy output** — `2>&1 | grep -v "warning" | tail -5` for builds/tests.
- **Update CLAUDE.game.md** instead of building up conversation context. Future sessions read the file, not the thread.

## Game State
- @CLAUDE.game.md — **Read first.** Development progress, current state, what to work on next. Update after significant work.

## Agent Guides
- @AGENTS.md — General guidelines, Playwright testing, architecture rules, common issues
- @AGENTS-SERVER.md — Server file map, adding NPCs/spawn points, protocol format
- @AGENTS-CLIENT.md — Client file map, PixiJS rendering, ECS patterns, UI screens
- @AGENTS-TESTING.md — Playwright automated testing strategy, combat test loop, multi-tab testing

## Project Structure
Bun workspace monorepo with three packages:
- `packages/client` — PixiJS v8 TypeScript client (Vite bundler)
- `packages/server` — Fastify TypeScript server (runs with Node via tsx; werift needs Node's UDP stack)
- `packages/shared` — Shared constants and protocol definitions (JSON)

## Commands

### Development
```bash
docker compose up -d                          # Start PostgreSQL + Redis
cd packages/server && node --watch --import tsx src/index.ts  # Start backend
cd packages/client && bunx --bun vite         # Start frontend with HMR
```

### Database
```bash
cd packages/server && bunx drizzle-kit push   # Push schema to DB
cd packages/server && bunx drizzle-kit generate  # Generate migration
cd packages/server && bunx drizzle-kit migrate   # Run migrations
```

## Architecture
- **Auth**: OAuth2 PKCE with id.dx.deepgram.com + dev login, game JWT for sessions
- **Networking**: WebRTC DataChannels via werift (unreliable for positions, reliable for events), HTTP POST for signaling
- **Database**: PostgreSQL via Drizzle ORM + Redis via ioredis
- **Client**: PixiJS v8 2D isometric rendering, ECS architecture, Tiled editor maps
- **Server**: Authoritative game loop (combat, NPCs, HP, state) at 20Hz
- **Protocol**: Binary (24-byte) for position updates, JSON for reliable messages

## Key Constants
- Chunk size: 32x32 tiles
- Entity load radius: 32 tiles
- Chunk load radius: 3 chunks
- Server tick rate: 20Hz
- Client tick rate: 20Hz
- Position send rate: 15Hz
- Docker PostgreSQL port: 5433 (local PG on 5432)

## Git
- Use conventional commits (see global CLAUDE.md)
- Never include Co-Authored-By for Claude
