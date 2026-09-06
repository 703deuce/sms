"use client";

import { useState } from "react";
import "./reference.css";
import { NoShowRecoveryClient } from "./components/NoShowRecoveryClient";
import { InstallWorkflowModal } from "./components/InstallWorkflowModal";
import { RunScanModal } from "./components/RunScanModal";
import { RecoveryDetailDrawer } from "./components/RecoveryDetailDrawer";
import { initialConfig, initialStats, recentNoShows, permissions, type NoShowRow } from "./mock-data";

export type View = "main" | "install" | "scan";

export default function ReferencePage() {
  const [modal, setModal] = useState<View>("main");
  const [stats, setStats] = useState(initialStats);
  const [selected, setSelected] = useState<NoShowRow | null>(null);
  const [rows, setRows] = useState(recentNoShows);

  return (
    <div className="nsr-root">
      <NoShowRecoveryClient
        stats={stats}
        initialConfig={initialConfig}
        recentNoShows={rows}
        readOnly={!permissions.canManageNoShowRecovery}
        onOpenInstall={() => setModal("install")}
        onOpenScan={() => setModal("scan")}
        onOpenAppointment={(row) => setSelected(row)}
      />
      {modal === "install" && (
        <InstallWorkflowModal
          onClose={() => setModal("main")}
          onInstalled={() => {
            setStats((s) => ({ ...s, workflowInstalled: true }));
            setModal("main");
          }}
        />
      )}
      {modal === "scan" && (
        <RunScanModal
          onClose={() => setModal("main")}
          onComplete={(found) => {
            setStats((s) => ({ ...s, noShowsLast30Days: s.noShowsLast30Days + found, lastScanAt: "Just now" }));
            setModal("main");
          }}
        />
      )}
      {selected && (
        <RecoveryDetailDrawer
          row={selected}
          workflowInstalled={stats.workflowInstalled}
          onClose={() => setSelected(null)}
          onMarkRebooked={() => {
            setRows((rs) => rs.map((r) => (r.id === selected.id ? { ...r, status: "Rebooked" } : r)));
            setStats((s) => ({ ...s, recoveredBookings: s.recoveredBookings + 1 }));
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
