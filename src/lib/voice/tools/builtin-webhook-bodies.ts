/** Canonical Telnyx webhook body schemas for workflow shared tools. */
import { BUILTIN_WEBHOOK_BODIES } from "@/lib/voice/tools/catalog";

export const SEND_RESOURCE_WEBHOOK_BODY =
  BUILTIN_WEBHOOK_BODIES.send_resource.body as Record<string, unknown>;

export const SEARCH_BUSINESS_DETAILS_WEBHOOK_BODY =
  BUILTIN_WEBHOOK_BODIES.search_business_details.body as Record<string, unknown>;
