import { ContactDetailWorkspace } from '@/components/contacts/contact-detail-workspace'

export const metadata = { title: 'Contact' }

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ContactDetailWorkspace contactId={id} />
}
