---
name: okhana-brand-apply
description: >-
  Applies Okhana logo-derived brand to UI — colors, imagery, SEO copy, manifest
  theme. Use when styling components, adding marketing pages, favicons, OG images,
  or when UI looks generic/off-brand.
---

# Okhana Brand Apply

Canonical source: `src/lib/brand.ts` + `src/app/globals.css`

## Quick rules

1. **Small UI** → `okhana-mark.webp` (navbar, avatar, favicon source)
2. **Marketing / OG** → `og-default.jpg` or full logo jpg/webp
3. **Never** ship 90KB+ PNG wordmark in navbar

## Tailwind classes (prefer)

- Background: `bg-background` (cream)
- Primary actions: `bg-primary text-primary-foreground` (teal on cream)
- Accents: `text-brand-peach`, `ring-brand-peach/40`
- Cards: `bg-card/80 backdrop-blur-sm border-border/60`
- Gradients: `from-brand-sun` via cream — subtle only

## Regenerate assets

```bash
npm run brand:optimize
```

Master source: `assets/brand/okhana-logo-source.jpg` (not public)

## SEO / meta

- Copy: `messages/*/Meta.*` + `src/lib/seo.ts`
- Tagline always: **Family. Together. Always.** / **Семья. Вместе. Всегда.**

## Clerk theming

Layout already maps `colorPrimary: var(--primary)`. After token changes, verify sign-in card contrast in light + dark.
