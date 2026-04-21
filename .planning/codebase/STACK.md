# Technology Stack

**Analysis Date:** 2026-03-19

## Languages

**Primary:**
- TypeScript 5.7 - Used across all packages (client, server, shared)

**Secondary:**
- JavaScript - Implicit through Node.js/Bun runtime

## Runtime

**Environment:**
- Node.js - Server runs with `node --watch --import tsx`
- Bun - Package manager and build tool for workspace

**Package Manager:**
- Bun - Workspace manager with monorepo support
- Lockfile: `bun.lock` (present)

## Frameworks

**Core:**
- Babylon.js 7.0 - 3D graphics engine for isometric client rendering
- Babylon.js Materials 7.0 - Materials library for visual effects
- Fastify 5.0 - HTTP server for game API and WebRTC signaling
- Drizzle ORM 0.38 - Type-safe database access layer for PostgreSQL

**Testing:**
- Not detected in current dependencies

**Build/Dev:**
- Vite 6.0 - Frontend bundler with HMR support
- tsx 4.21 - TypeScript execution for Node.js server
- Drizzle Kit 0.30 - Migration and schema management tool

## Key Dependencies

**Critical:**
- werift 0.22.9 - WebRTC implementation for peer-to-peer data channels
- postgres 3.4 - PostgreSQL client (used by Drizzle)
- ioredis 5.4 - Redis client for caching and session storage
- jsonwebtoken 9.0 - JWT generation and verification for game sessions

**Infrastructure:**
- @fastify/cors 10.0 - CORS middleware for Fastify
- dotenv 16.4 - Environment variable loading

## Configuration

**Environment:**
- Loaded via `dotenv` in `packages/server/src/config.ts`
- Configured per-environment via .env files (development: `.env`, example: `.env.example`)

**Key configs required:**
- `OAUTH_ISSUER` - OAuth2 provider endpoint (default: https://bsky.social)
- `OAUTH_CLIENT_ID` - OAuth2 application ID
- `OAUTH_REDIRECT_URI` - OAuth callback URL (default: http://localhost:5173/auth/callback)
- `DATABASE_URL` or individual PostgreSQL credentials (POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD)
- `REDIS_HOST`, `REDIS_PORT` - Redis connection details
- `SERVER_HOST`, `SERVER_PORT` - Game server binding (default: 0.0.0.0:8000)
- `JWT_SECRET` - Session token signing key
- `JWT_ALGORITHM` - JWT algorithm (default: HS256)
- `JWT_EXPIRY_HOURS` - Token expiration (default: 24)
- `VITE_API_URL` - Client API endpoint (default: http://localhost:8000)
- `VITE_WS_URL` - WebSocket URL (default: ws://localhost:8000)

**Build:**
- Client: `vite.config.ts` with chunk size warnings for Babylon.js (~1.4MB)
- Server: `tsconfig.json` targeting ES2022 with path aliases
- Database: `drizzle.config.ts` for PostgreSQL migrations

## Platform Requirements

**Development:**
- Node.js (for tsx server execution)
- Bun (for workspace management and client builds)
- Docker & Docker Compose (for PostgreSQL 16 and Redis 7)
- TypeScript 5.7+

**Production:**
- Node.js (server)
- PostgreSQL 16+ (game state, character data)
- Redis 7+ (caching, session management)
- Docker/Kubernetes (deployment target via docker-compose.yml)

## Build Outputs

**Client:**
- Vite SPA bundle to dist directory
- TypeScript compilation via tsc before bundle
- Manual chunking: Babylon.js split to separate chunk

**Server:**
- Bun build to `dist/` directory
- Node module ESM output
- No external bundling for runtime

---

*Stack analysis: 2026-03-19*
