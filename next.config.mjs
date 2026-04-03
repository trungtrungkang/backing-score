import createNextIntlPlugin from 'next-intl/plugin';
import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

if (process.env.NODE_ENV === 'development') {
  await setupDevPlatform();
  console.log("⚡️ D1 injected in Next.js Router Config:", !!process.env.backing_score_prod);
}

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // musicxml-player is a local package (file:../musicxml-player); transpile it so Next can bundle it.
  transpilePackages: ['@music-i18n/musicxml-player'],
  webpack: (config) => {
    // pdfjs-dist requires canvas on Node but not in browser
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default withNextIntl(nextConfig);
