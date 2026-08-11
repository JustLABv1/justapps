import { createMDX } from "fumadocs-mdx/next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/docs",
  output: "standalone",
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/", destination: "/de", permanent: false },
      { source: "/setup", destination: "/admin", permanent: true },
      {
        source: "/setup/quick-start",
        destination: "/admin/getting-started",
        permanent: true,
      },
      {
        source: "/setup/configuration",
        destination: "/admin/configuration",
        permanent: true,
      },
      {
        source: "/setup/authentication",
        destination: "/admin/authentication",
        permanent: true,
      },
      {
        source: "/deploy/docker-compose",
        destination: "/admin/deployment/docker-compose",
        permanent: true,
      },
      {
        source: "/deploy/helm",
        destination: "/admin/deployment/helm",
        permanent: true,
      },
      {
        source: "/organize-and-govern/admin-guide",
        destination: "/admin",
        permanent: true,
      },
      {
        source: "/organize-and-govern/ai-assistant",
        destination: "/admin/integrations/ai",
        permanent: true,
      },
      {
        source: "/integrations/repository-sync",
        destination: "/admin/integrations/repository-sync",
        permanent: true,
      },
      {
        source: "/integrations/gitlab-integration",
        destination: "/admin/integrations/gitlab-integration",
        permanent: true,
      },
    ];
  },
};

export default createMDX()(nextConfig);
