import { getPrisma } from "@/lib/db";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { evaluateInboundRouting } from "./routing";
import {
  getMessagingRuntimeSettings,
  isWithinBusinessHours,
} from "@/lib/messaging/messaging-settings";
import {
  applyActionTimezone,
  resolveRingTimeoutSeconds,
} from "./routing-action-resolve";
import {
  isTelnyxVoiceConfigured,
  startAiAssistantOnCall,
  startCallRecording,
  startCallTranscription,
} from "./telnyx/assistant-sync";
import { parseVoiceAgentConfig } from "./types";
import { claimAiStart } from "./ai-start-lock";
import {
  AI_MEDIA_SETTLE_MS,
  DEFAULT_AI_GREETING,
  startupGreetingFromConfig,
} from "./startup-greeting";
import { playStartupGreetingMask } from "./startup-greeting-runtime";
import {
  buildPstnAudioDiagnostics,
  normalizeOutputGainDb,
  startInboundNoiseSuppression,
} from "./pstn-audio";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveAiGreeting(input: {
  config: ReturnType<typeof parseVoiceAgentConfig>;
  agentName: string;
  contactName?: string;
  /** Prepend recording disclosure when it was not spoken separately. */
  prependDisclosure?: string | null;
}) {
  const configured =
    (input.config.callHandling?.greeting as string | undefined)?.trim() ||
    DEFAULT_AI_GREETING;
  let greeting = configured;
  const disclosure = input.prependDisclosure?.trim();
  if (disclosure) {
    const alreadyIncludes = greeting.toLowerCase().includes(disclosure.toLowerCase().slice(0, 40));
    if (!alreadyIncludes) {
      greeting = `${disclosure} ${greeting}`;
    }
  }
  if (!input.contactName) return greeting;
  if (/^hi[, ]/i.test(greeting) || greeting.includes(input.contactName)) {
    return greeting;
  }
  return `Hi ${input.contactName}. ${greeting}`;
}

/** Honor draftConfig.callHandling.callRecording: off | inbound_only | all. */
export function shouldStartCallRecording(
  callRecording: unknown,
  direction: "INBOUND" | "OUTBOUND" = "INBOUND",
): boolean {
  const mode = String(callRecording ?? "all").toLowerCase();
  if (mode === "off" || mode === "none" || mode === "disabled") return false;
  if (mode === "inbound_only") return direction === "INBOUND";
  // "all" or unrecognized — record
  return true;
}

const AI_START_FAILURE_APOLOGY =
  "We're sorry, our assistant is temporarily unavailable. Please leave your name and number after the tone, or call back shortly. Goodbye.";

export async function handleAiAssistantStartFailure(input: {
  workspaceId: string;
  callId: string;
  telnyxCallControlId: string;
  fromE164?: string | null;
  error: unknown;
}) {
  const prisma = getPrisma();
  const errMsg =
    input.error instanceof Error ? input.error.message : String(input.error);
  console.error("[voice/inbound] ai_assistant_start failed", input.error);

  let spoke = false;
  if (input.telnyxCallControlId && isTelnyxVoiceConfigured()) {
    try {
      await speakOnCall(input.telnyxCallControlId, AI_START_FAILURE_APOLOGY);
      spoke = true;
    } catch (speakErr) {
      console.warn(
        "[voice/inbound] ai_start failure apology speak failed",
        speakErr instanceof Error ? speakErr.message : speakErr,
      );
    }
  }

  const existing = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true, fromE164: true },
  });
  const prevMeta = (existing?.metadata || {}) as Record<string, unknown>;
  const fromPhone = input.fromE164 || existing?.fromE164 || "";

  await prisma.voiceCall
    .update({
      where: { id: input.callId },
      data: {
        outcome: "message_taken",
        status: "COMPLETED",
        endedAt: new Date(),
        metadata: {
          ...prevMeta,
          aiStarted: false,
          aiStartFailed: true,
          aiStartError: errMsg.slice(0, 500),
          structuredMessage: {
            callerName: "",
            phone: fromPhone,
            reason: "AI assistant failed to start — caller offered apology fallback",
            urgency: "normal",
            notes: spoke
              ? "Apology spoken via Call Control; no interactive message capture."
              : "Apology speak unavailable; take-message disposition recorded.",
          },
        } as object,
      },
    })
    .catch(() => undefined);

  await prisma.voiceCallEvent
    .create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        eventType: "media.ai_assistant_start_failed",
        payload: {
          error: errMsg.slice(0, 500),
          apologySpoken: spoke,
          disposition: "message_taken",
        } as object,
      },
    })
    .catch(() => undefined);

  await prisma.auditLog
    .create({
      data: {
        workspaceId: input.workspaceId,
        event: "voice.message_taken",
        detail: JSON.stringify({
          callId: input.callId,
          reason: "ai_assistant_start_failed",
          apologySpoken: spoke,
          phone: fromPhone,
        }),
      },
    })
    .catch(() => undefined);

  if (input.telnyxCallControlId && isTelnyxVoiceConfigured()) {
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/hangup`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
  }

  return { spoke, disposition: "message_taken" as const };
}

type InboundInput = {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  telnyxCallControlId?: string;
  payload?: Record<string, unknown>;
};

async function loadContactContext(workspaceId: string, from: string) {
  const prisma = getPrisma();
  const contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId, phone: from } },
  });
  if (!contact) {
    return {
      contact: null,
      contactTags: [],
      isKnownContact: false,
      department: null,
      language: null,
      intent: null,
    };
  }
  const tags = await prisma.contactTag.findMany({ where: { contactId: contact.id } });
  const contactTags = tags.map((t: { tagId: string }) => t.tagId);
  const cf = (contact.customFields || {}) as Record<string, unknown>;
  return {
    contact,
    contactTags,
    isKnownContact: true,
    department: cf.department ? String(cf.department) : null,
    language: cf.language ? String(cf.language) : null,
    intent: cf.intent ? String(cf.intent) : null,
  };
}

async function resolveRecordingDisclosure(workspaceId: string, agentId?: string | null) {
  const prisma = getPrisma();
  const compliance = await prisma.voiceComplianceProfile.findUnique({
    where: { workspaceId },
  });
  const complianceSettings = (compliance?.settings || {}) as Record<string, unknown>;
  if (complianceSettings.recordingDisclosureText) {
    return String(complianceSettings.recordingDisclosureText);
  }
  if (!agentId) return null;
  const agent = await prisma.voiceAgent.findUnique({ where: { id: agentId } });
  if (!agent) return null;
  const { loadVoiceAgentRuntimeConfig } = await import("./load-agent-config");
  const cfg = await loadVoiceAgentRuntimeConfig(agent.workspaceId, agentId);
  const fromCompliance = (cfg.compliance || {}) as Record<string, unknown>;
  if (fromCompliance.recordingDisclosureText) {
    return String(fromCompliance.recordingDisclosureText);
  }
  return null;
}

async function speakOnCall(callControlId: string, text: string) {
  if (!callControlId || callControlId.startsWith("mock_") || !isTelnyxVoiceConfigured()) return;
  await telnyxRequest(`/calls/${callControlId}/actions/speak`, {
    method: "POST",
    body: { payload: text, voice: "female", language: "en-US" },
  }).catch(() => undefined);
}

async function speakRecordingDisclosure(
  workspaceId: string,
  callId: string,
  callControlId: string,
  agentId?: string | null,
) {
  const text = await resolveRecordingDisclosure(workspaceId, agentId);
  if (!text?.trim()) return;
  await speakOnCall(callControlId, text.trim());
  await getPrisma().voiceCallEvent.create({
    data: {
      workspaceId,
      callId,
      eventType: "compliance.recording_disclosure",
      payload: { text } as object,
    },
  });
}

async function startAiOnInboundCall(input: {
  workspaceId: string;
  callId: string;
  agentId: string;
  telnyxCallControlId: string;
  contactName?: string;
  routing: Record<string, unknown>;
  payload?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) return { started: false, reason: "agent_missing" };

  const { assertAiCallAdmission } = await import("./platform/admission");
  const admission = await assertAiCallAdmission({
    workspaceId: input.workspaceId,
    agentId: agent.id,
    direction: "INBOUND",
    callId: input.callId,
  });
  if (!admission.ok) {
    return { started: false, reason: admission.code };
  }

  if (isTelnyxVoiceConfigured() && input.telnyxCallControlId) {
    // TeXML-direct agents never start AI via Call Control (already on assistant).
    {
      const { loadVoiceAgentRuntimeConfig } = await import("./load-agent-config");
      const { usesTexmlDirectInbound } = await import("./telnyx/texml-direct-route");
      const cfgPeek = await loadVoiceAgentRuntimeConfig(
        input.workspaceId,
        agent.id,
      );
      if (usesTexmlDirectInbound(cfgPeek)) {
        await prisma.voiceCallEvent
          .create({
            data: {
              workspaceId: input.workspaceId,
              callId: input.callId,
              eventType: "media.ai_start_skipped",
              payload: {
                reason: "texml_direct_inbound",
                path: "inbound_ai_start",
              } as object,
            },
          })
          .catch(() => undefined);
        return { started: false, reason: "texml_direct_inbound" };
      }
    }

    // Claim BEFORE answer/speak so call.answered cannot start a second mask/AI.
    const claim = await claimAiStart(input.callId);
    if (!claim.claimed) {
      return { started: false, reason: claim.reason || "ai_start_claimed" };
    }

    const answerAt = Date.now();
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/answer`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);

    await prisma.voiceCallEvent.create({
      data: {
        workspaceId: input.workspaceId,
        callId: input.callId,
        eventType: "media.answer_sent",
        payload: { at: answerAt } as object,
      },
    }).catch(() => undefined);

    if (agent.telnyxAssistantId) {
      const { loadVoiceAgentRuntimeConfig } = await import("./load-agent-config");
      const cfg = await loadVoiceAgentRuntimeConfig(input.workspaceId, agent.id);
      const { isGptLivePstnBridgeActive, shouldUseOpenAiRealtimeMediaBridge } = await import(
        "@/lib/voice/telnyx/openai-realtime-bridge/flags"
      );
      const gptLivePstn = isGptLivePstnBridgeActive();

      if (gptLivePstn && shouldUseOpenAiRealtimeMediaBridge(cfg)) {
        const bridgeStartAt = Date.now();
        const { startOpenAiRealtimeMediaBridgeOnCall } = await import(
          "@/lib/voice/telnyx/openai-realtime-bridge/start-on-call"
        );
        const callRow = await prisma.voiceCall.findUnique({ where: { id: input.callId } });
        const bridge = await startOpenAiRealtimeMediaBridgeOnCall({
          workspaceId: input.workspaceId,
          callId: input.callId,
          agentId: agent.id,
          telnyxCallControlId: input.telnyxCallControlId,
          fromE164: callRow?.fromE164,
        });
        await prisma.voiceCallEvent
          .create({
            data: {
              workspaceId: input.workspaceId,
              callId: input.callId,
              eventType: "media.live_fast_path_started",
              payload: {
                ms_since_answer: bridgeStartAt - answerAt,
                bridge_started: bridge.started,
                reason: bridge.reason ?? null,
              } as object,
            },
          })
          .catch(() => undefined);
        if (!bridge.started) {
          await handleAiAssistantStartFailure({
            workspaceId: input.workspaceId,
            callId: input.callId,
            telnyxCallControlId: input.telnyxCallControlId,
            error: new Error(bridge.reason || "live_bridge_start_failed"),
          });
          return { started: false, reason: bridge.reason || "live_bridge_start_failed" };
        }
        return { started: true };
      }

      // Inbound-only NS — do not process outbound AI playback.
      await startInboundNoiseSuppression(input.telnyxCallControlId);

      const startup = startupGreetingFromConfig(cfg);
      const outputGainDb = normalizeOutputGainDb(cfg.voiceLanguage?.outputGainDb);

      let disclosureSpoken = false;
      if (!gptLivePstn) {
        // Play prerecorded connection greeting immediately after answer, then
        // initialize the AI concurrently (do not wait for the clip to finish).
        const playMaskFirst =
          startup.enabled &&
          startup.mode === "audio_url" &&
          Boolean(startup.audioUrl);
        const concurrentMask =
          playMaskFirst &&
          (startup.connectionGreeting === "transovo_default" ||
            (typeof startup.delayMs === "number" && startup.delayMs <= 1000));

        if (!playMaskFirst) {
          await speakRecordingDisclosure(
            input.workspaceId,
            input.callId,
            input.telnyxCallControlId,
            agent.id,
          );
          disclosureSpoken = true;
        }

        const maskResult = await playStartupGreetingMask({
          workspaceId: input.workspaceId,
          callId: input.callId,
          callControlId: input.telnyxCallControlId,
          config: cfg,
          wait: concurrentMask ? false : undefined,
        });

        if (playMaskFirst && !concurrentMask) {
          await speakRecordingDisclosure(
            input.workspaceId,
            input.callId,
            input.telnyxCallControlId,
            agent.id,
          ).catch(() => undefined);
          disclosureSpoken = true;
        }

        if (startup.mode === "ai" || startup.mode === "none" || !maskResult.played) {
          await sleep(AI_MEDIA_SETTLE_MS);
        } else if (concurrentMask) {
          const settleMs =
            typeof startup.delayMs === "number" ? startup.delayMs : 500;
          await sleep(Math.max(0, Math.min(1000, settleMs)));
        }
      }

      const callRow = await prisma.voiceCall.findUnique({ where: { id: input.callId } });
      const { resolveCallDynamicVariables } = await import("./dynamic-variables");
      const dynamicVariables = gptLivePstn
        ? { output_gain_db: String(outputGainDb) }
        : await resolveCallDynamicVariables({
            workspaceId: input.workspaceId,
            agentId: agent.id,
            callId: input.callId,
            contactId: callRow?.contactId,
            fromE164: callRow?.fromE164,
            toE164: callRow?.toE164,
            direction: "INBOUND",
            overrides: (callRow?.dynamicVariables || null) as Record<string, unknown> | null,
          });
      if (!gptLivePstn) {
        if (input.contactName) dynamicVariables.full_name = input.contactName;
        dynamicVariables.output_gain_db = String(outputGainDb);
      }

      const speaksFirst =
        String(cfg.callHandling?.speaksFirst || "ai").toLowerCase() === "caller"
          ? "caller"
          : "ai";
      const recordingOn = shouldStartCallRecording(cfg.callHandling?.callRecording, "INBOUND");
      const compliance = (cfg.compliance || {}) as Record<string, unknown>;
      const disclosureText =
        !disclosureSpoken &&
        recordingOn &&
        (compliance.recordingDisclosure === true ||
          Boolean(compliance.recordingDisclosureText))
          ? String(
              compliance.recordingDisclosureText ||
                "This call may be recorded for quality and training purposes.",
            )
          : null;
      // If the caller speaks first, still speak recording disclosure when needed
      // (AI greeting path would otherwise skip it entirely).
      if (
        !gptLivePstn &&
        speaksFirst === "caller" &&
        disclosureText &&
        input.telnyxCallControlId
      ) {
        const { speakOnCallControl } = await import("./startup-greeting-runtime");
        await speakOnCallControl(input.telnyxCallControlId, disclosureText).catch(
          () => undefined,
        );
        disclosureSpoken = true;
      }

      const greeting =
        speaksFirst === "caller"
          ? null
          : resolveAiGreeting({
              config: cfg,
              agentName: agent.name || "our assistant",
              contactName: input.contactName,
              prependDisclosure: disclosureSpoken ? null : disclosureText,
            });

      const aiHandoffAt = Date.now();
      let aiStartOk = false;
      const { shouldUseOpenAiRealtimeMediaBridge } = await import(
        "@/lib/voice/telnyx/openai-realtime-bridge/flags"
      );
      const useRealtimeBridge = shouldUseOpenAiRealtimeMediaBridge(cfg);
      try {
        if (useRealtimeBridge) {
          const { startOpenAiRealtimeMediaBridgeOnCall } = await import(
            "@/lib/voice/telnyx/openai-realtime-bridge/start-on-call"
          );
          const callRow = await prisma.voiceCall.findUnique({ where: { id: input.callId } });
          const bridge = await startOpenAiRealtimeMediaBridgeOnCall({
            workspaceId: input.workspaceId,
            callId: input.callId,
            agentId: agent.id,
            telnyxCallControlId: input.telnyxCallControlId,
            fromE164: callRow?.fromE164,
          });
          if (!bridge.started) {
            throw new Error(bridge.reason || "realtime_bridge_start_failed");
          }
        } else {
          await startAiAssistantOnCall({
            callControlId: input.telnyxCallControlId,
            assistantId: agent.telnyxAssistantId,
            greeting: greeting || undefined,
            dynamicVariables,
            clientState: {
              workspaceId: input.workspaceId,
              callId: input.callId,
              agentId: agent.id,
              connectionGreetingPlaying: Boolean(concurrentMask || maskResult.concurrent),
            },
          });
        }
        aiStartOk = true;
      } catch (err) {
        await handleAiAssistantStartFailure({
          workspaceId: input.workspaceId,
          callId: input.callId,
          telnyxCallControlId: input.telnyxCallControlId,
          error: err,
        });
        return {
          started: false,
          reason: useRealtimeBridge ? "realtime_bridge_start_failed" : "ai_assistant_start_failed",
        };
      }

      if (!aiStartOk) {
        return { started: false, reason: "ai_assistant_start_failed" };
      }

      const assistantStartReturnedAt = Date.now();
      const { scheduleVoiceV2CallWarmup } = await import("@/lib/voice-v2/call-warmup");
      scheduleVoiceV2CallWarmup({
        workspaceId: input.workspaceId,
        agentId: agent.id,
        callId: input.callId,
        callControlId: input.telnyxCallControlId,
        fromE164: callRow?.fromE164,
        agentConfig: cfg,
        assistantStartReturnedAt,
        warmupScheduledAt: Date.now(),
      });

      const pstnDiag = buildPstnAudioDiagnostics({
        callControlId: input.telnyxCallControlId,
        outputGainDb,
        startupGreetingMode: startup.mode,
        noiseSuppressionInbound: true,
      });

      await prisma.voiceCallEvent.create({
        data: {
          workspaceId: input.workspaceId,
          callId: input.callId,
          eventType: "media.ai_assistant_start",
          payload: {
            at: aiHandoffAt,
            ASSISTANT_START_RETURNED_AT: assistantStartReturnedAt,
            answerToAiMs: aiHandoffAt - answerAt,
            startupMask: maskResult,
            greetingPreview: (greeting || "").slice(0, 160),
            speaksFirst,
            path: "inbound_initiated",
            pstnAudio: pstnDiag,
            transcodesEstimate: 1,
          } as object,
        },
      }).catch(() => undefined);

      if (shouldStartCallRecording(cfg.callHandling?.callRecording, "INBOUND")) {
        void startCallRecording(input.telnyxCallControlId);
      }
      void startCallTranscription(input.telnyxCallControlId);

      const { resolveAiVersionStamp } = await import("./platform/admission");
      const versionStamp = await resolveAiVersionStamp({
        workspaceId: input.workspaceId,
        agentId: agent.id,
        publishedVersionId: agent.publishedVersionId,
      });

      await prisma.voiceCall.update({
        where: { id: input.callId },
        data: {
          status: "IN_PROGRESS",
          answeredAt: new Date(),
          agentVersionId: versionStamp.agentVersionId,
          dynamicVariables: dynamicVariables as object,
          metadata: {
            ...claim.meta,
            routing: input.routing,
            payload: input.payload,
            aiStarted: true,
            aiStartClaimed: true,
            assistantId: agent.telnyxAssistantId,
            transcriptionStarted: true,
            assistantVersionId: versionStamp.assistantVersionId,
            canaryVersionId: versionStamp.canaryVersionId,
            canaryActive: versionStamp.canaryActive,
            mediaPipeline: {
              answerAt,
              aiHandoffAt,
              answerToAiMs: aiHandoffAt - answerAt,
              startupMask: maskResult,
              settleMs: AI_MEDIA_SETTLE_MS,
              greetingPreview: (greeting || "").slice(0, 160),
              speaksFirst,
              path: "inbound_initiated",
              transcodesEstimate: 1,
            },
            pstnAudio: pstnDiag,
          } as object,
        },
      });
      return { started: true, assistantId: agent.telnyxAssistantId };
    }
  }

  return { started: false, reason: "telnyx_not_configured_or_no_assistant" };
}

async function executeHumanFirst(input: {
  workspaceId: string;
  callId: string;
  fromE164: string;
  toE164: string;
  telnyxCallControlId?: string;
  routing: Record<string, unknown>;
  actions?: Record<string, unknown>;
}) {
  const timeoutSeconds = resolveRingTimeoutSeconds(input.actions, 30);
  const queueId = input.actions?.queueId as string | undefined;
  const agentId = input.actions?.agentId as string | undefined;

  let humanCallId: string | undefined;
  if (input.telnyxCallControlId) {
    const { handleInboundHumanCall } = await import("@/lib/phone/human-call-service");
    const human = await handleInboundHumanCall({
      workspaceId: input.workspaceId,
      fromE164: input.fromE164,
      toE164: input.toE164,
      telnyxCallControlId: input.telnyxCallControlId,
      queueId: queueId || null,
      routingNote: `voice_human_first:${input.callId}`,
    });
    humanCallId = human.callId;
  }

  await getPrisma().voiceCall.update({
    where: { id: input.callId },
    data: {
      metadata: {
        routing: input.routing,
        humanFirst: true,
        humanCallId,
        queueId,
        fallbackAgentId: agentId,
      } as object,
    },
  });

  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  await enqueueJob({
    jobType: "voice_human_first_timeout",
    queueName: "voice-calls",
    workspaceId: input.workspaceId,
    payload: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      humanCallId,
      telnyxCallControlId: input.telnyxCallControlId,
      agentId,
    },
    idempotencyKey: `human-first-timeout-${input.callId}`,
    runAfter: new Date(Date.now() + timeoutSeconds * 1000),
  });

  return { humanCallId, timeoutSeconds };
}

async function executeTransfer(input: {
  workspaceId: string;
  callId: string;
  destination: string;
  telnyxCallControlId?: string;
  transferType?: string;
  summary?: string;
}) {
  if (!input.destination) throw new Error("Transfer destination required");
  const { initiateTransfer } = await import("./transfers");
  return initiateTransfer({
    workspaceId: input.workspaceId,
    callId: input.callId,
    destination: input.destination,
    transferType: input.transferType || "cold_transfer",
    summary: input.summary,
  });
}

async function executeVoicemail(input: {
  workspaceId: string;
  callId: string;
  telnyxCallControlId?: string;
  greetingText?: string;
  agentId?: string | null;
}) {
  const prisma = getPrisma();
  let greeting =
    input.greetingText ||
    "Please leave a message after the tone and we will get back to you soon.";

  if (!input.greetingText && input.agentId) {
    const agent = await prisma.voiceAgent.findUnique({ where: { id: input.agentId } });
    if (agent) {
      const { loadVoiceAgentRuntimeConfig } = await import("./load-agent-config");
      const cfg = await loadVoiceAgentRuntimeConfig(agent.workspaceId, agent.id);
      const vm = (cfg.voicemail || {}) as Record<string, unknown>;
      if (vm.greetingText) greeting = String(vm.greetingText);
    }
  }

  if (input.telnyxCallControlId && isTelnyxVoiceConfigured()) {
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/answer`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
    await speakOnCall(input.telnyxCallControlId, greeting);
    await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/record_start`, {
      method: "POST",
      body: { format: "mp3", channels: "single", play_beep: true, max_length: 180 },
    }).catch(() => undefined);
  }

  await prisma.voiceCall.update({
    where: { id: input.callId },
    data: { status: "VOICEMAIL", voicemailDetected: true },
  });

  await prisma.voiceCallEvent.create({
    data: {
      workspaceId: input.workspaceId,
      callId: input.callId,
      eventType: "inbound.voicemail",
      payload: { greeting } as object,
    },
  });

  return { ok: true };
}

async function executeHangup(telnyxCallControlId?: string) {
  if (telnyxCallControlId && isTelnyxVoiceConfigured() && !telnyxCallControlId.startsWith("mock_")) {
    await telnyxRequest(`/calls/${telnyxCallControlId}/actions/hangup`, {
      method: "POST",
      body: {},
    }).catch(() => undefined);
  }
  return { ok: true };
}

async function executeOverflow(input: {
  workspaceId: string;
  callId: string;
  telnyxCallControlId?: string;
  actions?: Record<string, unknown>;
  routing: Record<string, unknown>;
  agentId?: string | null;
  fromE164: string;
  toE164: string;
}) {
  const overflowType = String(input.actions?.overflowType || input.actions?.type || "transfer");
  const destination = String(input.actions?.destination || input.actions?.overflowTarget || "");
  const overflowAgentId = String(
    input.actions?.agentId || input.actions?.overflowAgentId || input.agentId || "",
  );

  if (overflowType === "ai_agent" && overflowAgentId) {
    return startAiOnInboundCall({
      workspaceId: input.workspaceId,
      callId: input.callId,
      agentId: overflowAgentId,
      telnyxCallControlId: input.telnyxCallControlId || "",
      routing: input.routing,
    });
  }

  if (overflowType === "voicemail") {
    return executeVoicemail({
      workspaceId: input.workspaceId,
      callId: input.callId,
      telnyxCallControlId: input.telnyxCallControlId,
      agentId: input.agentId,
    });
  }

  if (overflowType === "hangup") {
    await executeHangup(input.telnyxCallControlId);
    await getPrisma().voiceCall.update({
      where: { id: input.callId },
      data: { status: "COMPLETED", endedAt: new Date() },
    });
    return { ok: true, action: "hangup" };
  }

  if (destination) {
    return executeTransfer({
      workspaceId: input.workspaceId,
      callId: input.callId,
      destination,
      telnyxCallControlId: input.telnyxCallControlId,
    });
  }

  return executeHumanFirst({
    workspaceId: input.workspaceId,
    callId: input.callId,
    fromE164: input.fromE164,
    toE164: input.toE164,
    telnyxCallControlId: input.telnyxCallControlId,
    routing: input.routing,
    actions: input.actions,
  });
}

async function resolveEffectiveAction(
  workspaceId: string,
  action: string,
  actions?: Record<string, unknown>,
  now = new Date(),
) {
  if (action !== "ai_after_hours") return action;

  const settings = await getMessagingRuntimeSettings(workspaceId);
  const effective = applyActionTimezone(settings, actions);
  const withinHours = isWithinBusinessHours(effective, now);
  if (withinHours) return "human_first";
  return "ai_answer";
}

export async function executeInboundRoutingAction(input: {
  workspaceId: string;
  callId: string;
  routing: {
    action: string;
    agentId?: string;
    destination?: string;
    queueId?: string;
    actions?: Record<string, unknown>;
  };
  fromE164: string;
  toE164: string;
  telnyxCallControlId?: string;
  contactName?: string;
  payload?: Record<string, unknown>;
}) {
  const action = await resolveEffectiveAction(
    input.workspaceId,
    input.routing.action,
    input.routing.actions,
  );
  const actions = input.routing.actions || {};
  const agentId = input.routing.agentId || (actions.agentId as string | undefined);

  switch (action) {
    case "ai_answer":
      if (!agentId) return { ok: false, reason: "no_agent" };
      return startAiOnInboundCall({
        workspaceId: input.workspaceId,
        callId: input.callId,
        agentId,
        telnyxCallControlId: input.telnyxCallControlId || "",
        contactName: input.contactName,
        routing: input.routing as Record<string, unknown>,
        payload: input.payload,
      });

    case "human_first":
      return executeHumanFirst({
        workspaceId: input.workspaceId,
        callId: input.callId,
        fromE164: input.fromE164,
        toE164: input.toE164,
        telnyxCallControlId: input.telnyxCallControlId,
        routing: input.routing as Record<string, unknown>,
        actions: { ...actions, agentId, queueId: input.routing.queueId },
      });

    case "transfer":
      return executeTransfer({
        workspaceId: input.workspaceId,
        callId: input.callId,
        destination: input.routing.destination || String(actions.destination || ""),
        telnyxCallControlId: input.telnyxCallControlId,
        transferType: String(actions.transferType || "cold_transfer"),
        summary: String(actions.summary || ""),
      });

    case "voicemail":
      return executeVoicemail({
        workspaceId: input.workspaceId,
        callId: input.callId,
        telnyxCallControlId: input.telnyxCallControlId,
        greetingText: actions.greetingText ? String(actions.greetingText) : undefined,
        agentId,
      });

    case "hangup":
      await executeHangup(input.telnyxCallControlId);
      await getPrisma().voiceCall.update({
        where: { id: input.callId },
        data: { status: "COMPLETED", endedAt: new Date() },
      });
      return { ok: true, action: "hangup" };

    case "overflow":
      return executeOverflow({
        workspaceId: input.workspaceId,
        callId: input.callId,
        telnyxCallControlId: input.telnyxCallControlId,
        actions,
        routing: input.routing as Record<string, unknown>,
        agentId,
        fromE164: input.fromE164,
        toE164: input.toE164,
      });

    default:
      if (agentId) {
        return startAiOnInboundCall({
          workspaceId: input.workspaceId,
          callId: input.callId,
          agentId,
          telnyxCallControlId: input.telnyxCallControlId || "",
          contactName: input.contactName,
          routing: input.routing as Record<string, unknown>,
          payload: input.payload,
        });
      }
      return { ok: false, reason: `unknown_action:${action}` };
  }
}

/** Fallback to AI when human-first ring times out without an answer. */
export async function handleHumanFirstTimeoutJob(payload: {
  workspaceId: string;
  callId: string;
  humanCallId?: string;
  telnyxCallControlId?: string;
  agentId?: string;
}) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: payload.callId, workspaceId: payload.workspaceId },
  });
  if (!call) return { skipped: true, reason: "call_missing" };

  const meta = (call.metadata || {}) as Record<string, unknown>;
  if (meta.aiStarted) return { skipped: true, reason: "ai_already_started" };

  if (payload.humanCallId) {
    const human = await prisma.humanCall.findUnique({ where: { id: payload.humanCallId } });
    if (human && ["in_progress", "completed", "answered"].includes(human.status)) {
      return { skipped: true, reason: "human_answered" };
    }
  }

  const agentId =
    payload.agentId ||
    (meta.fallbackAgentId as string | undefined) ||
    call.agentId ||
    undefined;
  if (!agentId) return { skipped: true, reason: "no_fallback_agent" };

  const controlId = payload.telnyxCallControlId || call.telnyxCallControlId || "";
  const result = await startAiOnInboundCall({
    workspaceId: payload.workspaceId,
    callId: call.id,
    agentId,
    telnyxCallControlId: controlId,
    routing: (meta.routing as Record<string, unknown>) || {},
  });

  await prisma.voiceCallEvent.create({
    data: {
      workspaceId: payload.workspaceId,
      callId: call.id,
      eventType: "inbound.human_first_timeout",
      payload: { agentId, result } as object,
    },
  });

  return { ok: true, ...result };
}

export async function handleInboundCallEvent(input: InboundInput) {
  const prisma = getPrisma();
  const from = normalizeE164(input.fromE164);
  const to = input.toE164;

  const { contact, contactTags, isKnownContact, department, language, intent } =
    await loadContactContext(input.workspaceId, from);

  const forcedAgentIdRaw =
    typeof input.payload?.forcedAgentId === "string" ? input.payload.forcedAgentId : null;
  const forcedAgent = forcedAgentIdRaw
    ? await prisma.voiceAgent.findFirst({
        where: { id: forcedAgentIdRaw, workspaceId: input.workspaceId },
        select: { id: true },
      })
    : null;
  const forcedAgentId = forcedAgent?.id || null;

  let routing = await evaluateInboundRouting({
    workspaceId: input.workspaceId,
    fromE164: from,
    toE164: to,
    contactId: contact?.id,
    contactTags,
    isKnownContact,
    department,
    language,
    intent,
  });

  if (forcedAgentId) {
    routing = {
      ...routing,
      action: "ai_answer",
      agentId: forcedAgentId,
      actions: { ...(routing.actions || {}), agentId: forcedAgentId, forced: true },
    };
  }

  const pn = await prisma.phoneNumber.findFirst({
    where: { workspaceId: input.workspaceId, e164: to },
  });

  const inboundAgentId = forcedAgentId || routing.agentId || null;
  let inboundAgentVersionId: string | null = null;
  if (inboundAgentId) {
    const inboundAgent = await prisma.voiceAgent.findFirst({
      where: { id: inboundAgentId, workspaceId: input.workspaceId },
      select: { publishedVersionId: true },
    });
    inboundAgentVersionId = inboundAgent?.publishedVersionId || null;
  }

  const call = await prisma.voiceCall.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: inboundAgentId,
      agentVersionId: inboundAgentVersionId,
      contactId: contact?.id,
      direction: "INBOUND",
      status: "RINGING",
      fromE164: from,
      toE164: to,
      phoneNumberId: pn?.id,
      telnyxCallControlId: input.telnyxCallControlId,
      metadata: { routing, payload: input.payload } as object,
    },
  });

  // Bind workflow execution for live TriggerDeployments (orchestration only —
  // TeXML already launched the assistant; worker is not in the audio path).
  try {
    const {
      ensureInboundCallerContact,
      enrollInboundCallTriggers,
    } = await import("@/lib/automations/inbound-trigger-enroll");
    let contactId = contact?.id || null;
    if (!contactId && from) {
      const ensured = await ensureInboundCallerContact({
        workspaceId: input.workspaceId,
        fromE164: from,
      });
      contactId = ensured.id;
      await prisma.voiceCall.update({
        where: { id: call.id },
        data: { contactId },
      });
    }
    if (contactId && pn?.id) {
      const enrollments = await enrollInboundCallTriggers({
        workspaceId: input.workspaceId,
        callId: call.id,
        phoneNumberId: pn.id,
        contactId,
        agentId: inboundAgentId,
        eventType: "every_call",
      });
      if (enrollments.length) {
        await prisma.voiceCallEvent
          .create({
            data: {
              workspaceId: input.workspaceId,
              callId: call.id,
              eventType: "inbound.workflow_enrolled",
              payload: { enrollments } as object,
            },
          })
          .catch(() => undefined);
      }
    }
  } catch (err) {
    console.error("[inbound] workflow enroll failed", err);
  }

  const contactName = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ");

  const actionResult = await executeInboundRoutingAction({
    workspaceId: input.workspaceId,
    callId: call.id,
    routing,
    fromE164: from,
    toE164: to,
    telnyxCallControlId: input.telnyxCallControlId,
    contactName: contactName || undefined,
    payload: input.payload,
  });

  await prisma.voiceCallEvent.create({
    data: {
      workspaceId: input.workspaceId,
      callId: call.id,
      eventType: "inbound.routed",
      payload: { routing, actionResult } as object,
    },
  });

  return { callId: call.id, routing, actionResult };
}
