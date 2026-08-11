"use client";

import { IntentFieldEditor } from "@/components/realtor/intent-field-editor";
import { RealtorAgentStatusPanel } from "@/components/realtor/agent-status-panel";
import { RealtorWorkflowPreview } from "@/components/realtor/workflow-preview";
import { Card, CardTitle } from "@/components/ui/card";
import type { AutomationDefinition } from "@/lib/automations/types";
import type { RealtorProductConfig } from "@/lib/realtor/types";
import type { CompiledIntentConfig } from "@/lib/voice/real-estate/compile/types";
import type { QualificationFieldDefinition } from "@/lib/voice/outbound/types";
import { useState } from "react";

type Props = {
  config: RealtorProductConfig;
  agentLabel: "Front Desk" | "Speed-to-Lead";
  templateKey: string;
  deployedAgentId?: string;
  publishedVersionId?: string;
  workflowDefinition?: AutomationDefinition;
  intents?: Record<string, CompiledIntentConfig>;
  qualificationFields?: QualificationFieldDefinition[];
};

export function RealtorAgentDetailClient({
  config: initialConfig,
  agentLabel,
  templateKey,
  deployedAgentId,
  publishedVersionId,
  workflowDefinition,
  intents,
  qualificationFields,
}: Props) {
  const [config, setConfig] = useState(initialConfig);

  return (
    <div className="space-y-6">
      <RealtorAgentStatusPanel config={config} agentLabel={agentLabel} onUpdated={setConfig} />

      <Card className="p-4 space-y-2 text-sm">
        <p>Template: {templateKey}</p>
        <p>Deployed agent: {deployedAgentId || "Not deployed"}</p>
        <p>Published version: {publishedVersionId || "—"}</p>
        <p>Config version: {config.compiledVersion ?? 0}</p>
      </Card>

      {workflowDefinition ? (
        <Card className="p-4">
          <CardTitle className="mb-3">Workflow (from your configuration)</CardTitle>
          <p className="mb-3 text-sm text-muted-foreground">
            Branches reflect enabled intents and outcomes — not a generic template diagram.
          </p>
          <RealtorWorkflowPreview definition={workflowDefinition} />
        </Card>
      ) : null}

      {agentLabel === "Front Desk" && intents ? (
        <Card className="p-4 space-y-6">
          <CardTitle>Qualification schemas</CardTitle>
          {config.frontDesk.buyer.enabled ? (
            <IntentFieldEditor
              intent="buyer"
              title="Buyer"
              config={config.frontDesk.buyer}
              onChange={(buyer) => setConfig({ ...config, frontDesk: { ...config.frontDesk, buyer } })}
            />
          ) : null}
          {config.frontDesk.seller.enabled ? (
            <IntentFieldEditor
              intent="seller"
              title="Seller"
              config={config.frontDesk.seller}
              onChange={(seller) => setConfig({ ...config, frontDesk: { ...config.frontDesk, seller } })}
            />
          ) : null}
        </Card>
      ) : null}

      {agentLabel === "Speed-to-Lead" && qualificationFields?.length ? (
        <Card className="p-4">
          <CardTitle className="mb-3">Qualification fields</CardTitle>
          <ul className="space-y-1 text-sm">
            {qualificationFields.map((f) => (
              <li key={f.field_id}>
                {f.label} {f.required ? "(required)" : "(optional)"}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <SaveDraftButton config={config} onSaved={setConfig} />
    </div>
  );
}

function SaveDraftButton({
  config,
  onSaved,
}: {
  config: RealtorProductConfig;
  onSaved: (c: RealtorProductConfig) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/realtor/agents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "save_draft", config }),
          });
          const json = await res.json();
          if (json.config) onSaved(json.config);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Saving…" : "Save draft configuration"}
    </button>
  );
}
