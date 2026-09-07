"use client";

export default function LoadingStep() {
  return (
    <div aria-busy="true" aria-label="Loading booking page">
      <span className="sr-only">Loading availability…</span>
      <div className="eb-skeleton" style={{ height: 22, width: "55%", marginBottom: 8 }} />
      <div className="eb-skeleton" style={{ height: 14, width: "80%", marginBottom: 22 }} />
      {[0, 1, 2].map((i) => (
        <div key={i} className="eb-skeleton" style={{ height: 92, marginBottom: 10 }} />
      ))}
    </div>
  );
}
