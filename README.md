# Okhana

> **AI is the architecture, not a feature.**  
> An AI-powered family hub — where every interaction is stored, searchable, and private by design.

[![CI](https://github.com/JakuninOleg/okhana/actions/workflows/ci.yml/badge.svg)](https://github.com/JakuninOleg/okhana/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Next.js](https://img.shields.io/badge/Next.js-16.2.10-000000?logo=next.js)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Problem

Families juggle an enormous mental load. Where is the passport? When is the dentist appointment? What was the WiFi password Grandma asked for? Who needs to be picked up from school today?

Existing tools are either:

- **Synchronous** (group chats, shared calendars) — they work *now*, but information disappears in endless scrolling.
- **Static** (shared docs, notes) — durable but unstructured, require manual organisation, and don't answer questions.
- **Corporate** (Notion, Trello) — built for workplaces, not for a parent managing bedtime, soccer practice, and a visa application at the same time.

**Okhana** is a family operating system that combines durable storage with conversational AI — it remembers everything, answers anything, and keeps it private within your family.

---

## Differentiation

| Feature | Okhana | Cozi | FamilyHub | Ohai | Kora |
|---|---|---|---|---|---|
| **AI-native search** | ✅ DB-level RAG | ❌ | ❌ | ❌ | ❌ |
| **Role-based ACL** | ✅ Owner / Adult / Child | ❌ | ❌ | ❌ | ✅ |
| **End-to-end encryption** | ✅ Encrypted notes | ❌ | ❌ | ❌ | ❌ |
| **Multi-language** | ✅ i18n (ru/en) | ❌ | ❌ | ❌ | ❌ |
| **Open-source** | ✅ MIT | ❌ | ❌ | ❌ | ❌ |
| **Privacy-first AI** | ✅ Row-level filtering | ❌ | ❌ | ✅ | ❌ |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js 16 App Router              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Clerk    │  │ next-intl│  │ Vercel AI SDK    │  │
│  │ Auth     │  │ i18n     │  │ Streaming / RAG  │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │             │                  │            │
│       ▼             ▼                  ▼            │
│  ┌─────────────────────────────────────────────┐   │
│  │          Next.js API / Server Actions       │   │
│  └──────────────────┬──────────────────────────┘   │
│                     │                              │
└─────────────────────┼──────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
   ┌──────────┐             ┌──────────────┐
   │ Drizzle  │             │  Drizzle ORM │
   │ ORM      │◄────────────►  Migrations  │
   └────┬─────┘             └──────────────┘
        │
        ▼
   ┌──────────────┐
   │  Supabase    │
   │  PostgreSQL  │
   └──────────────┘
```

---

## Core Features (MVP)

### 1. Family Creation & Roles
- A user creates a family and becomes **owner**.
- Invite members via a unique code — assign roles: **adult** or **child**.

### 2. Shared Memory with ACL
- Notes are the core knowledge base: documents, reminders, medical records, financial info.
- Each note has a privacy level: `public` → `adults_only` → `personal` (encrypted).
- Hidden-from lists allow fine-grained exclusions per note.

### 3. AI Chat with DB-Level Privacy
- Chat with an assistant that can retrieve and summarise family notes.
- **Crucially**: the AI only ever receives data the user already has DB-access to. We never rely on prompt engineering alone.

### 4. Calendar
- Simplified family calendar with events, tags, and all-day support.

### 5. Agentic Scenarios (coming)
- "Has anyone seen my passport?" → searches encrypted notes + suggests probable locations.
- "Prepare a packing list for Italy" → combines calendar + weather + stored documents.

---

## Privacy-First Design

> **"We do not rely on 'the model won't tell.'"**

Privacy filtering happens at the **database query level**, not in the LLM prompt:

1. User asks a question.
2. Query builder enforces row-level security based on the user's role and the note's `privacy_level` + `hidden_from`.
3. Only the permitted results are passed as context to the AI model.
4. The model never sees data it shouldn't.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 16.2.10 (App Router) | Full-stack React framework |
| **UI** | React 19.2.4 | Component library |
| **Language** | TypeScript 5 (strict) | Type safety |
| **Styling** | Tailwind CSS v4 + shadcn/ui | Utility-first design system |
| **Auth** | Clerk | Authentication & user management |
| **i18n** | next-intl 4.13.2 | Internationalisation (ru/en) |
| **Database** | Supabase PostgreSQL + Drizzle ORM | Persistence & type-safe queries |
| **AI** | Vercel AI SDK | Streaming chat & RAG |
| **Maps** | Yandex Maps API | Location services |
| **Testing** | Vitest | Unit & integration tests |
| **CI/CD** | GitHub Actions → Vercel | Continuous deployment |

---

## Project Structure

```
okhana/
├── .github/workflows/
│   └── ci.yml                  # Lint + typecheck + tests
├── messages/
│   ├── en.json                 # English strings
│   └── ru.json                 # Russian strings
├── src/
│   ├── app/
│   │   ├── [locale]/           # i18n-routed pages
│   │   │   ├── (auth)/
│   │   │   │   ├── sign-in/
│   │   │   │   └── sign-up/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   └── webhooks/clerk/ # Clerk user sync
│   │   └── globals.css
│   ├── components/
│   │   └── ui/                 # shadcn/ui primitives
│   ├── i18n/                   # next-intl config
│   ├── lib/
│   │   ├── server/db/
│   │   │   ├── schema.ts       # 6 tables, 4 enums
│   │   │   ├── index.ts        # DB client
│   │   │   └── queries/        # Domain query modules
│   │   └── utils.ts            # cn() helper
│   └── proxy.ts                # Clerk + next-intl middleware
├── drizzle/                    # SQL migration files
│   ├── drizzle.config.ts
│   └── 0000_keen_diamondback.sql
├── vitest.config.ts
└── package.json
```

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/JakuninOleg/okhana.git
cd okhana

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Fill in the required values (see below)

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret |

---

## Testing

```bash
# Run all tests (CI mode)
npm run test

# Run tests in watch mode
npm run test:watch

# TypeScript check
npm run build       # includes tsc --noEmit

# Lint
npm run lint
```

---

## CI/CD Pipeline

Every pull request to `master` triggers a GitHub Actions workflow:

1. **Checkout** — fetch code
2. **Setup Node.js 20** — with npm cache
3. `npm ci` — clean install from lockfile
4. `npm run lint` — ESLint (0 warnings required)
5. `npx tsc --noEmit` — TypeScript strict check
6. `npm run test` — Vitest (all green)

On merge to `master`, Vercel automatically deploys the production build.

---

## Roadmap

| Status | Feature |
|---|---|
| ✅ | Internationalisation (ru/en) |
| ✅ | Theme (light/dark with shadcn/ui) |
| ✅ | Clerk authentication & webhook sync |
| ✅ | Database schema (6 tables, 4 enums) |
| ✅ | CI baseline (lint + typecheck + tests) |
| 🔄 | Family creation UI & invite flow |
| ⏳ | Notes CRUD endpoint |
| ⏳ | AI chat with RAG |
| ⏳ | First agentic scenario |
| 🔮 | Property tracking module |
| 🔮 | Gamification for children |
| 🔮 | Family ownership transfer |

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `feature/description` or `fix/description`.
3. Follow the guidelines in [`AGENTS.md`](./AGENTS.md).
4. Make atomic commits (one logical change per commit).
5. Ensure `npm run build` and `npm run test` pass.
6. Open a pull request.

---

## License

MIT © 2026 Okhana Team
