# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
# Development
pnpm start:dev          # watch mode, http://localhost:3000, Swagger at /docs
pnpm start:debug        # debug + watch

# Build & production
pnpm build              # nest build
pnpm start:prod         # node dist/main

# Testing
pnpm test               # all unit tests (jest, rootDir=src, *.spec.ts)
pnpm test:watch         # watch mode
pnpm test:cov           # with coverage report
pnpm test:e2e           # uses test/jest-e2e.json

# Single test file
pnpm test -- --testPathPattern=bookings.service

# Lint / format
pnpm lint               # eslint src + test
pnpm lint:fix
pnpm format             # prettier write

# Prisma
pnpm prisma:generate    # regenerate client after schema change
pnpm prisma:migrate     # prisma migrate dev (creates migration file)
pnpm prisma:deploy      # prisma migrate deploy (CI / prod)
pnpm prisma:studio      # GUI at localhost:5555
pnpm prisma:seed        # prisma db seed

# Local infra (postgres :55432, redis :56379)
docker compose up -d
docker compose down -v  # wipe volumes
```

## Architecture

**Stack:** NestJS 11 / TypeScript strict · PostgreSQL on Neon · Prisma 7 · JWT (access + rotating refresh) · Socket.io (`/realtime` namespace) · BullMQ + Redis · Cloudflare R2 · Resend email · Railway deploy.

### Global wiring (`app.module.ts`)

Every request passes through three global guards applied in order:

1. `JwtAuthGuard` — validates the access token; skip with `@Public()`
2. `RolesGuard` — checks `@Roles(Role.ADMIN)` / `@Roles(Role.EXAMINER)`
3. `ThrottlerGuard` — 120 req / 60 s per IP

`TransformInterceptor` wraps every successful response as `{ data, meta }`.  
`HttpExceptionFilter` normalises error shape.

### Prisma client

The generated client lives in `src/generated/prisma/` (output of `prisma generate`). Import types and enums from `../../prisma/client` (re-export barrel), not directly from `@prisma/client`. `PrismaModule` is global — inject `PrismaService` anywhere without re-importing the module.

### Feature modules (`src/modules/`)

| Module | Key behaviour |
|---|---|
| `auth` | JWT login, rotating refresh tokens (argon2, timing-safe OTP), forgot-password via Resend |
| `verification` | Applicant pipeline with explicit state machine in `state-machine.ts` |
| `bookings` | Booking lifecycle via `booking-state-machine.ts`; triggers auto-dispatch |
| `dispatch` | `DispatchService.dispatch()` — zone+category match → highest-rating partner; emits `EventEmitter2` events consumed by `DispatchGateway` |
| `realtime` | Single `/realtime` Socket.io namespace, two gateways (`DispatchGateway`, `VerificationGateway`); partner app calls `partner:identify` to join its room |
| `jobs` | BullMQ commission-deadline cron via `JobsModule` |
| `storage` | Cloudflare R2 presigned upload URLs |
| `catalog` | Categories → SubCategories → Services (3-level hierarchy) |
| `zones` | Geographic zones; partners are assigned zones via `PartnerZone` join table |

### State machines

Both state machines are pure functions — no framework coupling:

- `src/modules/bookings/booking-state-machine.ts` — `PENDING → AUTO_ASSIGNED / CONFIRMED → IN_PROGRESS → COMPLETED`; also `CANCELLED` from most states.
- `src/modules/verification/state-machine.ts` — `PENDING → DOCS_REVIEW → TEST_SCHEDULED → TEST_COMPLETED → FINAL_APPROVAL → APPROVED`; `REJECTED` exits from most states.

Always call `canTransition(from, to)` / `canBookingTransition(from, to)` before mutating status.

### Auto-dispatch algorithm

`DispatchService.dispatch()`:
1. Booking must be `PENDING` and `customerAddress.assignedZoneId` must be set (admin maps address → zone via the Daraz-style manual flow — no maps API).
2. Candidates: `verified=true`, `availability=true`, matching `categoryId`, with a `PartnerZone` row for that zone.
3. Ordered by `rating DESC, totalJobs DESC, createdAt ASC`; top candidate wins.
4. Assignment and `BookingStatusHistory` row written in a single `$transaction`.
5. Emits `DISPATCH_EVENTS.BOOKING_ASSIGNED` → `DispatchGateway` fans out to `admin:bookings` room and `partner:<id>` room.

### Auth flow

- Access token: 15 m (configurable via `JWT_ACCESS_TTL`).
- Refresh token: 30 d, stored as `argon2` hash, rotates on each use (`replacedById` chain).
- Forgot-password: 6-digit OTP hashed with argon2, expires in 15 min; always returns 200 to avoid email enumeration.

### Environment variables

Defined in `src/config/configuration.ts` and validated with Joi (`src/config/validation.ts`). Required groups: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `R2_*`, `REDIS_URL`, `RESEND_API_KEY`. `FRONTEND_ORIGIN` sets CORS (default `http://localhost:5173`).
