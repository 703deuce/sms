import { Page, PageHeader } from '@/components/app/page-primitives'
import { ContactsActions, ContactsTable } from '@/components/contacts/contacts-table'
import { CONTACTS } from '@/lib/data'

export const metadata = { title: 'Contacts' }

export default function ContactsPage() {
  return (
    <Page>
      <PageHeader
        title="Contacts"
        description={`${CONTACTS.length} people across calls, AI conversations, text-back and dialer lists — one record per phone number.`}
        actions={<ContactsActions />}
      />
      <ContactsTable />
    </Page>
  )
}
