"use client";

import Link from "next/link";

export default function AutomationEditHeader({
  flowName,
}: {
  flowName: string;
}) {
  return (
    <div className="kimi-automations mb-4 flex items-center justify-between border-b border-border bg-card px-5 py-3 rounded-t-xl">
      <div>
        <p className="text-[11px] text-muted-foreground">
          <Link href="/automations" className="hover:text-indigo-600 hover:underline">
            Automations
          </Link>
          {" / "}
          <span className="text-foreground">Edit Workflow</span>
        </p>
        <h1 className="mt-0.5 text-[18px] font-bold" style={{ color: "var(--navy)" }}>
          {flowName || "Edit Workflow"}
        </h1>
        <p className="text-[11.5px] text-muted-foreground">
          Build workflows by dragging blocks onto the canvas and connecting them.
        </p>
      </div>
    </div>
  );
}
