import { voice, AgentSessionEventTypes } from "@livekit/agents";
import type { AgentSession } from "@livekit/agents";
import { deliverScriptedSpeech } from "./outbound/scripted-speech";
import { isBookingOperationActive } from "./frontdesk/booking-operation";
import type { FrontDeskUserData } from "./frontdesk/userdata";

const FIRST_FILLER_MS = 1500;
const SECOND_FILLER_MS = 4500;
const ABSOLUTE_OPERATION_TIMEOUT_MS = 45_000;

const FIRST_FILLER = "Got it — one moment while I get that set up.";
const SECOND_FILLER = "I'm still working on that.";
const TIMEOUT_LINE =
  "Sorry — that's taking longer than expected. Let me take your details and have the team finish this.";

type WatchState = {
  userSpeechEndMs?: number;
  lastAgentSpeechMs?: number;
  firstFillerSpoken: boolean;
  secondFillerSpoken: boolean;
  timeoutSpoken: boolean;
  timers: ReturnType<typeof setTimeout>[];
};

const watchByCallId = new Map<string, WatchState>();

function clearWatch(callId: string): void {
  const state = watchByCallId.get(callId);
  if (!state) return;
  for (const t of state.timers) clearTimeout(t);
  watchByCallId.delete(callId);
}

function needsSilenceWatchdog(ud: FrontDeskUserData): boolean {
  return (
    isBookingOperationActive(ud) ||
    Boolean(ud.intakeSequenceActive) ||
    Boolean(ud.receptionistFieldCollectionPrefaceSpoken)
  );
}

async function maybeSpeakFiller(
  session: AgentSession<FrontDeskUserData>,
  line: string,
): Promise<void> {
  if (session.agentState === "speaking") return;
  await deliverScriptedSpeech(session, line, {
    allowInterruptions: true,
    addToChatCtx: true,
  });
}

function scheduleWatchdogChecks(
  session: AgentSession<FrontDeskUserData>,
  callId: string,
): void {
  const ud = session.userData;
  if (!needsSilenceWatchdog(ud)) {
    clearWatch(callId);
    return;
  }

  let state = watchByCallId.get(callId);
  if (!state) {
    state = {
      firstFillerSpoken: false,
      secondFillerSpoken: false,
      timeoutSpoken: false,
      timers: [],
    };
    watchByCallId.set(callId, state);
  }

  for (const t of state.timers) clearTimeout(t);
  state.timers = [];

  const runCheck = async (kind: "first" | "second" | "timeout") => {
    if (!needsSilenceWatchdog(ud)) {
      clearWatch(callId);
      return;
    }
    if (session.agentState === "speaking") return;

    const sinceUser = state!.userSpeechEndMs
      ? Date.now() - state!.userSpeechEndMs
      : 0;
    const sinceAgent = state!.lastAgentSpeechMs
      ? Date.now() - state!.lastAgentSpeechMs
      : Infinity;

    if (sinceAgent < 800) return;

    if (kind === "first" && !state!.firstFillerSpoken && sinceUser >= FIRST_FILLER_MS) {
      state!.firstFillerSpoken = true;
      await maybeSpeakFiller(session, FIRST_FILLER);
      state!.lastAgentSpeechMs = Date.now();
      return;
    }

    if (kind === "second" && !state!.secondFillerSpoken && sinceUser >= SECOND_FILLER_MS) {
      state!.secondFillerSpoken = true;
      await maybeSpeakFiller(session, SECOND_FILLER);
      state!.lastAgentSpeechMs = Date.now();
      return;
    }

    if (kind === "timeout" && !state!.timeoutSpoken) {
      const opStart = ud.bookingOperation?.startedAtMs;
      if (opStart && Date.now() - opStart >= ABSOLUTE_OPERATION_TIMEOUT_MS) {
        state!.timeoutSpoken = true;
        await maybeSpeakFiller(session, TIMEOUT_LINE);
        clearWatch(callId);
      }
    }
  };

  state.timers.push(setTimeout(() => void runCheck("first"), FIRST_FILLER_MS));
  state.timers.push(setTimeout(() => void runCheck("second"), SECOND_FILLER_MS));
  state.timers.push(
    setTimeout(() => void runCheck("timeout"), ABSOLUTE_OPERATION_TIMEOUT_MS),
  );
}

export function attachOperationSilenceWatchdog(session: voice.AgentSession<FrontDeskUserData>): void {
  const callId = session.userData.callId;

  session.on(AgentSessionEventTypes.UserStateChanged, (ev) => {
    if (ev.oldState === "speaking" && ev.newState === "listening") {
      const state = watchByCallId.get(callId) ?? {
        firstFillerSpoken: false,
        secondFillerSpoken: false,
        timeoutSpoken: false,
        timers: [],
      };
      state.userSpeechEndMs = Date.now();
      watchByCallId.set(callId, state);
      scheduleWatchdogChecks(session, callId);
    }
  });

  session.on(AgentSessionEventTypes.AgentStateChanged, (ev) => {
    if (ev.newState === "speaking") {
      const state = watchByCallId.get(callId);
      if (state) {
        state.lastAgentSpeechMs = Date.now();
        state.firstFillerSpoken = false;
        state.secondFillerSpoken = false;
      }
    }
    if (!needsSilenceWatchdog(session.userData)) {
      clearWatch(callId);
    }
  });
}
