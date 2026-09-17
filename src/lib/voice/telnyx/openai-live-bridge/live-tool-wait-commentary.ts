import {
  VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE,
  VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE,
  VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE,
  VOICE_V2_SAVE_INTAKE_TOOL_TYPE,
  VOICE_V2_TRANSFER_CALL_TOOL_TYPE,
} from "@/lib/voice-v2/telnyx-tool-definition";
import {
  buildLiveCommentaryAppend,
  buildLiveThinkingAppend,
} from "./live-outbound-events";

export type LiveToolWaitProgressController = {
  start(): void;
  complete(): void;
  cancel(): void;
};

type ToolWaitHints = {
  /** Send immediate commentary on tool start (semantic hint for Live). */
  initial: string | null;
  progress: string[];
};

const TOOL_WAIT_HINTS: Record<string, ToolWaitHints> = {
  [VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE]: {
    initial: "Briefly let the caller know you're checking availability for them now.",
    progress: [
      "Briefly let the caller know you're still checking the calendar.",
      "Briefly reassure the caller you're still working on availability.",
    ],
  },
  [VOICE_V2_BOOK_OFFERED_SLOT_TOOL_TYPE]: {
    initial: "Briefly let the caller know you're securing the selected appointment now.",
    progress: [
      "Briefly let the caller know you're finishing the booking.",
      "Briefly reassure the caller you're still completing the booking.",
    ],
  },
  [VOICE_V2_CREATE_CALLBACK_REQUEST_TOOL_TYPE]: {
    initial: "Briefly let the caller know you're arranging that callback.",
    progress: ["Briefly let the caller know you're still setting up the callback request."],
  },
  [VOICE_V2_TRANSFER_CALL_TOOL_TYPE]: {
    initial: "Briefly let the caller know you're connecting them now.",
    progress: ["Briefly let the caller know the transfer is still in progress."],
  },
};

/** Tools that usually finish quickly — skip spoken wait UX unless they run long. */
const FAST_TOOLS = new Set<string>([VOICE_V2_SAVE_INTAKE_TOOL_TYPE]);

const PROGRESS_MS = [2800, 5800];
const LONG_TOOL_INTERVAL_MS = 3500;

function logWait(event: string, fields: Record<string, unknown>) {
  console.info(`LIVE_TOOL_WAIT_${event} ${JSON.stringify(fields)}`);
}

export function buildSessionThinkingAppendEvent(input: {
  content: string;
}): Record<string, unknown> {
  return buildLiveThinkingAppend({
    eventIdPrefix: "tool_wait_thinking",
    content: input.content,
    delegationId: null,
  });
}

export function buildSessionCommentaryAppendEvent(input: {
  delegationId: string | null;
  content: string;
}): Record<string, unknown> {
  return buildLiveCommentaryAppend({
    eventIdPrefix: "tool_wait_commentary",
    content: input.content,
    delegationId: input.delegationId ?? null,
  });
}

export function createLiveToolWaitProgressController(input: {
  callId: string;
  liveSessionId: string | null;
  delegationId: string | null;
  toolCallId: string;
  toolName: string;
  sendLiveOut: (event: Record<string, unknown>) => void;
}): LiveToolWaitProgressController {
  const startedAt = Date.now();
  let completed = false;
  let cancelled = false;
  let commentaryIndex = 0;
  let progressRound = 0;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const hints = TOOL_WAIT_HINTS[input.toolName];

  const clearTimers = () => {
    for (const t of timers) clearTimeout(t);
    timers.length = 0;
  };

  const appendCommentary = (semanticHint: string) => {
    if (completed || cancelled) return;
    const idx = commentaryIndex++;
    logWait("COMMENTARY", {
      call_id: input.callId,
      live_session_id: input.liveSessionId,
      delegation_id: input.delegationId,
      tool_call_id: input.toolCallId,
      tool_name: input.toolName,
      elapsed_ms: Date.now() - startedAt,
      commentary_index: idx,
    });
    input.sendLiveOut(
      buildSessionCommentaryAppendEvent({
        delegationId: input.delegationId,
        content: semanticHint,
      }),
    );
  };

  const scheduleLongTail = () => {
    const t = setTimeout(() => {
      if (completed || cancelled || !hints) return;
      const hint =
        hints.progress[Math.min(progressRound, hints.progress.length - 1)] ??
        hints.progress[hints.progress.length - 1];
      progressRound += 1;
      appendCommentary(hint);
      scheduleLongTail();
    }, LONG_TOOL_INTERVAL_MS);
    timers.push(t);
  };

  return {
    start() {
      if (FAST_TOOLS.has(input.toolName) || !hints?.initial) {
        logWait("STARTED", {
          call_id: input.callId,
          live_session_id: input.liveSessionId,
          delegation_id: input.delegationId,
          tool_call_id: input.toolCallId,
          tool_name: input.toolName,
          commentary_skipped: true,
        });
        return;
      }
      logWait("STARTED", {
        call_id: input.callId,
        live_session_id: input.liveSessionId,
        delegation_id: input.delegationId,
        tool_call_id: input.toolCallId,
        tool_name: input.toolName,
        commentary_skipped: false,
      });
      input.sendLiveOut(
        buildSessionThinkingAppendEvent({
          content: `Tool ${input.toolName} started; awaiting certified runtime result.`,
        }),
      );
      appendCommentary(hints.initial);
      for (let i = 0; i < PROGRESS_MS.length; i++) {
        const t = setTimeout(() => {
          if (completed || cancelled) return;
          const hint = hints.progress[i];
          if (hint) appendCommentary(hint);
          if (i === PROGRESS_MS.length - 1) scheduleLongTail();
        }, PROGRESS_MS[i]);
        timers.push(t);
      }
    },
    complete() {
      if (completed) return;
      completed = true;
      clearTimers();
      logWait("COMPLETED", {
        call_id: input.callId,
        live_session_id: input.liveSessionId,
        delegation_id: input.delegationId,
        tool_call_id: input.toolCallId,
        tool_name: input.toolName,
        elapsed_ms: Date.now() - startedAt,
        commentary_index: commentaryIndex,
      });
    },
    cancel() {
      if (completed || cancelled) return;
      cancelled = true;
      clearTimers();
      logWait("CANCELLED", {
        call_id: input.callId,
        live_session_id: input.liveSessionId,
        delegation_id: input.delegationId,
        tool_call_id: input.toolCallId,
        tool_name: input.toolName,
        elapsed_ms: Date.now() - startedAt,
      });
    },
  };
}
