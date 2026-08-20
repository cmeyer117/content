export type Pillar = 'training' | 'diet' | 'mindset' | 'life' | 'faith'
export type Platform = 'tiktok' | 'instagram' | 'both'
export type PipelineStatus = 'IDEA' | 'DRAFT' | 'READY' | 'SCHEDULED' | 'POSTED' | 'TRACKED'
export type ContentClass = 'technique' | 'craft' | 'transformation' | 'diary'
export type ExperimentStatus = 'active' | 'concluded'

export type Experiment = {
  id: string
  hypothesis: string
  status: ExperimentStatus
  verdict: string | null
  created_at: string
}

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
  experiment_id: string | null
  scheduled_at: string | null
  posted_at: string | null
  idea_score: number | null
  idea_score_notes: string | null
  execution_score: number | null
  execution_score_notes: string | null
  predicted_score: number | null
  predicted_reasoning: string | null
  predicted_at: string | null
  prediction_version: string | null
  created_at: string
  series_source_performance_id: string | null
  angle: SeriesAngle | null
  position: number | null
}

export type SeriesAngle = 'same-promise' | 'objection' | 'progression'

export type NewContentIdea = Omit<ContentIdea, 'id' | 'created_at'>

export type PostPlatform = 'tiktok' | 'instagram'

export type PostPerformance = {
  id: string
  content_idea_id: string
  platform: PostPlatform
  post_url: string | null
  posted_at: string | null
  views: number | null
  likes: number | null
  shares: number | null
  saves: number | null
  metricool_reach: number | null
  metricool_engagement_rate: number | null
  metricool_comments: number | null
  metricool_3s_retention_pct: number | null
  metricool_watch_through_ratio: number | null
  metricool_synced_at: string | null
  created_at: string
}

export type NewPostPerformance = Omit<PostPerformance, 'id' | 'created_at'>

export type ContentIdeaWithPerformance = ContentIdea & { performances: PostPerformance[] }
