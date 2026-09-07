"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "@/components/appointments/kimi-ui/no-show-recovery/reference.css";
import { NoShowRecoveryClient } from "@/components/appointments/kimi-ui/no-show-recovery/components/NoShowRecoveryClient";
import type { NoShowRow } from "@/components/appointments/kimi-ui/no-show-recovery/types";

type Config = {
  enabled: boolean;
  graceMinutes: number;
  autoInstallWorkflow: boolean;
  notifyTeam: boolean;
  followUpChannel: "sms" | "sms_email";
};

type Stats = {
  noShowsLast30Days: number;
  recoveredBookings: number;
  workflowInstalled: boolean;
  lastScanAt: string;
};

export function NoShowRecoveryConnected() {
  const router = useRouter();
  const [config, setConfig] = useState<Config>({
    enabled: true,
    graceMinutes: 30,
    autoInstallWorkflow: true,
    notifyTeam: true,
    followUpChannel: "sms",
  });
  const [stats, setStats] = useState<Stats>({
    noShowsLast30Days: 0,
    recoveredBookings: 0,
    workflowInstalled: false,
    lastScanAt: "",
  });
  const [recentNoShows, setRecentNoShows] = useState<NoShowRow[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/appointments/no-show-recovery");
    if (!res.ok) return;
    const json = await res.json();
    const apiConfig = json.data?.config || {};
    setConfig({
      enabled: apiConfig.enabled ?? true,
      graceMinutes: apiConfig.graceMinutes ?? 30,
      autoInstallWorkflow: apiConfig.autoInstallWorkflow ?? true,
      notifyTeam: apiConfig.notifyTeam ?? true,
      followUpChannel: apiConfig.followUpChannel ?? "sms",
    });
    setStats({
      noShowsLast30Days: json.data?.stats?.noShowsLast30Days ?? 0,
      recoveredBookings: json.data?.stats?.recoveredBookings ?? 0,
      workflowInstalled: json.data?.stats?.workflowInstalled ?? false,
      lastScanAt: json.data?.stats?.lastScanAt || "Never",
    });
    setRecentNoShows(json.data?.recentNoShows || []);
    setReady(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!ready) {
    return <div className="nsr-page p-6 text-sm text-muted-foreground">Loading no-show recovery…</div>;
  }

  return (
    <NoShowRecoveryClient
      stats={stats}
      initialConfig={config}
      recentNoShows={recentNoShows}
      readOnly={false}
      onOpenInstall={async () => {
        await fetch("/api/appointments/no-show-recovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "install-workflow" }),
        });
        await load();
      }}
      onOpenScan={async () => {
        await fetch("/api/appointments/no-show-recovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "scan" }),
        });
        await load();
      }}
      onOpenAppointment={(row) => router.push(`/appointments/${row.id}`)}
    />
  );
}
