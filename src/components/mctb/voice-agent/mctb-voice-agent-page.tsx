"use client";

import { AppointmentReceptionistWizard } from "@/components/solutions/appointment-receptionist/wizard";
import { CallHandlingModeSwitch } from "@/components/mctb/voice-agent/call-handling-mode-switch";
import { MctbPageContainer } from "@/components/mctb/shell/mctb-page-container";
import { Button } from "@/components/ui/button";
import { useCallback, useState } from "react";
import "./mctb-voice-agent.css";

type AgentStatus = "draft" | "active" | "needs_attention" | null;

export function MctbVoiceAgentPage() {
  const [agentStatus, setAgentStatus] = useState<AgentStatus>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState("After-Hours Voice Agent");
  const onAgentStatusChange = useCallback((status: AgentStatus) => {
    setAgentStatus(status);
  }, []);

  const statusLabel =
    agentStatus === "active"
      ? "Active"
      : agentStatus === "draft"
        ? "Draft"
        : agentStatus === "needs_attention"
          ? "Needs attention"
          : null;

  const statusClass =
    agentStatus === "active"
      ? "mctb-va-status-pill--active"
      : agentStatus === "needs_attention"
        ? "mctb-va-status-pill--warn"
        : "mctb-va-status-pill--draft";

  return (
    <MctbPageContainer>
      <div className="mctb-va-page">
        <header className="mctb-va-header">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="mctb-va-title">{pageTitle}</h1>
              {statusLabel ? (
                <span className={`mctb-va-status-pill ${statusClass}`}>{statusLabel}</span>
              ) : null}
            </div>
            <p className="mctb-va-subtitle">
              Answer missed and after-hours calls with an AI agent that follows your business
              rules.
            </p>
          </div>
          <div className="mctb-va-header-actions">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                const el = document.querySelector("[data-testid='wizard-continue']");
                (el as HTMLButtonElement | null)?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Test agent
            </Button>
          </div>
        </header>

        <CallHandlingModeSwitch
          voiceAgentId={agentId}
          agentReady={agentStatus === "active"}
        />

        <AppointmentReceptionistWizard
          presentation="mctb"
          onAgentStatusChange={onAgentStatusChange}
          onAgentIdChange={setAgentId}
          onSolutionNameChange={setPageTitle}
        />
      </div>
    </MctbPageContainer>
  );
}
