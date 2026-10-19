import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const isCoolifyBuild = Boolean(process.env.COOLIFY_RESOURCE_UUID);

/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

export default nextConfig;
