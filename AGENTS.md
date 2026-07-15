# Okhana — Engineering Standards

## Stack
- Next.js 16.2.10 (App Router)
- React 19.2.4
- TypeScript 5 (strict)
- Tailwind CSS v4
- next-intl 4.13.2 (i18n routing via `[locale]`)

## Code Rules
- Strict TypeScript. No `any`.
- Prefer Server Components. Use `'use client'` only for hooks, events, or browser APIs.
- Tailwind utilities only. No inline `style={{}}`.
- shadcn/ui components go in `components/ui/` (installed via CLI).
- Use `cn()` from `lib/utils.ts` for conditional classes.

## i18n
- All user-facing strings must use `next-intl` translations.
- Translation files live in `messages/[locale].json`.
- Route configuration lives in `app/i18n/routing.ts`.

## Git
- Work in feature branches: `feature/description`, `fix/description`.
- Never commit to `main` directly.
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`.
- Atomic commits: one logical change per commit.

## AI Assistant (KodaCode)
- Read `AGENTS.md` at the start of each session.
- Explain architectural decisions in comments.
- Ask before installing new dependencies.
- Run `npm run build` before declaring a task complete.
- Never commit or push — stage changes for human review.
- Write code in small chunks (max 50 lines per change).

## Security
- No secrets in code. Use `.env.local`.
- Never expose API keys in client-side code (prefix with `NEXT_PUBLIC_` only when necessary).