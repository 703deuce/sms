"use client";

import {
  connectionGradeLabel,
  type ConnectionGrade,
} from "@/lib/voice/webrtc-quality";
import type { VoiceQualityReport } from "@/lib/voice/voice-quality-report";

function Stars({ n }: { n: number }) {
  return (
    <span className="tracking-tight text-foreground" aria-label={`${n} of 5 stars`}>
      {"★".repeat(Math.max(0, Math.min(5, n)))}
      <span className="text-muted-foreground">{"★".repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
}

function GradeDot({ grade }: { grade: ConnectionGrade }) {
  const color =
    grade === "excellent"
      ? "bg-emerald-500"
      : grade === "good"
        ? "bg-amber-500"
        : grade === "poor"
          ? "bg-rose-500"
          : "bg-muted-foreground";
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} />;
}

export function VoiceQualityReportCard({
  report,
}: {
  report: VoiceQualityReport;
}) {
  return (
    <div className="space-y-2 rounded border border-border bg-background/80 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Voice Quality Report</p>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium">
          <GradeDot grade={report.connectionGrade} />
          {connectionGradeLabel(report.connectionGrade)}
        </span>
      </div>
      <div className="grid gap-1 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
        <p>
          Codec:{" "}
          <span className="text-foreground">{report.codec || report.preferredCodec || "—"}</span>
        </p>
        <p>
          MOS:{" "}
          <span className="text-foreground">
            {report.mos != null ? report.mos.toFixed(2) : "—"}
          </span>
        </p>
        <p>
          Packet Loss:{" "}
          <span className="text-foreground">
            {report.packetLossPct != null ? `${report.packetLossPct}%` : "—"}
          </span>
        </p>
        <p>
          Jitter:{" "}
          <span className="text-foreground">
            {report.jitterMs != null ? `${report.jitterMs} ms` : "—"}
          </span>
        </p>
        <p>
          RTT:{" "}
          <span className="text-foreground">
            {report.rttMs != null ? `${report.rttMs} ms` : "—"}
          </span>
        </p>
        <p>
          Average bitrate:{" "}
          <span className="text-foreground">
            {report.averageBitrateKbps != null
              ? `${report.averageBitrateKbps} kbps`
              : "—"}
          </span>
        </p>
        <p>
          Sample rate:{" "}
          <span className="text-foreground">
            {report.sampleRateHz != null ? `${report.sampleRateHz} Hz` : "—"}
          </span>
        </p>
        <p>
          Time until clean audio:{" "}
          <span className="text-foreground">
            {report.timeUntilCleanAudioSec != null
              ? `${report.timeUntilCleanAudioSec} s`
              : "—"}
          </span>
        </p>
        <p>
          Transcodes:{" "}
          <span className="text-foreground">{report.transcodes ?? "—"}</span>
        </p>
        <p>
          Voice model:{" "}
          <span className="text-foreground">{report.voiceModel || "—"}</span>
        </p>
        <p>
          Microphone:{" "}
          <span className="text-foreground">{report.inputDevice || "—"}</span>
        </p>
        <p>
          Speaker:{" "}
          <span className="text-foreground">{report.outputDevice || "—"}</span>
        </p>
      </div>
      <p className="text-sm">
        Overall quality: <Stars n={report.stars} />{" "}
        <span className="text-xs text-muted-foreground">({report.overallLabel})</span>
      </p>
      {report.timeline.firstCleanAudioAtMs != null ||
      report.timeline.iceConnectedAtMs != null ? (
        <p className="font-mono text-[10px] text-muted-foreground">
          Timeline ms — ICE {report.timeline.iceConnectedAtMs ?? "—"} · DTLS{" "}
          {report.timeline.dtlsConnectedAtMs ?? "—"} · media{" "}
          {report.timeline.mediaFlowingAtMs ?? "—"} · inbound{" "}
          {report.timeline.firstInboundPacketAtMs ?? "—"} · AI audio{" "}
          {report.timeline.firstAiAudioAtMs ?? "—"} · clean{" "}
          {report.timeline.firstCleanAudioAtMs ?? "—"} · unmute{" "}
          {report.timeline.remoteUnmutedAtMs ?? "—"}
        </p>
      ) : null}
      {report.notes.length ? (
        <ul className="space-y-0.5 text-[11px] text-muted-foreground">
          {report.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
