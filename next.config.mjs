import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // musicxml-player is a local package (file:../musicxml-player); transpile it so Next can bundle it.
  transpilePackages: ['@music-i18n/musicxml-player'],
};

export default withNextIntl(nextConfig);
