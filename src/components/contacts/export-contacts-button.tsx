"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useState } from "react";

export function ExportContactsButton() {
  const [exporting, setExporting] = useState(false);

  async function exportContacts() {
    setExporting(true);
    try {
      const res = await fetch("/api/contacts/export");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ||
        "contacts-export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button variant="outline" type="button" disabled={exporting} onClick={exportContacts}>
      <Download className="h-4 w-4" />
      {exporting ? "Exporting…" : "Export"}
    </Button>
  );
}
