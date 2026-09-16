import "server-only";

import { getVoiceV2InstanceId } from "../runtime/instance-id";

export type VoiceV2ContextSource =
  | "l1_direct"
  | "l1_after_alias"
  | "l2"
  | "warmup"
  | "reconstructed"
  | "created"
  | "terminated";

export type VoiceV2ContextLookupTrace = {
  instance_id: string;
  input_identifier_type: "trusted_call_id" | "call_control" | "conversation" | "call_id_alias" | "unknown";
  input_identifier_value: string;
  canonical_key_known_at_entry: boolean;
  canonical_key_source: string;
  canonical_key: string;
  L1_DIRECT_LOOKUP_MS: number;
  ALIAS_LOOKUP_MS: number;
  TOMBSTONE_CHECK_MS: number;
  L2_CONTEXT_GET_MS: number;
  L2_DESERIALIZE_MS: number;
  L1_HYDRATE_MS: number;
  CONTEXT_TOTAL_MS: number;
  CONTEXT_SOURCE: VoiceV2ContextSource;
};

export function createVoiceV2ContextLookupTrace(
  partial?: Partial<VoiceV2ContextLookupTrace>,
): VoiceV2ContextLookupTrace {
  return {
    instance_id: getVoiceV2InstanceId(),
    input_identifier_type: "unknown",
    input_identifier_value: "",
    canonical_key_known_at_entry: false,
    canonical_key_source: "",
    canonical_key: "",
    L1_DIRECT_LOOKUP_MS: 0,
    ALIAS_LOOKUP_MS: 0,
    TOMBSTONE_CHECK_MS: 0,
    L2_CONTEXT_GET_MS: 0,
    L2_DESERIALIZE_MS: 0,
    L1_HYDRATE_MS: 0,
    CONTEXT_TOTAL_MS: 0,
    CONTEXT_SOURCE: "l1_direct",
    ...partial,
  };
}
