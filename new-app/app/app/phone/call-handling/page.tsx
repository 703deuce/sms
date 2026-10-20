import { redirect } from 'next/navigation'

export const metadata = { title: 'Call Handling · Phone' }

/** Legacy route — forwarding customers use first-class Call Forwarding nav. */
export default function PhoneCallHandling() {
  redirect('/app/phone/forwarding')
}
