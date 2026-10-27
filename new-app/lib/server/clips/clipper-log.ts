import 'server-only'

/** Structured clipper pipeline logs — no secrets, no presigned URLs. */
export function clipperLog(
  area: 'upload' | 'project' | 'retry' | 'status' | 'transcribe',
  message: string,
  fields?: Record<string, string | number | boolean | null | undefined>,
) {
  const payload = fields ? { ...fields, message } : { message }
  console.info(`[clipper:${area}]`, payload)
}
