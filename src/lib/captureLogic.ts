// Object names in the raw-captures bucket are timestamp-prefixed so uploads
// sort chronologically by name alone, and so a re-upload of the same
// filename never collides with an existing object.
export function captureObjectName(file: File, now: Date = new Date()): string {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${now.getTime()}-${safeName}`
}

export function formatCaptureAge(uploadedAt: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - uploadedAt.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  return `${diffHr}h ago`
}
