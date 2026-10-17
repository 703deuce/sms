"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { VISUALIZER_ROUTES } from "@/lib/visualizer/routes";
import { OpusDataSurface } from "@/newui-transplant/components/appointment-reminders/ar-opus-layout";

export default function VisualizerLeadsPage() {
  const [rows, setRows] = useState<
    Array<{ id: string; fullName: string; phone: string; status: string; projectId: string; createdAt: string }>
  >([]);

  useEffect(() => {
    fetch("/api/visualizer/leads")
      .then((r) => r.json())
      .then((d) => setRows(d.leads || []))
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Visualizer leads</h1>
        <p className="text-sm text-muted-foreground">Homeowners interested in a remodel design.</p>
      </header>
      <OpusDataSurface>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="p-3 font-medium" scope="col">Homeowner</th>
              <th className="p-3 font-medium" scope="col">Phone</th>
              <th className="p-3 font-medium" scope="col">Status</th>
              <th className="p-3 font-medium" scope="col">Project</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-3">{r.fullName}</td>
                <td className="p-3">{r.phone}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3">
                  <Link href={VISUALIZER_ROUTES.project(r.projectId)} className="text-primary underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </OpusDataSurface>
    </div>
  );
}
