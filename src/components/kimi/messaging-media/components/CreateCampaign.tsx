'use client'

import { useState } from 'react'
import { Paperclip, Smile, Code2, Send, X, Users, Megaphone } from 'lucide-react'
import { CampaignDraft, lists, segments, sampleAttachment } from '../mock-data'
import PhonePreview from './PhonePreview'
import MmsModal from './MmsModal'

interface Props {
  draft: CampaignDraft
  onChange: (d: CampaignDraft) => void
  onCancel: () => void
  onReview: (d: CampaignDraft) => void
}

export default function CreateCampaign({ draft, onChange, onCancel, onReview }: Props) {
  const [audienceOpen, setAudienceOpen] = useState(false)
  const [audienceQuery, setAudienceQuery] = useState('')
  const [showMmsModal, setShowMmsModal] = useState(false)
  const [attachTooltip, setAttachTooltip] = useState(false)
  const [testTooltip, setTestTooltip] = useState(false)

  const hasAttachment = !!draft.attachment
  const charLimit = hasAttachment ? 1600 : 918

  const addAudience = (name: string) => {
    if (!draft.audience.includes(name)) {
      onChange({ ...draft, audience: [...draft.audience, name] })
    }
    setAudienceQuery('')
  }

  const removeAudience = (name: string) => {
    onChange({ ...draft, audience: draft.audience.filter((a) => a !== name) })
  }

  const attachFile = () => {
    if (hasAttachment) return
    setShowMmsModal(true)
  }

  const confirmAttach = () => {
    onChange({ ...draft, attachment: sampleAttachment })
    setShowMmsModal(false)
  }

  const removeAttachment = () => onChange({ ...draft, attachment: null })

  const filteredLists = lists.filter((l) => l.toLowerCase().includes(audienceQuery.toLowerCase()))
  const filteredSegments = segments.filter((s) => s.toLowerCase().includes(audienceQuery.toLowerCase()))
  const canReview = draft.name.trim().length > 0 && draft.message.trim().length > 0

  return (
    <div className="st-page st-create">
      <div className="st-breadcrumb">Campaigns / Create Campaign</div>
      <div className="st-title-row">
        <div className="st-title-icon"><Megaphone size={22} /></div>
        <div>
          <h1>Create Campaign</h1>
          <p className="st-subtitle">Create a campaign to reach your contacts at scale.</p>
        </div>
      </div>

      <div className="st-create-grid">
        <div className="st-form">
          <label className="st-label">Campaign Name</label>
          <input
            className="st-input"
            value={draft.name}
            placeholder=""
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />

          <label className="st-label">Audience</label>
          <div className="st-audience-box" onClick={() => setAudienceOpen(true)}>
            {draft.audience.map((a) => (
              <span key={a} className="st-chip">
                <Users size={12} /> {a}
                <button onClick={(e) => { e.stopPropagation(); removeAudience(a) }}><X size={12} /></button>
              </span>
            ))}
            <input
              className="st-audience-input"
              placeholder="Search"
              value={audienceQuery}
              onChange={(e) => { setAudienceQuery(e.target.value); setAudienceOpen(true) }}
              onFocus={() => setAudienceOpen(true)}
            />
          </div>
          {audienceOpen && (
            <div className="st-audience-dropdown">
              <div className="st-dd-section">EVERYONE</div>
              <button className="st-dd-item" onClick={() => addAudience('All Contacts')}>
                <Users size={14} /> All Contacts
              </button>
              {filteredLists.length > 0 && <div className="st-dd-section">LISTS</div>}
              {filteredLists.map((l) => (
                <button key={l} className="st-dd-item" onClick={() => addAudience(l)}>
                  <span className="st-dd-list-icon">☰</span> {l}
                </button>
              ))}
              {filteredSegments.length > 0 && <div className="st-dd-section">SEGMENTS</div>}
              {filteredSegments.map((s) => (
                <button key={s} className="st-dd-item" onClick={() => addAudience(s)}>
                  <span className="st-dd-list-icon">◔</span> {s}
                </button>
              ))}
            </div>
          )}

          <div className="st-message-head">
            <label className="st-label">Message</label>
            <span className="st-char-count">
              {draft.message.length}/{charLimit.toLocaleString()}
              {hasAttachment && <span className="st-mms-badge">×3</span>}
            </span>
          </div>
          <div className="st-message-box">
            <textarea
              value={draft.message}
              maxLength={charLimit}
              onChange={(e) => onChange({ ...draft, message: e.target.value })}
            />
            {hasAttachment && (
              <div className="st-attachment-thumb">
                <div className="st-attachment-img" style={{ background: draft.attachment!.color }}>
                  <span>👕</span>
                </div>
                <button className="st-attachment-remove" onClick={removeAttachment}><X size={10} /></button>
              </div>
            )}
            <div className="st-message-toolbar">
              <div className="st-toolbar-left">
                <button
                  className="st-toolbar-btn"
                  onMouseEnter={() => setAttachTooltip(true)}
                  onMouseLeave={() => setAttachTooltip(false)}
                  onClick={attachFile}
                >
                  <Paperclip size={15} />
                  {attachTooltip && <span className="st-tooltip">Attach a File</span>}
                </button>
                <button className="st-toolbar-btn"><Smile size={15} /></button>
                <button className="st-toolbar-btn"><Code2 size={15} /></button>
              </div>
              <button
                className="st-toolbar-btn"
                onMouseEnter={() => setTestTooltip(true)}
                onMouseLeave={() => setTestTooltip(false)}
              >
                <Send size={14} />
                {testTooltip && <span className="st-tooltip">Send a Test</span>}
              </button>
            </div>
          </div>

          <label className="st-label">When to Send</label>
          <div className="st-segmented">
            {(['now', 'later', 'recurring'] as const).map((t) => (
              <button
                key={t}
                className={`st-seg-btn ${draft.timing === t ? 'active' : ''}`}
                onClick={() => onChange({ ...draft, timing: t })}
              >
                {t === 'now' ? 'Now' : t === 'later' ? 'Later' : 'Recurring'}
              </button>
            ))}
          </div>
        </div>

        <PhonePreview message={draft.message} attachment={draft.attachment} />
      </div>

      <div className="st-footer-bar">
        <button className="st-btn-ghost" onClick={onCancel}>Cancel</button>
        <div className="st-footer-right">
          <button className="st-btn-ghost">Save Draft</button>
          <button className="st-btn-primary" disabled={!canReview} onClick={() => onReview(draft)}>
            Review →
          </button>
        </div>
      </div>

      {showMmsModal && <MmsModal onClose={confirmAttach} />}
    </div>
  )
}
