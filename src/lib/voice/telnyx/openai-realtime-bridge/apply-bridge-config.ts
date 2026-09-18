/** No-op — realtime bridge retired in favor of Voice V3 Basic (`/api/openai/live/incoming`). */
export function applyOpenAiRealtimeMediaBridgeConfig<T extends Record<string, unknown>>(
  config: T,
): T {
  return config;
}
