---
name: okhana-ui-reference
description: >-
  UI/UX reference guide for Okhana — family AI hub. Maps competitor apps and
  web patterns to concrete Okhana decisions (chat, dashboard, PWA, brand).
  Use when designing screens, reviewing UI, choosing layout density, or when
  the user asks for design references, inspiration, or "make it feel like X".
---

# Okhana UI Reference

Read [references.md](references.md) for links and screenshots sources.
Apply [brand-rules.md](brand-rules.md) for tokens and anti-patterns.

## Product position (what to optimize for)

Okhana is **not** a calendar-first app (Cozi/TimeTree). It is an **AI-orchestrated family hub**:
chat + memory (notes) + privacy at the DB layer. UI should feel **calm, warm, trustworthy** — like the logo (sunset, family silhouettes, together).

**Steal:** clarity, capture speed, mobile shell, editorial AI chat.  
**Avoid:** dense admin dashboards, purple AI slop, feature-bloat home screens, childish gamification (OurHome).

## Reference matrix — what to borrow from whom

| Source | Borrow | Do NOT copy |
|--------|--------|-------------|
| **Ohai** ([ohai.ai](https://www.ohai.ai)) | Voice-first capture, inbox→calendar mental model, "brain dump" UX, proactive assistant tone | Calendar-as-home; US-only parent marketing voice |
| **Nori** | Photo/voice→structured events, multimodal composer affordances | Overloaded "superpowers" marketing; wall-tablet anchor |
| **TimeTree** | Clean shared calendar when we add calendar; event-thread clarity | Calendar-only product shape |
| **Cozi** | Per-member color coding, shopping/list patterns | Dated dense UI; 30-day free calendar gate |
| **FamilyWall** | Card dashboard, per-member filters, just-in-time onboarding | Everything-at-once onboarding; locator/finance scope creep |
| **Claude** (web) | Calm editorial AI prose, durable threads, restrained chrome | Dark dev-tool aesthetic |
| **Apple HIG** | Safe areas, 44px targets, PWA install dignity | iOS-native chrome we can't match on web |
| **shadcn blocks** | Auth, settings, dashboard scaffolding | Generic SaaS purple/gray |

## Okhana-enhanced direction (our ideas on top)

### 1. Home = horizon, not feature grid
- Hero: logo mark + tagline **Family. Together. Always.**
- One primary CTA: enter family / sign in
- Soft radial gradient (`brand-sun` → cream), not illustration overload

### 2. Dashboard = chat-first shell
- **Chat fills viewport** (already started) — family header collapses (`<details>`)
- Future modules (calendar, notes list) = secondary tabs or bottom sheet, never competing with chat on first paint

### 3. Okhana avatar = trust anchor
- Always `/brand/okhana-mark.webp` in chat rows and header
- Assistant messages: left-aligned, editorial width (`max-w-prose`), subtle peach ring — not generic bot bubble

### 4. Composer = multimodal hub (roadmap)
- Mic (hold-to-talk) primary on mobile — learn from Ohai/Nori
- Text secondary but always visible
- Future: attach photo of school flyer → same composer (Nori pattern)

### 5. Privacy as visible UX
- Small badge/chip: "Only what you can see" near chat — differentiator vs Ohai/Cozi
- Role-aware empty states ("Ask Okhana to save a note for adults only")

### 6. Motion (use with emilkowalski skills)
- Enter: `ease-out` 200–300ms on sheets/cards only
- No parallax, no bounce, no confetti — family calm not game UI
- Prefer `opacity` + `translate-y-1` over scale

### 7. PWA mobile patterns
- Sticky composer + `env(safe-area-inset-*)`
- `theme-color` = `brand.teal`
- Install prompt only after first successful chat (not on landing)

## Screen checklist

Before shipping a screen:

- [ ] Uses `brand-*` tokens / CSS vars — no emerald, no random hex
- [ ] Copy via `next-intl` — tagline tone: warm, short, never corporate
- [ ] Touch targets ≥ 44px on mobile
- [ ] Chat/AI visually distinct from user messages
- [ ] No inline `style={{}}` — Tailwind only
- [ ] Lighthouse: images WebP, `sizes` on `next/image`, no 100KB+ logos in UI

## External skills to install (recommended)

```bash
npx skills@latest add emilkowalski/skills
```

Priority from that repo for Okhana:
1. `emil-design-eng` — spacing, borders, motion taste
2. `apple-design` — mobile/PWA feel
3. `pick-ui-library` — shadcn/Sonner over hand-rolled
4. `animate` — subtle transitions only
5. `ask-sonner` — if adding toasts

## When user shares a reference link

1. Name what to steal (layout, density, color, motion) in one sentence
2. Map to Okhana component (`family-chat.tsx`, `navbar.tsx`, etc.)
3. Explicitly list what violates brand (cold blues, dense tables, etc.)
4. Implement smallest diff — one screen region at a time
