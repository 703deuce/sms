import { redirect } from 'next/navigation'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Legacy calendar URL → canonical calendar-first home (preserves query). */
export default async function AppointmentRemindersCalendarRedirect({ searchParams }: PageProps) {
  const sp = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === 'string') qs.set(key, value)
    else if (Array.isArray(value)) value.forEach((v) => qs.append(key, v))
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  redirect(`/appointment-reminders${suffix}`)
}
