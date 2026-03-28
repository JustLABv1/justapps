import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { resolve } from "path";

const { version } = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  output: 'standalone',
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
