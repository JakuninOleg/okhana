import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
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
