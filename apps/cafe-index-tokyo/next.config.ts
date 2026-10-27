import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true, // /cafes/12/index.html — works on any static host
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
