import type { ContentIdeaWithPerformance, PostPerformance, PostPlatform } from '@/types/content'
import { flattenPerformances, type IdeaPerf } from '@/lib/chartData'

export type Winner = {
  idea: ContentIdeaWithPerformance
  perf: PostPerformance
  baselineMedian: number
  multiple: number
}

export const SERIES_ANGLES: { angle: 'same-promise' | 'objection' | 'progression'; label: string; prompt: string }[] = [
  { angle: 'same-promise', label: 'Same Promise', prompt: 'Make the same case again, differently.' },
  { angle: 'objection', label: 'Objection', prompt: 'Answer the objection that stopped people acting on the promise.' },
  { angle: 'progression', label: 'Progression', prompt: 'The next step after someone already acted on the first video.' },
]

const BASELINE_WINDOW = 10
const BASELINE_MIN = 5
const WINNER_MULTIPLE = 2
const MIN_AGE_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

// Per platform: last BASELINE_WINDOW TRACKED posts (most recent by posted_at)
// form both the baseline (median) and the candidate pool -- a post outside
// that window is stale signal even if it once out-performed.
export function detectWinners(ideas: ContentIdeaWithPerformance[], now: Date): Winner[] {
  const usedPerformanceIds = new Set(
    ideas.map(i => i.series_source_performance_id).filter((id): id is string => id !== null),
  )

  const trackedPerfs = flattenPerformances(ideas.filter(i => i.status === 'TRACKED'))
    .filter((ip): ip is IdeaPerf & { perf: { posted_at: string; views: number } } =>
      ip.perf.posted_at !== null && ip.perf.views !== null)

  const platforms = [...new Set(trackedPerfs.map(ip => ip.perf.platform))] as PostPlatform[]

  const winners: Winner[] = []
  for (const platform of platforms) {
    const window = trackedPerfs
      .filter(ip => ip.perf.platform === platform)
      .sort((a, b) => b.perf.posted_at.localeCompare(a.perf.posted_at))
      .slice(0, BASELINE_WINDOW)

    if (window.length < BASELINE_MIN) continue

    const baselineMedian = median(window.map(ip => ip.perf.views))
    if (baselineMedian <= 0) continue

    for (const { idea, perf } of window) {
      if (usedPerformanceIds.has(perf.id)) continue
      const ageDays = (now.getTime() - new Date(perf.posted_at).getTime()) / DAY_MS
      if (ageDays < MIN_AGE_DAYS) continue
      const multiple = perf.views / baselineMedian
      if (multiple < WINNER_MULTIPLE) continue
      winners.push({ idea, perf, baselineMedian, multiple })
    }
  }

  return winners
}
