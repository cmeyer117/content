import type { ContentIdea, ContentIdeaWithPerformance } from '@/types/content'

export type ExperimentRow = {
  id: string
  title: string
  content_class: ContentIdea['content_class']
  hook: string | null
  target_length_seconds: number | null
  views: number | null
  likes: number | null
  shares: number | null
  saves: number | null
  metricool_engagement_rate: number | null
}

// One row per idea (experiments compare ideas, not platforms) -- a
// both-platform idea's performance rows get summed for counts, averaged for
// engagement rate, same convention chartData.ts's metricoolTotals uses.
export function experimentRows(ideas: ContentIdeaWithPerformance[], experimentId: string): ExperimentRow[] {
  return ideas
    .filter(i => i.experiment_id === experimentId)
    .map(i => {
      const perfs = i.performances
      const sum = (field: 'views' | 'likes' | 'shares' | 'saves') =>
        perfs.length === 0 ? null : perfs.reduce((total, p) => total + (p[field] ?? 0), 0)
      const rates = perfs.map(p => p.metricool_engagement_rate).filter((r): r is number => r !== null)
      return {
        id: i.id,
        title: i.title,
        content_class: i.content_class,
        hook: i.hook,
        target_length_seconds: i.target_length_seconds,
        views: sum('views'),
        likes: sum('likes'),
        shares: sum('shares'),
        saves: sum('saves'),
        metricool_engagement_rate: rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
      }
    })
}
