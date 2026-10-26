import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const isCoolifyBuild = Boolean(process.env.COOLIFY_RESOURCE_UUID);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    agentUpgrade: "security",
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  output: "standalone",
  serverExternalPackages: ["@prisma/client", "prisma", "livekit-server-sdk"],
  typescript: {
    ignoreBuildErrors: isCoolifyBuild || true,
  },
  images: {
    unoptimized: true,
  },
  outputFileTracingRoot: appDir,
  turbopack: {
    root: appDir,
  },
  async headers() {
    return [
      {
        source: "/app/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
