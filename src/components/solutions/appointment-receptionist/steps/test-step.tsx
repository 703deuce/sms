"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { VoiceV3BrowserCall } from "@/components/voice/voice-v3-browser-call";
import { EmptyState, Rows } from "@/newui-transplant/components/app/kit";
import { OpusDensePanel, OpusInlineAlert } from "../wizard-opus-ui";
import { pickWizardFieldComponents } from "../wizard-field-kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/newui-transplant/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Phone, Play, Monitor } from "lucide-react";
import { useState } from "react";
import { InfoCallout, SidePanel } from "../ui";

export function TestStep({
  state,
  patch,
  onEnsureAgent,
  presentation = "legacy",
}: {
  state: AppointmentReceptionistWizardState;
  patch: (p: Partial<AppointmentReceptionistWizardState>) => void;
  onEnsureAgent?: () => Promise<{ agentId: string; telnyxAssistantId?: string | null } | null>;
  presentation?: "legacy" | "mctb" | "opus";
}) {
  const isMctb = presentation === "mctb";
  const isOpus = presentation === "opus";
  const { Button } = pickWizardFieldComponents(presentation);
  const [mode, setMode] = useState<"browser" | "phone">("browser");
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState("");
  const [liveProbeSource, setLiveProbeSource] = useState<string | null>(null);

  async function prepareLiveTest() {
    if (!onEnsureAgent) {
      setPrepareError("Save the draft first so we can start a Voice V3 live test.");
      return null;
    }
    setPreparing(true);
    setPrepareError("");
    try {
      const result = await onEnsureAgent();
      if (!result?.agentId) {
        setPrepareError("Could not create or update the draft agent.");
        return null;
      }
      patch({ agentId: result.agentId });
      return result;
    } catch (err) {
      setPrepareError(err instanceof Error ? err.message : "Prepare failed");
      return null;
    } finally {
      setPreparing(false);
    }
  }

  if (isOpus) {
    const draftStatus =
      liveProbeSource === "wizard_draft_test"
        ? "Connected (draft config)"
        : state.agentId
          ? "Ready — use browser test"
          : "Save draft first";

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "browser" | "phone")}
            className="gap-0"
          >
            <TabsList>
              <TabsTrigger value="browser">
                <Monitor />
                Test in browser
              </TabsTrigger>
              <TabsTrigger value="phone">
                <Phone />
                After activate (phone)
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            size="sm"
            variant="outline"
            disabled={preparing}
            onClick={() => void prepareLiveTest()}
          >
            {preparing ? "Saving…" : "Save draft for test"}
          </Button>
        </div>

        {prepareError ? (
          <OpusInlineAlert isOpus>{prepareError}</OpusInlineAlert>
        ) : null}

        <Rows
          items={[
            { label: "Selected voice", value: state.voiceLabel || state.voiceId || "—" },
            { label: "Draft live test", value: draftStatus },
          ]}
        />

        {mode === "browser" ? (
          state.agentId ? (
            <VoiceV3BrowserCall
              agentId={state.agentId}
              voiceLabel={state.voiceLabel}
              onNeedSave={() => prepareLiveTest().then(() => undefined)}
              onSessionSuccess={(probe) => {
                setLiveProbeSource(probe.source);
              }}
            />
          ) : (
            <OpusDensePanel bodyClassName="p-0">
              <EmptyState
                icon={Play}
                title="Start a browser conversation"
                description={`We'll save your draft and connect GPT-Live using voice ${state.voiceLabel} (${state.voiceId}).`}
                action={
                  <Button disabled={preparing} onClick={() => void prepareLiveTest()}>
                    <Play />
                    {preparing ? "Building…" : "Build & start live test"}
                  </Button>
                }
              />
            </OpusDensePanel>
          )
        ) : (
          <OpusDensePanel title="Test on your phone after activate">
            <p className="text-sm text-muted-foreground">
              Call your assigned number from another phone after you go live. Browser WebRTC is the
              fastest way to try changes while editing.
            </p>
            {state.phoneNumberE164 ? (
              <p className="mt-3 text-xs">
                Number: <span className="font-medium">{state.phoneNumberE164}</span>
              </p>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Assign a phone number before relying on PSTN testing.
              </p>
            )}
          </OpusDensePanel>
        )}

        <p className="text-xs text-muted-foreground">
          Change voice, greeting, or booking settings, save, then start a new browser test before you
          publish.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight">
            {isMctb ? "Test your voice agent" : "Test your receptionist"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Talk to your agent with the current saved draft configuration before you activate. This
            uses the same Voice V3 compiler path as production — no automated certification.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as "browser" | "phone")}
              className="gap-0"
            >
              <TabsList>
                <TabsTrigger value="browser">
                  <Monitor className="h-3.5 w-3.5" />
                  Test in browser
                </TabsTrigger>
                <TabsTrigger value="phone">
                  <Phone className="h-3.5 w-3.5" />
                  After activate (phone)
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              size="sm"
              variant="outline"
              disabled={preparing}
              onClick={() => void prepareLiveTest()}
            >
              {preparing ? "Saving…" : "Save draft for test"}
            </Button>
          </div>

          {prepareError ? (
            <p className="border-b border-border bg-danger/5 px-4 py-2 text-xs text-danger">
              {prepareError}
            </p>
          ) : null}

          <div className="p-4">
            {mode === "browser" ? (
              state.agentId ? (
                <VoiceV3BrowserCall
                  agentId={state.agentId}
                  voiceLabel={state.voiceLabel}
                  onNeedSave={() => prepareLiveTest().then(() => undefined)}
                  onSessionSuccess={(probe) => {
                    setLiveProbeSource(probe.source);
                  }}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <p className="text-sm font-medium">Start a browser conversation</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    We&apos;ll save your wizard draft and connect OpenAI GPT-Live using voice{" "}
                    {state.voiceLabel} ({state.voiceId}).
                  </p>
                  <Button
                    className="mt-4"
                    disabled={preparing}
                    onClick={() => void prepareLiveTest()}
                  >
                    <Play className="h-3.5 w-3.5" />
                    {preparing ? "Building…" : "Build & start live test"}
                  </Button>
                </div>
              )
            ) : (
              <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm">
                <p className="font-medium">Test on your phone after activate</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Once activated, call your assigned number from another phone to hear the agent on
                  the PSTN. Browser WebRTC above is the fastest way to try changes while editing.
                </p>
                {state.phoneNumberE164 ? (
                  <p className="mt-3 text-xs">
                    Number:{" "}
                    <span className="font-medium text-foreground">{state.phoneNumberE164}</span>
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Assign a phone number on the Phone step first.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <InfoCallout>
          Tip: change voice, greeting, or booking settings, save, then start a new browser test. When
          you are satisfied, continue to Activate to publish for the next routed call.
        </InfoCallout>
      </div>

      <SidePanel title="Test">
        <div className="space-y-3 text-xs">
          <div className="rounded-xl border border-border p-3">
            <p className="text-muted-foreground">Selected voice</p>
            <p className="mt-1 text-sm font-semibold">{state.voiceLabel || state.voiceId}</p>
          </div>
          <div className="rounded-xl border border-border p-3">
            <p className="text-muted-foreground">Draft live test</p>
            <p className="mt-1 text-sm font-semibold">
              {liveProbeSource === "wizard_draft_test"
                ? "Connected (draft config)"
                : state.agentId
                  ? "Ready — use browser test"
                  : "Save draft first"}
            </p>
          </div>
        </div>
      </SidePanel>
    </div>
  );
}
