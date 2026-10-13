import { ClientsConnected } from '@/features/appointments/kimi/clients/clients-connected'
import { ClientsDirectoryOpus } from '@/newui-transplant/connected/scheduling/clients-directory-opus'
import { SchedulingPageGate } from '@/lib/appointments/scheduling-page-gate'

export default function AppointmentsClientsPage() {
  return <SchedulingPageGate opus={<ClientsDirectoryOpus />} legacy={<ClientsConnected />} />
}
