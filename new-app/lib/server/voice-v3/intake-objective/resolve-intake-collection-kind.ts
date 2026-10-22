import type { IntakeFieldDefinition } from "../config/agent-config";

export type IntakeCollectionKind =
  | "livekit_get_name"
  | "livekit_get_email"
  | "livekit_get_phone"
  | "livekit_get_address"
  | "livekit_get_dob"
  | "livekit_function_tool";

const STANDARD_FIELD_TO_COLLECTION: Record<string, IntakeCollectionKind> = {
  name: "livekit_get_name",
  full_name: "livekit_get_name",
  email: "livekit_get_email",
  phone: "livekit_get_phone",
  service_reason: "livekit_function_tool",
  address: "livekit_get_address",
  dob: "livekit_get_dob",
  date_of_birth: "livekit_get_dob",
};

/** Mirrors voice-runtime-python/transovo_voice/voice_v3/intake_collection.py */
export function resolveIntakeCollectionKind(field: IntakeFieldDefinition): IntakeCollectionKind {
  const key = field.key.trim().toLowerCase();
  const fieldType = field.type.trim().toLowerCase();
  if (key in STANDARD_FIELD_TO_COLLECTION) {
    return STANDARD_FIELD_TO_COLLECTION[key];
  }
  if (fieldType === "email") return "livekit_get_email";
  if (fieldType === "phone") return "livekit_get_phone";
  if (fieldType === "name") return "livekit_get_name";
  if (fieldType === "address") return "livekit_get_address";
  if (fieldType === "date" || fieldType === "dob") return "livekit_get_dob";
  return "livekit_function_tool";
}

export function hasLiveKitActiveCollector(field: IntakeFieldDefinition): boolean {
  return resolveIntakeCollectionKind(field) !== "livekit_function_tool";
}
