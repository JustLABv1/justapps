import { readFileSync } from "fs";
import type { NextConfig } from "next";
import { resolve } from "path";

const { version } = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
);

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined;
  }

  return parsed;
}

const buildCpuLimit = parsePositiveInteger(process.env.NEXT_BUILD_CPUS);
const staticGenerationMaxConcurrency = parsePositiveInteger(
  process.env.NEXT_STATIC_GENERATION_MAX_CONCURRENCY
);

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    ...(buildCpuLimit ? { cpus: buildCpuLimit } : {}),
    ...(staticGenerationMaxConcurrency
      ? { staticGenerationMaxConcurrency }
      : {}),
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
