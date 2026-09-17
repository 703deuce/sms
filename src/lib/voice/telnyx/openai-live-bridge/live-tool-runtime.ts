/**
 * Live Responses delegation tool dispatch — same Voice V2 executors as Realtime bridge.
 */
export {
  dispatchOpenAiRealtimeVoiceV2Tool as dispatchLiveDelegationTool,
  REALTIME_SAVE_INTAKE_DEFERRED_OUTPUT as LIVE_SAVE_INTAKE_DEFERRED_OUTPUT,
  type RealtimeToolDispatchContext as LiveToolDispatchContext,
} from "../openai-realtime-bridge/realtime-tools";
