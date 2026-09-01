/**
 * Okhana brand kit — derived from the official logo.
 *
 * Mood: warm tropical family hub — serene sunset, shared horizon, always together.
 * Tagline from the mark: "Family. Together. Always."
 *
 * Color roles:
 * - teal: trust / silhouettes / wordmark (primary ink & chrome)
 * - peach: hibiscus / sunset accent (rings, highlights, dark-mode CTAs)
 * - aqua: ocean calm (secondary surfaces)
 * - cream: sand / sky ground (page canvas)
 * - sage: foliage support (muted UI, leaf divider energy)
 */

export const brand = {
  name: 'Okhana',
  legalName: 'Okhana',
  tagline: {
    en: 'Family. Together. Always.',
    ru: 'Семья. Вместе. Всегда.',
  },
  /** Short product positioning for meta descriptions */
  pitch: {
    en: 'An AI-powered family hub that keeps everyone connected — notes, reminders, and a shared assistant that respects privacy.',
    ru: 'Семейный хаб с ИИ, который держит всех на связи — заметки, напоминания и общий помощник с уважением к приватности.',
  },
  /** Open Graph / Twitter site name */
  siteName: 'Okhana',
  domain: 'okhanahome.com',
  /** Canonical production origin (no trailing slash). */
  productionOrigin: 'https://okhanahome.com',
  colors: {
    cream: '#f9f7f2',
    creamSoft: '#fffcf7',
    teal: '#1a3533',
    tealDeep: '#0f1c1b',
    peach: '#e89b6c',
    peachSoft: '#f3d2bc',
    aqua: '#a8cdc8',
    sage: '#6f8f7c',
    muted: '#5c6f6c',
  },
  keywords: {
    en: [
      'Okhana',
      'family hub',
      'family organizer',
      'AI family assistant',
      'shared family notes',
      'family calendar',
      'private family AI',
    ],
    ru: [
      'Охана',
      'Okhana',
      'семейный хаб',
      'семейный органайзер',
      'ИИ помощник для семьи',
      'семейные заметки',
      'семейный календарь',
      'приватный семейный ИИ',
    ],
  },
  ogImagePath: '/brand/og-default.jpg',
  markPath: '/brand/okhana-mark.webp',
} as const;

export type BrandLocale = keyof typeof brand.tagline;

export function getSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (explicit) {
    return explicit;
  }
  if (process.env.VERCEL_ENV === 'production') {
    return brand.productionOrigin;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  }
  return 'http://localhost:3000';
}

export function absoluteUrl(path: string): string {
  const origin = getSiteOrigin();
  if (!path || path === '/') {
    return origin;
  }
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
