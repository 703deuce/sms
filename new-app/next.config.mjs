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
  async redirects() {
    return [
      { source: "/app/mctb", destination: "/app/phone", permanent: false },
      { source: "/app/mctb/recovery", destination: "/app/phone", permanent: false },
      { source: "/app/phone/missed-call-text-back", destination: "/app/phone", permanent: false },
      { source: "/app/mctb/calls/:path*", destination: "/app/phone/calls/:path*", permanent: false },
      { source: "/app/mctb/calls", destination: "/app/phone/calls", permanent: false },
      { source: "/app/mctb/conversations", destination: "/app/inbox", permanent: false },
      { source: "/app/mctb/analytics", destination: "/app/phone/analytics", permanent: false },
    ];
  },
};

export default nextConfig;
