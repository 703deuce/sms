import { Copy, Check, ExternalLink, Link2 } from "lucide-react";

type Props = {
  bookingLink: string;
  copied: boolean;
  onCopy: () => void;
  onPreview: () => void;
};

export default function BookingLinkCard({ bookingLink, copied, onCopy, onPreview }: Props) {
  const hasLink = Boolean(bookingLink);
  return (
    <section className="setup-card" aria-label="Booking link">
      <div className="setup-card-header" style={{ paddingBottom: 6 }}>
        <div>
          <h2 className="setup-card-title">
            <Link2 size={15} style={{ color: "var(--setup-accent)" }} />
            Your booking link
          </h2>
          <p className="setup-card-subtitle">Share this anywhere customers can book you.</p>
        </div>
      </div>
      <div style={{ padding: "8px 20px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {hasLink ? (
          <>
            <div className="setup-booking-link-box">
              <span>{bookingLink}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="setup-btn setup-btn-primary setup-btn-sm"
                style={{ flex: 1 }}
                onClick={onCopy}
                aria-live="polite"
              >
                {copied ? (
                  <>
                    <Check size={13} strokeWidth={2.6} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={13} strokeWidth={2.2} />
                    Copy link
                  </>
                )}
              </button>
              <button type="button" className="setup-btn setup-btn-outline setup-btn-sm" style={{ flex: 1 }} onClick={onPreview}>
                <ExternalLink size={13} strokeWidth={2.2} />
                Preview
              </button>
            </div>
          </>
        ) : (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--setup-muted)",
              background: "#f7f7fb",
              border: "1px dashed var(--setup-border)",
              borderRadius: 8,
              padding: "12px 14px",
              lineHeight: 1.5,
            }}
          >
            Your public booking link appears here after you add your business information in step 1.
          </div>
        )}
      </div>
    </section>
  );
}
