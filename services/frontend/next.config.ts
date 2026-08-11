import { readFileSync } from "fs";
import type { NextConfig } from "next";
import { resolve } from "path";

const { version } = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  output: 'standalone',
  async rewrites() {
    const docs = process.env.DOCS_INTERNAL_URL ?? 'http://127.0.0.1:3001';

    return [
      {
        source: '/docs',
        destination: `${docs}/docs`,
      },
      {
        source: '/docs/:path*',
        destination: `${docs}/docs/:path*`,
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
