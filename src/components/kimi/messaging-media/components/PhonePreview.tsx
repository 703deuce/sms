'use client'

interface Props {
  message: string
  attachment: { name: string; color: string; label: string } | null
  label?: string
}

export default function PhonePreview({ message, attachment, label = 'Message Preview' }: Props) {
  return (
    <div className="st-phone-wrap">
      <span className="st-phone-label">{label}</span>
      <div className="st-phone">
        <div className="st-phone-content">
          {message ? <div className="st-bubble">{message}</div> : null}
          {attachment ? (
            <div className="st-mms-card" style={{ background: attachment.color }}>
              <div className="st-mms-pattern">
                {Array.from({ length: 6 }).map((_, i) => (
                  <span key={i}>{attachment.label} {attachment.label} {attachment.label}</span>
                ))}
              </div>
              <div className="st-mms-shirt">👕</div>
              <div className="st-mms-cta">20% OFF BASICS</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
