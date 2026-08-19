import type { ContentIdea } from '@/types/content'

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

export function experimentRows(ideas: ContentIdea[], experimentId: string): ExperimentRow[] {
  return ideas
    .filter(i => i.experiment_id === experimentId)
    .map(i => ({
      id: i.id,
      title: i.title,
      content_class: i.content_class,
      hook: i.hook,
      target_length_seconds: i.target_length_seconds,
      views: i.views,
      likes: i.likes,
      shares: i.shares,
      saves: i.saves,
      metricool_engagement_rate: i.metricool_engagement_rate,
    }))
}
