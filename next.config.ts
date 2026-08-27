import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      { source: "/inbox", destination: "/conversations", permanent: false },
      { source: "/inbox/:path*", destination: "/conversations/:path*", permanent: false },
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
  // Coolify build VMs: limit parallel compile workers to reduce Turbopack peak RAM.
  experimental: {
    cpus: 1,
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
