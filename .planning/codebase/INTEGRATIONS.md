# External Integrations

**Analysis Date:** 2026-03-19

## APIs & External Services

**Authentication (OAuth2 PKCE):**
- ATProto OAuth2 - User authentication and identity (bsky.social and federated PDSes)
  - SDK/Client: Custom fetch-based implementation in `packages/server/src/auth/oauth.ts`
  - Issuer URL: Configurable via `OAUTH_ISSUER` env var (default: https://bsky.social)
  - Flow: Authorization Code with PKCE
  - Endpoints:
    - Token exchange: `{issuer}/oauth2/token`
    - User info: `{issuer}/oauth2/userInfo`
  - Auth header: `Authorization: Bearer {accessToken}`

**Game Networking (WebRTC):**
- WebRTC DataChannels - Real-time game state synchronization
  - SDK: werift 0.22.9 (pure JavaScript WebRTC implementation)
  - STUN servers: stun.l.google.com:19302
  - Channels:
    - `position` - Unreliable, unordered (15Hz update rate, binary protocol)
    - `reliable` - Reliable, ordered (JSON protocol for combat/actions)
  - Signaling: HTTP POST via Fastify routes at `/api/rtc/offer` and `/api/rtc/answer`
  - Implementation: `packages/server/src/routes/rtc.ts`, `packages/client/src/net/NetworkManager.ts`

## Data Storage

**Databases:**

PostgreSQL 16:
- Connection: Configurable via `DATABASE_URL` or individual vars (POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD)
- Default: `postgresql://game:game_dev_password@localhost:5433/game`
- Client: Drizzle ORM via postgres.js driver
- Docker service: postgres:16-alpine
- Schema location: `packages/server/src/db/schema.ts`
- Tables:
  - `accounts` - OAuth user accounts with identity mapping (id, oauthSub, email, displayName, isOnboarded)
  - `characters` - Player characters (id, accountId, name, position, stats, skills)
  - `world_maps` - Map definitions (id, name, dimensions, z-levels)
  - `chunk_data` - Terrain chunks (mapId, coordinates, tile data, height data, static entities)

Redis 7:
- Connection: Host/port via `REDIS_HOST` (default: localhost), `REDIS_PORT` (default: 6379)
- Client: ioredis 5.4
- Docker service: redis:7-alpine
- Purpose: Session caching, temporary state (connection manager, lingering players)
- Implementation: `packages/server/src/db/redis.ts`

**File Storage:**
- Not detected - No S3, GCS, or file storage integration

**Caching:**
- Redis (via ioredis)

## Authentication & Identity

**Auth Provider:**
- ATProto OAuth2
  - Implementation: `packages/server/src/auth/oauth.ts`
  - PKCE support: Yes (code_verifier parameter)
  - Dev login: Supported (see auth routes)

**Session Management:**
- JWT tokens (HS256 algorithm)
- Token generation/verification: `packages/server/src/auth/jwt.ts`
- Expiry: Configurable via `JWT_EXPIRY_HOURS` (default: 24 hours)
- Signing secret: `JWT_SECRET` (must change in production)
- Bearer token in HTTP headers: `Authorization: Bearer {token}`
- Used by: Auth middleware in `packages/server/src/auth/middleware.ts`

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or error tracking service

**Logs:**
- Fastify built-in logging via `logger: true`
- Console logging for game events (WebRTC connections, entity spawns, combat)
- No external log aggregation detected

## CI/CD & Deployment

**Hosting:**
- Docker Compose (local development)
- Docker images: postgres:16-alpine, redis:7-alpine
- Production target: Docker/Kubernetes (inferred from docker-compose.yml)

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or other CI service configured

**Build Commands:**
```bash
# Client
npm run build  # TypeScript compilation + Vite bundling

# Server
npm run build  # Bun build to dist/

# Database
npm run db:push      # Push schema to PostgreSQL
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
```

## Environment Configuration

**Required env vars:**
- OAuth2: `OAUTH_ISSUER`, `OAUTH_CLIENT_ID`, `OAUTH_REDIRECT_URI`
- PostgreSQL: `DATABASE_URL` OR (`POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`)
- Redis: `REDIS_HOST`, `REDIS_PORT`
- Server: `SERVER_HOST`, `SERVER_PORT`, `JWT_SECRET`, `JWT_ALGORITHM`, `JWT_EXPIRY_HOURS`
- Client: `VITE_API_URL`, `VITE_WS_URL`

**Secrets location:**
- `.env` file (git-ignored in project)
- Example template: `.env.example`
- Loaded by: dotenv in `packages/server/src/config.ts`

## Webhooks & Callbacks

**Incoming:**
- `/api/auth/callback` - OAuth2 redirect endpoint (client-side handling)
- `/api/rtc/offer` - WebRTC offer creation (HTTP POST)
- `/api/rtc/answer` - WebRTC answer submission (HTTP POST)

**Outgoing:**
- OAuth2 token endpoint POST to `{OAUTH_ISSUER}/oauth2/token`
- OAuth2 userinfo endpoint GET to `{OAUTH_ISSUER}/oauth2/userInfo`
- No outbound webhooks detected

## API Routes

**Auth Routes:** `/api/auth`
- Implemented in `packages/server/src/routes/auth.ts`

**Character Routes:** `/api/characters`
- Implemented in `packages/server/src/routes/characters.ts`

**World Routes:** `/api/world`
- Implemented in `packages/server/src/routes/world.ts`

**RTC Routes:** `/api/rtc`
- `/offer` - POST, creates peer connection and WebRTC offer
- `/answer` - POST, accepts answer from client
- Implemented in `packages/server/src/routes/rtc.ts`

**CORS Policy:**
- Origin: http://localhost:5173 (development client)
- Credentials: true
- Configured in `packages/server/src/app.ts`

---

*Integration audit: 2026-03-19*
