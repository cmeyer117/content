import { describe, it, expect } from 'vitest'
import { experimentRows } from '@/lib/experiments'
import type { ContentIdeaWithPerformance, PostPerformance } from '@/types/content'

function makeIdea(overrides: Partial<ContentIdeaWithPerformance>): ContentIdeaWithPerformance {
  return {
    id: 'x', title: 't', body: null, pillar: 'training', platform: 'tiktok', status: 'IDEA',
    hook: null, content_class: null, hook_first_2s: null, viewer_payoff: null,
    target_length_seconds: null, length_justification: null, diary_justification: null,
    notes: null, source_intel_insight_id: null, scheduled_at: null, posted_at: null,
    idea_score: null, idea_score_notes: null, execution_score: null, execution_score_notes: null,
    predicted_score: null, predicted_reasoning: null, predicted_at: null, prediction_version: null,
    experiment_id: null, series_source_performance_id: null, angle: null, position: null,
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

describe('experimentRows', () => {
  it('returns an empty array when no ideas are tagged into the experiment', () => {
    const ideas = [makeIdea({ id: 'a', experiment_id: null })]
    expect(experimentRows(ideas, 'exp-1')).toEqual([])
  })

  it('includes both posted and unposted ideas tagged into the experiment', () => {
    const ideas = [
      makeIdea({ id: 'a', experiment_id: 'exp-1', status: 'IDEA', performances: [] }),
      makeIdea({ id: 'b', experiment_id: 'exp-1', status: 'TRACKED', performances: [makePerformance({ views: 500 })] }),
    ]
    const result = experimentRows(ideas, 'exp-1')
    expect(result.map(r => r.id)).toEqual(['a', 'b'])
    expect(result[0].views).toBeNull()
    expect(result[1].views).toBe(500)
  })

  it('excludes ideas tagged into a different experiment', () => {
    const ideas = [
      makeIdea({ id: 'a', experiment_id: 'exp-1' }),
      makeIdea({ id: 'b', experiment_id: 'exp-2' }),
    ]
    expect(experimentRows(ideas, 'exp-1').map(r => r.id)).toEqual(['a'])
  })

  it('carries content_class, hook, target_length_seconds, and the 4 outcome metrics plus engagement rate for a single-platform idea', () => {
    const ideas = [makeIdea({
      id: 'a', experiment_id: 'exp-1', content_class: 'technique', hook: 'Do this instead',
      target_length_seconds: 22,
      performances: [makePerformance({ views: 100, likes: 10, shares: 2, saves: 5, metricool_engagement_rate: 4.2 })],
    })]
    expect(experimentRows(ideas, 'exp-1')[0]).toEqual({
      id: 'a', title: 't', content_class: 'technique', hook: 'Do this instead',
      target_length_seconds: 22, views: 100, likes: 10, shares: 2, saves: 5, metricool_engagement_rate: 4.2,
    })
  })

  it('sums counts and averages engagement rate across a both-platform idea\'s two performance rows', () => {
    const ideas = [makeIdea({
      id: 'a', experiment_id: 'exp-1', platform: 'both',
      performances: [
        makePerformance({ platform: 'tiktok', views: 100, likes: 10, shares: 2, saves: null, metricool_engagement_rate: 3.0 }),
        makePerformance({ platform: 'instagram', views: 40, likes: 5, shares: 1, saves: 3, metricool_engagement_rate: 5.0 }),
      ],
    })]
    const row = experimentRows(ideas, 'exp-1')[0]
    expect(row.views).toBe(140)
    expect(row.likes).toBe(15)
    expect(row.shares).toBe(3)
    expect(row.saves).toBe(3)
    expect(row.metricool_engagement_rate).toBe(4.0)
  })
})
