---
name: okhana-family-chat-ui
description: >-
  Implements and reviews Okhana family chat UI — mobile PWA shell, voice
  composer, Okhana avatar, streaming messages, calm assistant tone. Use when
  editing family-chat.tsx, chat-message.tsx, voice recorder, or mobile chat layout.
---

# Okhana Family Chat UI

Parent skill: [okhana-ui-reference](../okhana-ui-reference/SKILL.md)

## Layout (mobile-first PWA)

```
┌─────────────────────────┐
│ Navbar (mark + OKHANA)  │ sticky, safe-area-top
├─────────────────────────┤
│ Family header (collapse)│ shrink-0, optional details
├─────────────────────────┤
│                         │
│   Message list          │ flex-1 min-h-0 overflow-y-auto
│                         │
├─────────────────────────┤
│ Composer (mic + input)  │ shrink-0, safe-area-bottom
└─────────────────────────┘
```

- Card uses `flex h-full flex-col` — never fixed `h-[26rem]` on mobile
- `overscroll-contain` on message list

## Message patterns (Claude + Ethora inspired)

**User:** right-aligned or full-width with subtle `bg-muted/30`, no avatar required.

**Okhana (assistant):**
- Left: `OkhanaAvatar` + name from `t('assistantName')`
- Prose: readable line length, markdown-friendly
- Streaming: thinking indicator — not spinner-only wall
- Visually distinct — users must know it's AI (trust)

## Composer (Ohai/Nori inspired)

- **Mic:** hold-to-talk primary; `touch-none`, destructive tint while recording
- **Input:** grows to `max-h-32`; Enter sends, Shift+Enter newline
- **Send/Stop:** icon buttons `rounded-xl`, min 44px hit area
- Hints: one line `text-xs text-muted-foreground` below composer

## Voice UX (existing — preserve)

- Push-to-talk → transcribe → auto-send
- 4:30 warn / 5:00 hard stop
- TTS: EN only, default off, `localStorage` preference

## Status line

Single `aria-live` line: Ready / Listening / Thinking / Transcribing — avoid duplicate banners.

## Files

- `src/features/chat/family-chat.tsx` — main shell
- `src/features/chat/chat-message.tsx` — row layout
- `src/features/chat/okhana-avatar.tsx` — `/brand/okhana-mark.webp`
- `src/features/chat/family-chat-loader.tsx` — dynamic import boundary

## Review checklist

- [ ] Composer visible above iOS home indicator
- [ ] Keyboard doesn't cover input (test mobile)
- [ ] Avatar alt/label from i18n
- [ ] No new hardcoded strings
- [ ] Motion: if added, use `emil-design-eng` / `animate` skills — max 300ms ease-out
