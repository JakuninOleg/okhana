import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    // Navbar mark is tiny; keep deviceSizes lean for mobile-first PWA.
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 36, 48, 64, 96, 128, 256],
  },
  // Keep file watchers off generated/knowledge dirs — they churn and inflate CPU in next.dev.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/graphify-out/**',
          '**/agent-transcripts/**',
        ],
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
