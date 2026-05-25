# taskbox-backend

NestJS API for the TaskBox service-marketplace platform. Powers the admin panel at [`TaskBox-Admin`](../TaskBox-Admin) and future partner/customer mobile apps.

## Stack

- **NestJS 11** + TypeScript (strict)
- **PostgreSQL** on [Neon](https://neon.tech) (branched: `main`, `staging`)
- **Prisma 7** ORM with migrations
- **JWT auth** (access + rotating refresh) with `argon2` password hashing
- **Cloudflare R2** for file uploads (presigned URLs, S3-compatible)
- **Socket.io** for real-time dispatch and pipeline updates
- **BullMQ + Redis** for background jobs (commission deadlines, reminders)
- **Resend** for transactional email
- Deployed to **Railway** (or Fly.io)

## Quick start

```sh
cp .env.example .env       # fill in DATABASE_URL, JWT secrets, R2 keys, etc.
docker compose up -d       # local postgres on :55432, redis on :56379
pnpm install
pnpm prisma generate
pnpm prisma migrate dev    # apply migrations

# One-off bootstrap: upload the six demo category PNGs to R2 so the seed has images.
# Requires R2_* env vars including R2_PUBLIC_BASE_URL. Skip if R2 isn't configured —
# `pnpm prisma:seed` will still run, but Category.imageUrl rows will be unreachable.
pnpm tsx prisma/seed-category-images.ts

pnpm prisma:seed           # runs prisma db seed
pnpm start:dev             # http://localhost:3000  •  Swagger at /docs
```

To wipe local data: `docker compose down -v`.

Health endpoint: `GET /health` returns `{ status, info: { db: { status: "up" } } }`.

## Project layout

```
src/
├── main.ts                 — bootstrap, helmet, CORS, Swagger
├── app.module.ts           — root module, global guards/filters/interceptors
├── config/                 — env loader + Joi validation
├── prisma/                 — PrismaService (global)
├── common/                 — decorators, guards, filters, interceptors, DTOs
└── modules/                — feature modules (auth, bookings, dispatch, …)
prisma/
├── schema.prisma           — single source of truth
├── migrations/
└── seed.ts
```

## Phases

Build follows `/Users/admin/.claude/plans/database-postgresql-partitioned-hartmanis.md`:

- **Phase 0** Bootstrap, Prisma, Neon, health
- **Phase 1** Auth & staff users
- **Phase 2** Catalog & zones
- **Phase 3** Customers, partners, R2 storage
- **Phase 4** Verification pipeline + WebSocket
- **Phase 5** Bookings + auto-dispatch
- **Phase 6** Commissions + BullMQ
- **Phase 7** Reviews, promos, dashboard
- **Phase 8** Hardening + deploy
