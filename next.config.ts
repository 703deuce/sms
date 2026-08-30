import type { NextConfig } from "next";

// Coolify build VMs OOM during Next's post-compile "Running TypeScript" step (exit 137).
// Types are checked via `tsc --noEmit` in CI/dev before deploy.
const isCoolifyBuild = Boolean(process.env.COOLIFY_RESOURCE_UUID);

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: isCoolifyBuild,
  },
  // Coolify 8GB VMs: skip source maps during build to lower webpack peak RSS.
  ...(isCoolifyBuild
    ? {
        productionBrowserSourceMaps: false,
        experimental: {
          cpus: 1,
          webpackMemoryOptimizations: true,
          webpackBuildWorker: false,
          serverSourceMaps: false,
        },
        webpack: (config, { dev }) => {
          if (!dev) {
            config.cache = false;
          }
          return config;
        },
      }
    : {
        experimental: {
          cpus: 1,
          webpackMemoryOptimizations: true,
        },
      }),
  async headers() {
    return [
      {
        source: "/voicemail/:token/active.mp3",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, must-revalidate",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/inbox", destination: "/conversations", permanent: false },
      { source: "/inbox/:path*", destination: "/conversations/:path*", permanent: false },
      // Kimi UI tool — short aliases for /transovo/kimi
      { source: "/kimi", destination: "/transovo/kimi", permanent: false },
      { source: "/kimi/:path*", destination: "/transovo/kimi/:path*", permanent: false },
      { source: "/kimmy", destination: "/transovo/kimi", permanent: false },
      { source: "/kimmy/:path*", destination: "/transovo/kimi/:path*", permanent: false },
    ];
  },
  // BullMQ pulls Node builtins (net, child_process) — keep external when webpack is used.
  serverExternalPackages: [
    "bullmq",
    "ioredis",
    "@livekit/agents",
    "@livekit/rtc-node",
    "@livekit/protocol",
  ],
};

export default nextConfig;
