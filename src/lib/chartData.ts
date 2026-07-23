import type { ContentIdea, Pillar, PipelineStatus } from '@/types/content'
import { PILLARS, PIPELINE_STAGES } from '@/lib/constants'

export function countByPillar(ideas: ContentIdea[]): { pillar: Pillar; label: string; count: number }[] {
  return PILLARS.map(p => ({
    pillar: p.value,
    label: p.label,
    count: ideas.filter(i => i.pillar === p.value).length,
  }))
}

export function countByStage(ideas: ContentIdea[]): { stage: PipelineStatus; count: number }[] {
  return PIPELINE_STAGES.map(s => ({
    stage: s,
    count: ideas.filter(i => i.status === s).length,
  }))
}

// Extracts the calendar date (year/month/day) an ISO timestamp falls on in
// America/New_York, regardless of the timestamp's UTC offset or the browser's
// own local timezone.
function nyDateParts(iso: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (type: string) => Number(parts.find(p => p.type === type)!.value)
  return { year: get('year'), month: get('month'), day: get('day') }
}

// Returns the ISO date (YYYY-MM-DD) of the Monday starting the week containing
// the given NY-local calendar date. Uses UTC-noon internally purely as a safe
// anchor for date arithmetic (avoids DST-related day-shifting) — the year/
// month/day inputs are already NY-local, this step is timezone-agnostic math.
function mondayOfWeek(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day, 12))
  const dow = d.getUTCDay() // 0=Sun..6=Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow
  d.setUTCDate(d.getUTCDate() + diffToMonday)
  return d.toISOString().slice(0, 10)
}

export function countByWeek(ideas: ContentIdea[]): { weekStart: string; count: number }[] {
  if (ideas.length === 0) return []

  const counts = new Map<string, number>()
  for (const idea of ideas) {
    const { year, month, day } = nyDateParts(idea.created_at)
    const week = mondayOfWeek(year, month, day)
    counts.set(week, (counts.get(week) ?? 0) + 1)
  }

  const weeks = [...counts.keys()].sort()
  const result: { weekStart: string; count: number }[] = []
  const cursor = new Date(`${weeks[0]}T12:00:00Z`)
  const last = new Date(`${weeks[weeks.length - 1]}T12:00:00Z`)
  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10)
    result.push({ weekStart: key, count: counts.get(key) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }
  return result
}

export type PillarStageBreakdown = { pillar: Pillar; label: string } & Record<PipelineStatus, number>

export function countByPillarAndStage(ideas: ContentIdea[]): PillarStageBreakdown[] {
  return PILLARS.map(p => {
    const stageCounts = Object.fromEntries(PIPELINE_STAGES.map(s => [s, 0])) as Record<PipelineStatus, number>
    for (const idea of ideas) {
      if (idea.pillar === p.value) stageCounts[idea.status]++
    }
    return { pillar: p.value, label: p.label, ...stageCounts }
  })
}
