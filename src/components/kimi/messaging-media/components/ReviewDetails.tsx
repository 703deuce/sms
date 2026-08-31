'use client'

import { Users, Megaphone, Rocket } from 'lucide-react'
import { CampaignDraft, creditsAvailable } from '../mock-data'
import PhonePreview from './PhonePreview'

interface Props {
  draft: CampaignDraft
  onPrev: () => void
  onSend: () => void
}

export default function ReviewDetails({ draft, onPrev, onSend }: Props) {
  const contacts = Math.max(draft.audience.length, 1)
  const creditsRequired = contacts * (draft.attachment ? 3 : 1)
  const remaining = creditsAvailable - creditsRequired

  return (
    <div className="st-page st-create">
      <div className="st-breadcrumb">Campaigns / Create Campaign</div>
      <div className="st-title-row">
        <div className="st-title-icon"><Megaphone size={20} /></div>
        <div>
          <h1>Review Details</h1>
          <p className="st-subtitle">Confirm your campaign details.</p>
        </div>
      </div>

      <div className="st-create-grid">
        <div className="st-review">
          <div className="st-review-section">
            <div className="st-review-head">
              <span className="st-label">Audience <em>(Subscribed Contacts Only)</em></span>
              <button className="st-edit-link" onClick={onPrev}>Edit</button>
            </div>
            <div className="st-review-card">
              <span className="st-review-audience">
                <Users size={15} /> List: {draft.audience[0] || 'VIP List'}
              </span>
              <span className="st-review-count">{contacts}</span>
            </div>
          </div>

          <div className="st-review-section">
            <div className="st-review-head">
              <span className="st-label">Timing</span>
              <button className="st-edit-link" onClick={onPrev}>Edit</button>
            </div>
            <div className="st-review-card">
              <span>{draft.timing === 'now' ? 'Send Immediately' : draft.timing === 'later' ? 'Scheduled for Later' : 'Recurring'}</span>
            </div>
          </div>

          <div className="st-review-section">
            <span className="st-label">Message Credit Summary</span>
            <div className="st-review-card st-credit-summary">
              <div className="st-credit-row">
                <span>Credits Available</span>
                <span>{creditsAvailable.toLocaleString()}</span>
              </div>
              <div className="st-credit-row">
                <span>Credits Required</span>
                <span>{creditsRequired}</span>
              </div>
              <div className="st-credit-row">
                <span>Credits Remaining</span>
                <span>{remaining.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <PhonePreview message={draft.message} attachment={draft.attachment} label="Campaign Preview" />
      </div>

      <div className="st-footer-bar">
        <button className="st-btn-ghost" onClick={onPrev}>← Prev</button>
        <div className="st-footer-right">
          <button className="st-btn-ghost">Save Draft</button>
          <button className="st-btn-primary" onClick={onSend}>
            Send Now <Rocket size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
