import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SpotlightCard from '@/components/SpotlightCard'
import type { ContentIdeaWithPerformance, PostPerformance } from '@/types/content'

function makeIdea(overrides: Partial<ContentIdeaWithPerformance>): ContentIdeaWithPerformance {
  return {
    id: 'x', title: 'My best post', body: null, pillar: 'training', platform: 'tiktok', status: 'TRACKED',
    hook: null, content_class: null, hook_first_2s: null, viewer_payoff: null,
    target_length_seconds: null, length_justification: null, diary_justification: null,
    notes: null, scheduled_at: null, posted_at: '2026-07-20T12:00:00Z', idea_score: null, idea_score_notes: null,
    execution_score: null, execution_score_notes: null, predicted_score: null,
    predicted_reasoning: null, predicted_at: null, prediction_version: null,
    source_intel_insight_id: null, experiment_id: null,
    created_at: '2026-07-19T12:00:00Z',
    performances: [],
    ...overrides,
  }
}

function makePerformance(overrides: Partial<PostPerformance> = {}): PostPerformance {
  return {
    id: 'perf-1', content_idea_id: 'x', platform: 'tiktok', post_url: null, posted_at: '2026-07-20T12:00:00Z',
    views: 5000, likes: null, shares: 42, saves: null,
    metricool_reach: null, metricool_engagement_rate: null, metricool_comments: null,
    metricool_3s_retention_pct: null, metricool_watch_through_ratio: null, metricool_synced_at: null,
    created_at: '2026-07-20T12:00:00Z',
    ...overrides,
  }
}

describe('SpotlightCard', () => {
  it('renders the title, platform, views, and shares of the given idea/performance pair', () => {
    const idea = makeIdea({})
    const perf = makePerformance({})
    render(<SpotlightCard top={{ idea, perf }} />)
    expect(screen.getByText('My best post')).toBeTruthy()
    expect(screen.getByText(/5,000/)).toBeTruthy()
    expect(screen.getByText(/42/)).toBeTruthy()
    expect(screen.getByText(/tiktok/)).toBeTruthy()
  })

  it('renders an EmptyState when top is null', () => {
    render(<SpotlightCard top={null} />)
    expect(screen.getByText(/not enough data yet/i)).toBeTruthy()
  })
})
