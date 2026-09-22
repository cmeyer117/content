import type { ContentClass, ContentIdeaWithPerformance, Pillar } from '@/types/content'
import { flattenPerformances, type IdeaPerf } from '@/lib/chartData'
import { PILLARS } from '@/lib/constants'

// Below this many tracked, view-having posts there isn't enough signal to
// tell a real pattern from noise -- the brief stays silent rather than
// guessing off 1-2 data points.
const MIN_TRACKED_POSTS = 3

export type PillarStat = { pillar: Pillar; label: string; medianViews: number; postCount: number }
export type ContentClassStat = { contentClass: ContentClass; medianViews: number; postCount: number }
export type BestHook = { ideaId: string; title: string; hook: string; views: number }

export type NextPostBrief = {
  postCount: number
  topPillar: PillarStat | null
  topContentClass: ContentClassStat | null
  bestHook: BestHook | null
  recommendedLengthSeconds: number | null
  summary: string
}

type TrackedEntry = IdeaPerf & { perf: { views: number } }

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function topPillarByMedianViews(entries: TrackedEntry[]): PillarStat | null {
  const byPillar = new Map<Pillar, number[]>()
  for (const { idea, perf } of entries) {
    const list = byPillar.get(idea.pillar) ?? []
    list.push(perf.views)
    byPillar.set(idea.pillar, list)
  }
  let best: PillarStat | null = null
  for (const [pillar, views] of byPillar) {
    const medianViews = median(views)
    if (best === null || medianViews > best.medianViews) {
      best = { pillar, label: PILLARS.find(p => p.value === pillar)!.label, medianViews, postCount: views.length }
    }
  }
  return best
}

function topContentClassByMedianViews(entries: TrackedEntry[]): ContentClassStat | null {
  const byClass = new Map<ContentClass, number[]>()
  for (const { idea, perf } of entries) {
    if (idea.content_class === null) continue
    const list = byClass.get(idea.content_class) ?? []
    list.push(perf.views)
    byClass.set(idea.content_class, list)
  }
  let best: ContentClassStat | null = null
  for (const [contentClass, views] of byClass) {
    const medianViews = median(views)
    if (best === null || medianViews > best.medianViews) {
      best = { contentClass, medianViews, postCount: views.length }
    }
  }
  return best
}

// The single best-performing post's actual hook wording -- a concrete
// example to reuse or riff on, not a statistical aggregate like the
// pillar/class picks above.
function bestHookFromEntries(entries: TrackedEntry[]): BestHook | null {
  const withHook = entries.filter(({ idea }) => (idea.hook_first_2s ?? idea.hook) !== null)
  if (withHook.length === 0) return null
  const top = withHook.reduce((best, current) => current.perf.views > best.perf.views ? current : best)
  return {
    ideaId: top.idea.id,
    title: top.idea.title,
    hook: (top.idea.hook_first_2s ?? top.idea.hook)!,
    views: top.perf.views,
  }
}

// Median target length among the top half of tracked posts (by views) that
// recorded a target length -- what's been working recently, not a lifetime
// average diluted by early, unrelated posts.
function recommendedLengthFromEntries(entries: TrackedEntry[]): number | null {
  const withLength = entries.filter(
    (e): e is TrackedEntry & { idea: { target_length_seconds: number } } => e.idea.target_length_seconds !== null,
  )
  if (withLength.length === 0) return null
  const sorted = [...withLength].sort((a, b) => b.perf.views - a.perf.views)
  const topHalf = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)))
  return Math.round(median(topHalf.map(e => e.idea.target_length_seconds)))
}

function buildSummary(brief: Omit<NextPostBrief, 'summary'>): string {
  const parts: string[] = []
  if (brief.topPillar) {
    const { label, medianViews, postCount } = brief.topPillar
    parts.push(`${label} is your top pillar right now (median ${medianViews.toLocaleString()} views across ${postCount} post${postCount === 1 ? '' : 's'}).`)
  }
  if (brief.topContentClass) {
    const { contentClass, medianViews } = brief.topContentClass
    parts.push(`${contentClass} posts are performing best (median ${medianViews.toLocaleString()} views).`)
  }
  if (brief.bestHook) {
    parts.push(`Your best hook so far: "${brief.bestHook.hook}" (${brief.bestHook.views.toLocaleString()} views on "${brief.bestHook.title}").`)
  }
  if (brief.recommendedLengthSeconds !== null) {
    parts.push(`Aim for around ${brief.recommendedLengthSeconds}s — that's what's worked best recently.`)
  }
  return parts.length > 0 ? parts.join(' ') : 'Not enough tracked performance data yet to draw a pattern.'
}

export function generateNextPostBrief(ideas: ContentIdeaWithPerformance[]): NextPostBrief | null {
  const entries = flattenPerformances(ideas.filter(i => i.status === 'TRACKED'))
    .filter((ip): ip is TrackedEntry => ip.perf.views !== null)

  if (entries.length < MIN_TRACKED_POSTS) return null

  const partial = {
    postCount: entries.length,
    topPillar: topPillarByMedianViews(entries),
    topContentClass: topContentClassByMedianViews(entries),
    bestHook: bestHookFromEntries(entries),
    recommendedLengthSeconds: recommendedLengthFromEntries(entries),
  }

  return { ...partial, summary: buildSummary(partial) }
}
