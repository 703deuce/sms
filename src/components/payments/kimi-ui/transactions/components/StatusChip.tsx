const styles: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
  succeeded: { bg: "#ECFDF3", fg: "#067647", dot: "#12B76A", label: "Paid" },
  partially_refunded: { bg: "#FFFAEB", fg: "#B54708", dot: "#F79009", label: "Partially refunded" },
  refunded: { bg: "#F4F3FF", fg: "#5925DC", dot: "#7A5AF8", label: "Refunded" },
  pending: { bg: "#F2F4F7", fg: "#344054", dot: "#98A2B3", label: "Pending" },
  failed: { bg: "#FEF3F2", fg: "#B42318", dot: "#F04438", label: "Failed" },
};

export function StatusChip({ status }: { status: string }) {
  const s = styles[status] ?? styles.pending;
  return (
    <span
      className="tv-chip"
      style={{ background: s.bg, color: s.fg }}
    >
      <span className="tv-chip-dot" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}
