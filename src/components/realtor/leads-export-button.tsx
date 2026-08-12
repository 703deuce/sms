"use client";

import type { RealtorLeadRow } from "@/lib/realtor/types";
import { Download } from "lucide-react";

export function LeadsExportButton({ leads }: { leads: RealtorLeadRow[] }) {
  function exportCsv() {
    const headers = ["Name", "Phone", "Type", "Status", "Source", "Assigned To"];
    const rows = leads.map((l) => [
      l.name,
      l.phone,
      l.intent || "",
      l.status,
      l.source || "",
      l.assignedTo || "",
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="realtor-btn-outline" onClick={exportCsv}>
      <Download className="h-4 w-4" />
      Export
    </button>
  );
}
