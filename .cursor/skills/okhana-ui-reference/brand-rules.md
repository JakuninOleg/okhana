# Okhana brand UI rules

From logo: **Family. Together. Always.**

## Palette (use CSS variables / Tailwind `brand-*`)

| Token | Hex | Role |
|-------|-----|------|
| `brand-teal` | `#1a3533` | Primary text, chrome, trust |
| `brand-peach` | `#e89b6c` | Accent, rings, dark-mode primary |
| `brand-aqua` | `#a8cdc8` | Secondary surfaces, calm highlights |
| `brand-sage` | `#6f8f7c` | Muted foliage, secondary text energy |
| `brand-cream` | `#f9f7f2` | Page canvas |
| `brand-sun` | `#ffe7cb` | Gradients, warmth |

## Typography

- Font: Plus Jakarta Sans (already in layout)
- Wordmark tracking: wide caps `OKHANA` / localized brand name
- Tagline: uppercase, letter-spaced, `text-brand-peach`

## Shape language

- `rounded-2xl` cards, `rounded-full` avatar/mark
- Rings: `ring-brand-peach/35` — not harsh `ring-primary`
- Borders: `border-border/60` — soft, not 1px black

## Anti-patterns (never)

- Default emerald shadcn primary
- Purple/violet AI gradients
- Glassmorphism blur stacks
- Dense data tables on mobile dashboard
- Hardcoded English in JSX
- Full wordmark logo at favicon/navbar size (use mark only)

## i18n tone

- EN: warm, direct, "Okhana" as assistant name
- RU: "Охана" — same warmth, not bureaucratic
