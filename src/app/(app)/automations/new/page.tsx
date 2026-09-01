"use client";

import { Button } from "@/components/ui/button";
import {
  buildAutomationDefinitionFromTemplate,
  getIntegrationTemplate,
} from "@/lib/automations/integration-templates";
import {
  buildAutomationDefinitionFromCampaignPlaybook,
  campaignPlaybookAutomationName,
} from "@/lib/campaigns/playbook-automation";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function NewAutomationPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setSlow(true);
    }, 6000);

    async function create() {
      try {
        // Optional starter template — seeds a trigger + suggested actions.
        // Templates never auto-activate; the new flow is always created as DRAFT.
        const params = new URLSearchParams(window.location.search);
        const templateId = params.get("template");
        const playbookId = params.get("playbook");
        const template = templateId ? getIntegrationTemplate(templateId) : null;
        const playbookDefinition = playbookId
          ? buildAutomationDefinitionFromCampaignPlaybook(playbookId)
          : null;
        const stamp = new Date()
          .toISOString()
          .slice(5, 16)
          .replace("T", " ");
        const body: {
          name: string;
          definition?: ReturnType<typeof buildAutomationDefinitionFromTemplate>;
        } = template
          ? { name: template.title, definition: buildAutomationDefinitionFromTemplate(template) }
          : playbookDefinition
            ? {
                name: campaignPlaybookAutomationName(playbookId!) || `New automation · ${stamp}`,
                definition: playbookDefinition,
              }
            : { name: `New automation · ${stamp}` };

        const res = await fetch("/api/automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to create automation");
        const flowId = json?.data?.id;
        if (!flowId) throw new Error("No automation id returned");

        redirectedRef.current = true;
        router.replace(`/automations/${flowId}/edit?setup=1`);

        // Mobile browsers sometimes ignore router.replace — hard fallback
        window.setTimeout(() => {
          if (window.location.pathname.includes("/automations/new")) {
            window.location.assign(`/automations/${flowId}/edit?setup=1`);
          }
        }, 1500);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to create");
        }
      }
    }

    create().finally(() => {
      window.clearTimeout(slowTimer);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
    };
  }, [router]);

  function retry() {
    setError("");
    setSlow(false);
    window.location.reload();
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 text-sm text-muted-foreground">
      {error ? (
        <>
          <p className="text-rose-600 text-center">{error}</p>
          <Button size="sm" variant="outline" onClick={retry}>Try again</Button>
        </>
      ) : (
        <>
          <p>Creating new automation…</p>
          {slow ? (
            <p className="text-xs text-center max-w-sm">
              Still working — slow connection. If this does not open,{" "}
              <button type="button" className="text-primary underline" onClick={retry}>
                tap here to retry
              </button>
              .
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
