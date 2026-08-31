'use client'

import { Search, ListFilter, Users, MessageSquare, Paperclip, MoreVertical, Megaphone } from 'lucide-react'
import { campaigns as baseCampaigns, Campaign } from '../mock-data'

interface Props {
  extraCampaigns: Campaign[]
  onCreate: () => void
}

export default function CampaignList({ extraCampaigns, onCreate }: Props) {
  const all = [...extraCampaigns, ...baseCampaigns]

  return (
    <div className="st-page">
      <div className="st-header">
        <div className="st-title-row">
          <div className="st-title-icon"><Megaphone size={22} /></div>
          <div>
            <h1>Campaigns</h1>
            <p className="st-subtitle">View and manage all of your campaigns.</p>
          </div>
        </div>
        <div className="st-header-actions">
          <button className="st-btn-secondary">
            <ListFilter size={15} /> Filter
          </button>
          <div className="st-search">
            <input placeholder="Search" />
            <Search size={15} />
          </div>
          <button className="st-btn-primary" onClick={onCreate}>Create Campaign</button>
        </div>
      </div>

      <div className="st-table">
        <div className="st-table-head">
          <span className="col-campaign">CAMPAIGN</span>
          <span className="col-audience"></span>
          <span className="col-attach"></span>
          <span className="col-stat">Clicks</span>
          <span className="col-stat">Unsubs</span>
          <span className="col-stat">Revenue</span>
          <span className="col-status">STATUS</span>
          <span className="col-more"></span>
        </div>
        {all.map((c) => (
          <div key={c.id} className="st-table-row">
            <div className="col-campaign">
              <span className="st-campaign-name">{c.name}</span>
              <span className="st-campaign-detail">{c.detail}</span>
            </div>
            <div className="col-audience">
              <span className="st-contact-count">{c.contacts.toLocaleString()}</span>
              <span className="st-audience-type"><Users size={12} /> {c.audienceType}</span>
            </div>
            <div className="col-attach">
              <MessageSquare size={15} className="st-dim-icon" />
              {c.hasAttachment && <Paperclip size={14} className="st-dim-icon" />}
            </div>
            <span className="col-stat">{c.status === 'Sent' || c.status === 'Sending' ? c.clicks : ''}</span>
            <span className="col-stat">{c.status === 'Sent' || c.status === 'Sending' ? c.unsubs : ''}</span>
            <span className="col-stat st-revenue">{c.status === 'Sent' || c.status === 'Sending' ? c.revenue : ''}</span>
            <span className="col-status">
              <span className={`st-status st-status-${c.status.toLowerCase()}`}>{c.status}</span>
            </span>
            <span className="col-more"><MoreVertical size={15} className="st-dim-icon" /></span>
          </div>
        ))}
      </div>
    </div>
  )
}
