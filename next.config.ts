import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['google-auth-library', 'gaxios', 'gcp-metadata'],
};

export default nextConfig;
