import { CompanyDetailWorkspace } from '@/components/contacts/crm-section-workspaces'

export const metadata = { title: 'Company' }

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CompanyDetailWorkspace companyId={id} />
}
