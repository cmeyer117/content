// Post-to-inquiry attribution. coaching-landing captures first-touch
// utm_source / utm_campaign / content_idea_id and writes them onto
// coaching_inquiries.source / campaign / content_idea_id. This module is the
// only place that builds that link and reads the counts back.

export const COACHING_LANDING_URL = 'https://coaching-landing-nu.vercel.app/'

type LinkSource = {
  id: string
  platform?: string | null
  pillar?: string | null
}

export function buildCoachingLink(idea: LinkSource): string {
  const params = new URLSearchParams({
    utm_source: idea.platform || 'unknown',
    utm_campaign: idea.pillar || 'unknown',
    content_idea_id: idea.id,
  })
  return `${COACHING_LANDING_URL}?${params.toString()}`
}

// Tolerant of whatever the read returns: a non-array, rows without a
// content_idea_id, or null ids are all skipped rather than thrown on.
export function countInquiriesByIdea(rows: unknown): Record<string, number> {
  const counts: Record<string, number> = {}
  if (!Array.isArray(rows)) return counts
  for (const row of rows) {
    const id = (row as { content_idea_id?: unknown } | null)?.content_idea_id
    if (typeof id !== 'string' || id === '') continue
    counts[id] = (counts[id] ?? 0) + 1
  }
  return counts
}

// null/undefined means the read failed or wasn't available -- fail soft to
// "none yet", never blank.
export function inquiriesChipLabel(count: number | null | undefined): string {
  if (typeof count === 'number' && count > 0) return `Inquiries: ${count}`
  return 'Inquiries: none yet'
}
