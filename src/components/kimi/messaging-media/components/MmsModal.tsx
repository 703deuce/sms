'use client'

import { AlertTriangle, X } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function MmsModal({ onClose }: Props) {
  return (
    <div className="st-modal-overlay" onClick={onClose}>
      <div className="st-modal" onClick={(e) => e.stopPropagation()}>
        <button className="st-modal-close" onClick={onClose}><X size={16} /></button>
        <div className="st-modal-icon">
          <AlertTriangle size={26} />
        </div>
        <h2>A Heads-Up About Your Message</h2>
        <p>
          Cellular carriers charge more for MMS messages than they do for standard SMS. Because
          of this, when you send a message with an attachment, the number of messages used will be
          multiplied by 3. It will however, allow you to use up to 1,600 characters at no additional cost.
        </p>
        <button className="st-btn-primary st-modal-btn" onClick={onClose}>Got It</button>
      </div>
    </div>
  )
}
