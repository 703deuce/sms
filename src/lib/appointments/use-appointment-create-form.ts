'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type AppointmentCreateType = {
  id: string
  name: string
  durationMinutes: number
}

export type AppointmentCreateSlot = { startsAt: string; endsAt?: string }

export type AppointmentCreateContact = {
  id: string
  firstName: string
  lastName: string
  phone: string
  email: string
}

export type AppointmentCreateView = 'form' | 'success' | 'cancelled'

export function useAppointmentCreateForm(initialStartsAt?: string) {
  const [view, setView] = useState<AppointmentCreateView>('form')
  const [types, setTypes] = useState<AppointmentCreateType[]>([])
  const [serviceId, setServiceId] = useState('')
  const [slots, setSlots] = useState<AppointmentCreateSlot[]>([])
  const [startsAt, setStartsAt] = useState(initialStartsAt || '')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [smsConsent, setSmsConsent] = useState(false)
  const [contactQuery, setContactQuery] = useState('')
  const [contactOpen, setContactOpen] = useState(false)
  const [linkedContact, setLinkedContact] = useState<string | null>(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotError, setSlotError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<AppointmentCreateContact[]>([])
  const contactRef = useRef<HTMLDivElement>(null)

  const selectedType = types.find((t) => t.id === serviceId)

  const isDirty =
    !!startsAt ||
    !!firstName.trim() ||
    !!lastName.trim() ||
    !!phone.trim() ||
    !!email.trim() ||
    !!notes.trim() ||
    !!linkedContact

  useEffect(() => {
    if (initialStartsAt) setStartsAt(initialStartsAt)
  }, [initialStartsAt])

  useEffect(() => {
    fetch('/api/appointments/types')
      .then((r) => r.json())
      .then((json) => {
        const list = (json.data || []) as AppointmentCreateType[]
        setTypes(list)
        if (list[0]?.id) setServiceId(list[0].id)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedType) return
    setLoadingSlots(true)
    setSlotError('')
    fetch(
      `/api/appointments/availability?serviceName=${encodeURIComponent(selectedType.name)}&daysAhead=14`,
    )
      .then((r) => r.json())
      .then((json) => setSlots(json.data?.slots || []))
      .catch(() => setSlotError('Could not load availability.'))
      .finally(() => setLoadingSlots(false))
  }, [selectedType?.id, selectedType?.name])

  useEffect(() => {
    const q = contactQuery.trim()
    if (!q) {
      setContacts([])
      return
    }
    fetch(`/api/contacts?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((json) => {
        setContacts(
          (json.data || []).map(
            (c: {
              id: string
              firstName?: string
              lastName?: string
              phone: string
              email?: string
            }) => ({
              id: c.id,
              firstName: c.firstName || '',
              lastName: c.lastName || '',
              phone: c.phone,
              email: c.email || '',
            }),
          ),
        )
      })
      .catch(() => setContacts([]))
  }, [contactQuery])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setContactOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const summaryDate = useMemo(() => {
    if (!startsAt) return null
    return new Date(startsAt).toLocaleString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }, [startsAt])

  function pickContact(id: string) {
    const c = contacts.find((x) => x.id === id)
    if (!c) return
    setLinkedContact(id)
    setFirstName(c.firstName)
    setLastName(c.lastName)
    setPhone(c.phone)
    setEmail(c.email)
    setContactQuery(`${c.firstName} ${c.lastName}`.trim())
    setContactOpen(false)
  }

  function clearContact() {
    setLinkedContact(null)
    setContactQuery('')
    setFirstName('')
    setLastName('')
    setPhone('')
    setEmail('')
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!selectedType) errs.service = 'Select an appointment type.'
    if (!startsAt) errs.slot = 'Select an available time.'
    if (!firstName.trim()) errs.firstName = "Enter the customer's first name."
    if (!phone.trim()) errs.phone = 'Enter a mobile number for appointment updates.'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Enter a complete email address.'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function submit() {
    setError('')
    if (!validate()) {
      setError('A few fields need attention before this appointment can be created.')
      return
    }
    setSaving(true)
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: selectedType?.id,
        serviceName: selectedType?.name,
        startsAt,
        firstName,
        lastName,
        phone,
        email,
        notes,
        smsConsent,
        status: 'scheduled',
        contactId: linkedContact || undefined,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      setError(json.error || 'Could not create appointment')
      return
    }
    const id = json.data?.appointmentId || json.data?.id || ''
    setCreatedId(id)
    setView('success')
    return id
  }

  function resetForm() {
    setView('form')
    setCreatedId(null)
    setStartsAt(initialStartsAt || '')
    clearContact()
    setNotes('')
    setSmsConsent(false)
    setError('')
    setFieldErrors({})
  }

  function requestCancel() {
    if (isDirty) return 'confirm' as const
    setView('cancelled')
    return 'cancelled' as const
  }

  function confirmDiscard() {
    setView('cancelled')
  }

  return {
    view,
    types,
    serviceId,
    setServiceId,
    slots,
    startsAt,
    setStartsAt,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    phone,
    setPhone,
    email,
    setEmail,
    notes,
    setNotes,
    smsConsent,
    setSmsConsent,
    contactQuery,
    setContactQuery,
    contactOpen,
    setContactOpen,
    linkedContact,
    contacts,
    contactRef,
    loadingSlots,
    slotError,
    saving,
    error,
    fieldErrors,
    setFieldErrors,
    selectedType,
    isDirty,
    createdId,
    summaryDate,
    pickContact,
    clearContact,
    submit,
    resetForm,
    requestCancel,
    confirmDiscard,
    bookAnother: resetForm,
  }
}
