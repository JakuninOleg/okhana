# Okhana

> **AI is the architecture, not a feature.**  
> A family hub where Okhana (the home AI) remembers shared context, coordinates members, and executes actions — with privacy enforced in the database, not in the prompt.

[![CI](https://github.com/JakuninOleg/okhana/actions/workflows/ci.yml/badge.svg)](https://github.com/JakuninOleg/okhana/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Next.js](https://img.shields.io/badge/Next.js-16.2.10-000000?logo=next.js)
![License](https://img.shields.io/badge/license-MIT-green)

**Live**: [okhanahome.com](https://okhanahome.com)

---

## What it is

Families carry a huge mental load: where documents live, who must do what by when, birthdays, appointments, “surprises” that some members must not see.

Okhana is a **shared family space** plus an **agentic chat**:

- Durable knowledge (**notes**) with role- and person-level visibility
- Actionable work (**tasks / поручения**) with seen / done and push reminders
- **Calendar** events and recurring **memorable dates**
- An AI assistant that **creates and manages** those objects through tools — scoped to what the signed-in member is allowed to see

Core principle: *privacy filtering happens at the query level before any data reaches the model.*

---

## What’s shipped today

| Area | Status |
|---|---|
| Family create / join by invite code / roles (owner · adult · child) | ✅ |
| Member profiles, kinship labels (viewer-specific), leave / invite rotate | ✅ |
| Notes: create (chat), search, edit, privacy + `hiddenFrom`, delete via chat | ✅ |
| Tasks: create / list / update / cancel / mark seen / mark done (UI + chat) | ✅ |
| Calendar events (incl. addressed participants) | ✅ |
| Memorable dates + profile birthday nudges | ✅ |
| AI chat (Go-Ai gateway): streaming, tool calling, voice in / TTS (EN) | ✅ |
| Soft-launch chat quotas (per family / per user, Moscow day) | ✅ |
| PWA shell + Web Push (tasks, calendar, birthdays, daily briefings) | ✅ |
| i18n (`en` / `ru`), light/dark theme | ✅ |
| Marketing landing + Vercel Preview deploys per PR | ✅ |

### AI tools (in-app execution)

Notes: `remember_note`, `search_notes`, `update_note`, `update_note_privacy`, `delete_note`  
Tasks: `create_task`, `list_tasks`, `update_task`, `cancel_task`, `acknowledge_task`, `complete_task`  
Calendar / dates: `create_event`, `list_events`, `create_memorable_date`, `list_memorable_dates`

### Notifications (Web Push)

Native-style Russian lock-screen copy for new / seen / done tasks, calendar, notes, birthdays, and morning/evening briefings. Profile-birthday advance nudges and briefing lines **exclude the birthday person**. Cron-backed reminders for “mark seen” and approaching due dates.

---

## Differentiation

| Capability | Okhana | Typical family calendar apps |
|---|---|---|
| AI as orchestrator (tool-calling, not a bolt-on chat widget) | ✅ | Usually ❌ |
| Role-based + per-user note ACL | ✅ | Rare |
| Privacy at DB query time (model never sees forbidden rows) | ✅ | Prompt-only or none |
| Tasks with ack / done + push | ✅ | Partial |
| i18n (`ru` / `en`) | ✅ | Rare |
| Open source (MIT) | ✅ | ❌ |

**Not claimed (yet):** end-to-end encryption of note bodies, vector RAG / embeddings (search today is permission-filtered `ILIKE`), third-party maps.

---

## Privacy-first design

> We do not rely on “the model won’t tell.”

1. Member asks a question or triggers a tool.
2. Drizzle queries apply family tenancy + note visibility (`privacy_level`, `hidden_from`, role).
3. Only permitted rows reach the model / tool results.
4. Chat history is per-user; soft-deleted messages stay out of history reload.

Postgres **RLS is not enabled yet** — tenancy is enforced in application queries. See `.env.example`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                 Next.js 16 App Router                    │
│  Clerk auth · next-intl · PWA / service worker           │
│  features/* (family, notes, tasks, calendar, chat, AI)   │
│  API: /api/chat · /api/push · /api/cron · webhooks       │
└───────────────┬───────────────────────────┬──────────────┘
                │                           │
                ▼                           ▼
        Drizzle + Postgres            Go-Ai gateway
        (Supabase project             (chat / tools /
         `okhana`, shared)             voice / TTS)
```

Local, Vercel Preview, and Production all use the **same** Supabase project. Treat migrations and manual SQL as production operations.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.10 (App Router) |
| UI | React 19.2.4 · Tailwind CSS v4 · shadcn/ui |
| Language | TypeScript 5 (strict) |
| Auth | Clerk |
| i18n | next-intl 4.13.2 (`ru` / `en`) |
| Database | Supabase PostgreSQL · Drizzle ORM |
| AI | Go-Ai OpenAI-compatible gateway (server-only) |
| Push | Web Push (`web-push` + VAPID) |
| Testing | Vitest |
| CI/CD | GitHub Actions → Vercel |

---

## Project structure

```
okhana/
├── messages/                 # en.json · ru.json
├── drizzle/                  # SQL migrations (0000…0008+)
├── public/sw.js              # PWA shell + push handler
├── src/
│   ├── app/
│   │   ├── [locale]/        # marketing · dashboard · Clerk auth
│   │   └── api/
│   │       ├── chat/         # stream · history · speech · transcribe
│   │       ├── cron/         # advance-nudges · daily-briefing
│   │       ├── push/         # VAPID subscribe
│   │       ├── tasks/events  # SSE for live task strip
│   │       └── webhooks/clerk/
│   ├── features/             # domain modules (preferred home for product code)
│   │   ├── ai/ · chat/ · family/ · notes/ · tasks/
│   │   ├── calendar/ · notifications/ · marketing/
│   ├── components/ui/        # shadcn primitives
│   ├── i18n/
│   ├── lib/server/db/        # schema · client · quotas
│   └── proxy.ts              # Clerk + next-intl edge entry
├── AGENTS.md                 # engineering standards for humans + AI agents
└── package.json
```

---

## Getting started

```bash
git clone https://github.com/JakuninOleg/okhana.git
cd okhana
npm install
cp .env.example .env.local   # fill secrets (see below)
npm run db:migrate           # prefer migrate over push on the shared DB
npm run dev                  # webpack; use npm run dev:turbo if you want Turbopack
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Documented in [`.env.example`](./.env.example). Highlights:

| Variable | Role |
|---|---|
| `DATABASE_URL` | Pooler `:6543` — app runtime |
| `DIRECT_URL` | Session `:5432` — migrations only |
| `NEXT_PUBLIC_CLERK_*` / `CLERK_*` | Auth + webhooks |
| `GO_AI_BASE_URL` / `GO_AI_SHARED_SECRET` | AI gateway (never `NEXT_PUBLIC_*`) |
| `VAPID_*` | Web Push |
| `CRON_SECRET` | Bearer auth for `/api/cron/*` |
| `AI_CHAT_DAILY_FAMILY_LIMIT` / `AI_CHAT_DAILY_USER_LIMIT` | Optional chat ceilings (defaults 150 / 80, Moscow day) |
| `AI_CHAT_DISABLED` | Optional kill-switch |

**Clerk:** Development keys (`pk_test_` / `sk_test_`) on localhost and Vercel Preview; Production keys (`pk_live_` / `sk_live_`) only on `okhanahome.com`. Webhooks do not reach localhost.

**Database safety:** one shared `okhana` project. Review `drizzle/` carefully; do not casually seed or wipe local data.

---

## Scripts

```bash
npm run dev          # local app
npm run build        # production build + typecheck
npm run test         # Vitest
npm run lint         # ESLint
npm run db:generate  # drizzle-kit generate (from .env.local)
npm run db:migrate   # apply migrations
npm run db:check-env # sanity-check DB URLs
```

---

## CI/CD

Every PR to `master` runs GitHub Actions: `npm ci` → lint → `tsc --noEmit` → Vitest.

Merge to `master` deploys Production on Vercel. Each PR gets a Preview deploy (Clerk Development + same database).

Branching: `feature/*` or `fix/*` from `master` → PR → merge. Do not commit to `master` directly. The `staging` branch is deprecated.

---

## Roadmap (near-term)

| Priority | Item |
|---|---|
| Next | Richer note search (FTS → optional hybrid / embeddings) without weakening ACL |
| Next | Quiet hours / per-member notification preferences |
| Later | Postgres RLS as defense-in-depth |
| Later | Billing / plans |
| Later | Legal / privacy pages for public launch channels |
| Later | More agentic scenarios (packing lists, multi-step household flows) |

---

## Contributing

1. Branch from `master`: `feature/…` or `fix/…`.
2. Follow [`AGENTS.md`](./AGENTS.md) (TypeScript strict, Server Components by default, i18n for all UI strings, no secrets in git).
3. Conventional, atomic commits.
4. Before PR: eslint on touched files, tests green, `npm run build` clean; use Bugbot / Security Review when shipping product or auth/push/ACL changes.
5. Open a PR — never merge your own without review when policy requires it.

---

## License

MIT © 2026 Okhana Team
