import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const isCoolifyBuild = Boolean(process.env.COOLIFY_RESOURCE_UUID);
const featureScreenwriting = process.env.FEATURE_SCREENWRITING ?? "0";

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_FEATURE_SCREENWRITING: featureScreenwriting,
  },
  experimental: {
    agentUpgrade: "security",
    proxyClientMaxBodySize: "12mb",
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
  async redirects() {
    return [
      {
        source: "/streamer",
        destination: "/app/streamer",
        permanent: false,
      },
      {
        source: "/favicon.ico",
        destination: "/icon-light-32x32.png",
        permanent: false,
      },
    ];
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
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https:",
              "connect-src 'self' https: wss://*.livekit.cloud wss://*.livekit.io https://*.livekit.cloud https://*.turn.livekit.cloud https://*.b-cdn.net",
              "worker-src 'self' blob:",
            ].join("; "),
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
