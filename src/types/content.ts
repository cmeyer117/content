export type Pillar = 'training' | 'diet' | 'mindset' | 'life' | 'faith'
export type Platform = 'tiktok' | 'instagram' | 'both'
export type PipelineStatus = 'IDEA' | 'DRAFT' | 'READY' | 'SCHEDULED' | 'POSTED' | 'TRACKED'
export type ContentClass = 'technique' | 'craft' | 'transformation' | 'diary'

export type ContentIdea = {
  id: string
  title: string
  body: string | null
  pillar: Pillar
  platform: Platform
  status: PipelineStatus
  hook: string | null
  content_class: ContentClass | null
  hook_first_2s: string | null
  viewer_payoff: string | null
  target_length_seconds: number | null
  length_justification: string | null
  diary_justification: string | null
  notes: string | null
  source_intel_insight_id: string | null
  scheduled_at: string | null
  posted_at: string | null
  views: number | null
  likes: number | null
  shares: number | null
  saves: number | null
  post_url: string | null
  post_url_instagram: string | null
  idea_score: number | null
  idea_score_notes: string | null
  execution_score: number | null
  execution_score_notes: string | null
  predicted_score: number | null
  predicted_reasoning: string | null
  predicted_at: string | null
  prediction_version: string | null
  metricool_reach: number | null
  metricool_engagement_rate: number | null
  metricool_comments: number | null
  metricool_3s_retention_pct: number | null
  metricool_watch_through_ratio: number | null
  metricool_synced_at: string | null
  created_at: string
}

export type NewContentIdea = Omit<ContentIdea, 'id' | 'created_at'>
