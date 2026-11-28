import { AgentDashboard } from '@/components/agent-lab/ops/dashboard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Dashboard' }

/** Logged-in dashboard: chat-first, built on Agent Lab data. The previous video dashboard lives at /app/video-home. */
export default function AppDashboardPage() {
  return <AgentDashboard />
}
