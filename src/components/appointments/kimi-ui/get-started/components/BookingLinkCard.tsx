import { Copy, ExternalLink } from "lucide-react";
import { bookingLink } from "../mock-data";

export default function BookingLinkCard() {
  return (
    <div className="setup-card" style={{ padding: "20px 22px" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#1c1c2e" }}>Your booking link</div>
      <div style={{ fontSize: 12.5, color: "#8a8aa3", marginTop: 4, marginBottom: 14 }}>
        Share this link to allow customers to book with you.
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          background: "#f7f7fb",
          border: "1px solid #ececf3",
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 12.5,
            color: "#3c3c55",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {bookingLink}
        </span>
        <button
          style={{ background: "none", border: "none", cursor: "pointer", color: "#8a8aa3", padding: 2 }}
          aria-label="Copy link"
        >
          <Copy size={15} />
        </button>
      </div>

      <button
        className="btn-soft"
        style={{ width: "100%", justifyContent: "center", padding: "10px 14px" }}
      >
        Preview booking page <ExternalLink size={14} />
      </button>
    </div>
  );
}
