import type { NextConfig } from 'next';
import { assertCatalogConfigured } from './src/lib/catalog-config';

assertCatalogConfigured();

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true, // /cafes/12/index.html — works on any static host
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
