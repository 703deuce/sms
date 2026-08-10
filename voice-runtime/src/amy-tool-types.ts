import type { llm } from "@livekit/agents";
import type { DomainActionResult, LiveKitCallContext } from "@/lib/voice/domain-actions";

export type AmyToolOptions = llm.ToolOptions<import("./metadata").AmyProcessUserData>;
