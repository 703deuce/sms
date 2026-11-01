import { NextResponse } from 'next/server'

/** Worker encoder probe for export dialog (§4 batch 1). No infra — empty list shows all formats. */
export async function GET() {
  return NextResponse.json({ encoders: [] as string[] })
}
