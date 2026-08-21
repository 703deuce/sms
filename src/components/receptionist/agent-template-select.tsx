"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

type TemplateOption = {
  id: string;
  name: string;
  purpose: string;
  runtimeStatus: string;
};

export function AgentTemplateSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (templateId: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/voice/templates")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const rows = (j.data || []) as Array<{
          id: string;
          name: string;
          purpose: string;
          runtimeStatus?: string;
          status?: string;
        }>;
        const selectable = rows
          .filter((t) => {
            const status = t.runtimeStatus || t.status || "";
            return status !== "COMPOSED_UNVERIFIED";
          })
          .map((t) => ({
            id: t.id,
            name: t.name,
            purpose: t.purpose,
            runtimeStatus: t.runtimeStatus || t.status || "UNKNOWN",
          }));
        setTemplates(selectable);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = templates.find((t) => t.id === value);

  return (
    <div className={cn("space-y-2", className)}>
      <select
        className="w-full rounded-xl border border-[#e6e8ef] bg-white px-3 py-2.5 text-sm text-[#111827]"
        value={value}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
      >
        {loading ? <option value={value}>Loading templates…</option> : null}
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.runtimeStatus})
          </option>
        ))}
      </select>
      {selected ? (
        <p className="text-xs text-[#6b7280]">{selected.purpose}</p>
      ) : (
        <p className="text-xs text-[#6b7280]">
          This template controls which LiveKit agent answers calls for this receptionist.
        </p>
      )}
    </div>
  );
}
