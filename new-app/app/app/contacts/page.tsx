import { Suspense } from 'react'
import { ContactsWorkspace } from '@/components/contacts/contacts-workspace'

export const metadata = { title: 'Contacts' }

export default function ContactsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading contacts…</p>}>
      <ContactsWorkspace />
    </Suspense>
  )
}
