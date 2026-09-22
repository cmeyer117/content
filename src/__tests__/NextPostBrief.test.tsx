import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NextPostBrief from '@/components/NextPostBrief'
import type { ContentIdeaWithPerformance, PostPerformance } from '@/types/content'

function makeIdea(overrides: Partial<ContentIdeaWithPerformance>): ContentIdeaWithPerformance {
  return {
    id: 'x', title: 't', body: null, pillar: 'training', platform: 'tiktok', status: 'IDEA',
    hook: null, content_class: null, hook_first_2s: null, viewer_payoff: null,
    target_length_seconds: null, length_justification: null, diary_justification: null,
    notes: null, scheduled_at: null, publish_at: null, posted_at: null, idea_score: null, idea_score_notes: null,
    execution_score: null, execution_score_notes: null, predicted_score: null,
    predicted_reasoning: null, predicted_at: null, prediction_version: null,
    source_intel_insight_id: null, experiment_id: null,
    series_source_performance_id: null, angle: null, position: null,
    created_at: '2026-01-01T12:00:00Z',
    performances: [],
    ...overrides,
  }
}

function makePerformance(overrides: Partial<PostPerformance> = {}): PostPerformance {
  return {
    id: 'perf-1', content_idea_id: 'x', platform: 'tiktok', post_url: null, posted_at: null,
    views: null, likes: null, shares: null, saves: null,
    metricool_reach: null, metricool_engagement_rate: null, metricool_comments: null,
    metricool_3s_retention_pct: null, metricool_watch_through_ratio: null, metricool_synced_at: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function tracked(id: string, overrides: Partial<ContentIdeaWithPerformance>, views: number): ContentIdeaWithPerformance {
  return makeIdea({
    id,
    status: 'TRACKED',
    performances: [makePerformance({ id: `perf-${id}`, content_idea_id: id, views })],
    ...overrides,
  })
}

describe('NextPostBrief', () => {
  it('renders nothing when there is not enough tracked data', () => {
    const ideas = [tracked('a', { pillar: 'training' }, 100)]
    const { container } = render(<NextPostBrief ideas={ideas} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the summary once there is enough tracked data', () => {
    const ideas = [
      tracked('a', { pillar: 'diet' }, 500),
      tracked('b', { pillar: 'diet' }, 600),
      tracked('c', { pillar: 'training' }, 10),
    ]
    render(<NextPostBrief ideas={ideas} />)
    expect(screen.getByText(/Diet is your top pillar/)).toBeTruthy()
  })
})
