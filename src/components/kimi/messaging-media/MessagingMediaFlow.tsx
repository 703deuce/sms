/**
 * Kimi session 2026-08-31T00-27-02-964Z-35e7b9 — UI from Kimi draft (mock data, no backend wiring yet).
 */
'use client'

import { useState } from 'react'
import './reference.css'
import Sidebar from './components/Sidebar'
import CampaignList from './components/CampaignList'
import CreateCampaign from './components/CreateCampaign'
import ReviewDetails from './components/ReviewDetails'
import { Campaign, CampaignDraft } from './mock-data'

export default function MessagingMediaFlow() {
  const [view, setView] = useState<'list' | 'create' | 'review'>('list')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [draft, setDraft] = useState<CampaignDraft | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const handleCreate = () => {
    setDraft({
      name: '',
      audience: [],
      message: '',
      attachment: null,
      timing: 'now',
    })
    setView('create')
  }

  const handleReview = (d: CampaignDraft) => {
    setDraft(d)
    setView('review')
  }

  const handleSend = () => {
    if (!draft) return
    const newCampaign: Campaign = {
      id: `c-${Date.now()}`,
      name: draft.name || 'Untitled Campaign',
      detail: `Sending on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
      audience: draft.audience.length ? draft.audience[0] : 'No Audience',
      contacts: 1,
      audienceType: '1 List',
      clicks: 0,
      unsubs: 0,
      revenue: '$0',
      status: 'Sending',
      hasAttachment: !!draft.attachment,
    }
    setCampaigns((prev) => [newCampaign, ...prev])
    setView('list')
    setToast('Campaign is sending...')
    setTimeout(() => setToast(null), 4000)
    setTimeout(() => {
      setCampaigns((prev) => prev.map((c) => (c.id === newCampaign.id ? { ...c, status: 'Sent' } : c)))
    }, 5000)
  }

  return (
    <div className="st-app">
      <main className="st-main">
        {view === 'list' && <CampaignList extraCampaigns={campaigns} onCreate={handleCreate} />}
        {view === 'create' && draft && (
          <CreateCampaign
            draft={draft}
            onCancel={() => setView('list')}
            onReview={handleReview}
            onChange={setDraft}
          />
        )}
        {view === 'review' && draft && (
          <ReviewDetails draft={draft} onPrev={() => setView('create')} onSend={handleSend} />
        )}
        {toast && <div className="st-toast">{toast}</div>}
      </main>
    </div>
  )
}
