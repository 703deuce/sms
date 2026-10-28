import { NextResponse } from 'next/server'

/** Fire-and-forget hint for workers already running schedule_modal_warmup_background on boot. */
export async function POST() {
  console.info('[clipper:gpu_render] editor_open_warmup_hint')
  return NextResponse.json({ data: { ok: true } })
}
