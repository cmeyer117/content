import { describe, it, expect } from 'vitest'
import { experimentRows } from '@/lib/experiments'
import type { ContentIdea } from '@/types/content'

function makeIdea(overrides: Partial<ContentIdea>): ContentIdea {
  return {
    id: 'x', title: 't', body: null, pillar: 'training', platform: 'tiktok', status: 'IDEA',
    hook: null, content_class: null, hook_first_2s: null, viewer_payoff: null,
    target_length_seconds: null, length_justification: null, diary_justification: null,
    notes: null, source_intel_insight_id: null, scheduled_at: null, posted_at: null,
    views: null, likes: null, shares: null, saves: null, post_url: null, post_url_instagram: null,
    idea_score: null, idea_score_notes: null, execution_score: null, execution_score_notes: null,
    predicted_score: null, predicted_reasoning: null, predicted_at: null, prediction_version: null,
    metricool_reach: null, metricool_engagement_rate: null, metricool_comments: null,
    metricool_3s_retention_pct: null, metricool_watch_through_ratio: null, metricool_synced_at: null,
    experiment_id: null, created_at: '2026-01-01T12:00:00Z',
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
      makeIdea({ id: 'a', experiment_id: 'exp-1', status: 'IDEA', views: null }),
      makeIdea({ id: 'b', experiment_id: 'exp-1', status: 'TRACKED', views: 500 }),
    ]
    const result = experimentRows(ideas, 'exp-1')
    expect(result.map(r => r.id)).toEqual(['a', 'b'])
    expect(result[1].views).toBe(500)
  })

  it('excludes ideas tagged into a different experiment', () => {
    const ideas = [
      makeIdea({ id: 'a', experiment_id: 'exp-1' }),
      makeIdea({ id: 'b', experiment_id: 'exp-2' }),
    ]
    expect(experimentRows(ideas, 'exp-1').map(r => r.id)).toEqual(['a'])
  })

  it('carries content_class, hook, target_length_seconds, and the 4 outcome metrics plus engagement rate', () => {
    const ideas = [makeIdea({
      id: 'a', experiment_id: 'exp-1', content_class: 'technique', hook: 'Do this instead',
      target_length_seconds: 22, views: 100, likes: 10, shares: 2, saves: 5, metricool_engagement_rate: 4.2,
    })]
    expect(experimentRows(ideas, 'exp-1')[0]).toEqual({
      id: 'a', title: 't', content_class: 'technique', hook: 'Do this instead',
      target_length_seconds: 22, views: 100, likes: 10, shares: 2, saves: 5, metricool_engagement_rate: 4.2,
    })
  })
})
