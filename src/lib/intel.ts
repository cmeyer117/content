export type TrackedCreator = {
  id: string
  name: string
  tiktok_handle: string | null
  instagram_handle: string | null
  active: boolean
}

export type CreatorInsight = {
  id: string
  week_of: string
  creator_id: string
  claude_brief: string
  avg_views: number | null
}

/** Pull the body of the "CARL'S TAKEAWAY" section out of a weekly brief. */
export function extractTakeaway(brief: string): string | null {
  const lines = brief.split('\n')
  const start = lines.findIndex(l => /^#{1,4}\s.*takeaway/i.test(l))
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex(l => /^#{1,4}\s/.test(l))
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
  return body || null
}
