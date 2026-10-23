import { ContactsSubnav } from '@/components/contacts/contacts-subnav'

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ContactsSubnav />
      {children}
    </div>
  )
}
