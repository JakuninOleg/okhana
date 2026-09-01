import { describe, it, expect } from 'vitest';
import { brand, absoluteUrl, getSiteOrigin } from '@/lib/brand';
import { buildLocaleMetadata, buildJsonLd } from '@/lib/seo';

describe('brand kit', () => {
  it('exposes logo-derived colors', () => {
    expect(brand.colors.teal).toBe('#1a3533');
    expect(brand.colors.peach).toBe('#e89b6c');
    expect(brand.colors.cream).toBe('#f9f7f2');
  });

  it('keeps the logo tagline', () => {
    expect(brand.tagline.en).toBe('Family. Together. Always.');
  });
});

describe('seo metadata', () => {
  it('builds locale metadata with OG and canonical', () => {
    const meta = buildLocaleMetadata('en', {
      title: 'Okhana — Family. Together. Always.',
      description: 'AI family hub',
      ogTitle: 'Okhana',
      ogDescription: 'Family hub',
    });

    expect(meta.openGraph?.siteName).toBe('Okhana');
    expect(meta.twitter?.card).toBe('summary_large_image');
    expect(meta.alternates?.canonical).toBe(`${getSiteOrigin()}/en`);
    expect(absoluteUrl(brand.ogImagePath)).toContain('/brand/og-default.jpg');
  });

  it('builds JSON-LD graph with Organization', () => {
    const jsonLd = buildJsonLd('ru', { description: 'Семейный хаб' });
    const graph = jsonLd['@graph'] as Array<Record<string, unknown>>;
    expect(graph.some((node) => node['@type'] === 'Organization')).toBe(true);
    expect(graph.some((node) => node['@type'] === 'WebSite')).toBe(true);
  });
});
