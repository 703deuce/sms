import type { NextConfig } from "next";

// Coolify build VMs OOM during Next's post-compile "Running TypeScript" step (exit 137).
// Types are checked via `tsc --noEmit` in CI/dev before deploy.
const isCoolifyBuild = Boolean(process.env.COOLIFY_RESOURCE_UUID);

const nextConfig: NextConfig = {
  output: "standalone",
  // Headless browsers and test harnesses reach the dev server on the loopback IP.
  // Without this Next blocks /_next/webpack-hmr as cross-origin and the client
  // never hydrates, which looks like a broken page rather than a config problem.
  allowedDevOrigins: ["127.0.0.1", "localhost", "0.0.0.0"],
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
      { source: "/kimi", destination: "/transovo/kimi", permanent: false },
      { source: "/kimi/:path*", destination: "/transovo/kimi/:path*", permanent: false },
      { source: "/kimmy", destination: "/transovo/kimi", permanent: false },
      { source: "/kimmy/:path*", destination: "/transovo/kimi/:path*", permanent: false },
      { source: "/voice/conversations", destination: "/mctb/conversations", permanent: false },
      { source: "/voice/conversations/:path*", destination: "/mctb/conversations/:path*", permanent: false },
      { source: "/voice/missed-calls", destination: "/mctb/missed-calls", permanent: false },
      { source: "/voice/missed-calls/:path*", destination: "/mctb/missed-calls/:path*", permanent: false },
      { source: "/voice/setup", destination: "/mctb/setup", permanent: false },
      { source: "/mctb/setup/business-hours", destination: "/mctb/setup/recovery", permanent: false },
      { source: "/mctb/setup/follow-up", destination: "/mctb/setup/recovery", permanent: false },
      { source: "/mctb/setup/schedule", destination: "/mctb/setup/recovery", permanent: false },
    ];
  },
  // BullMQ pulls Node builtins (net, child_process) — keep external when webpack is used.
  serverExternalPackages: [
    "bullmq",
    "ioredis",
    "@livekit/agents",
    "@livekit/rtc-node",
    "@livekit/protocol",
    // OpenAI Live sideband uses `ws`; bundling breaks mask/buffer-util (prod: b.mask is not a function).
    "openai",
    "ws",
    "bufferutil",
    "utf-8-validate",
  ],
};

export default nextConfig;
