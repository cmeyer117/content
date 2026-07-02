export type Pillar = 'training' | 'diet' | 'mindset' | 'life'
export type Platform = 'tiktok' | 'instagram' | 'both'
export type PipelineStatus = 'IDEA' | 'DRAFT' | 'READY' | 'SCHEDULED' | 'POSTED' | 'TRACKED'

export type ContentIdea = {
  id: string
  title: string
  body: string | null
  pillar: Pillar
  platform: Platform
  status: PipelineStatus
  hook: string | null
  notes: string | null
  scheduled_at: string | null
  posted_at: string | null
  views: number | null
  likes: number | null
  shares: number | null
  saves: number | null
  post_url: string | null
  created_at: string
}

export type NewContentIdea = Omit<ContentIdea, 'id' | 'created_at'>
