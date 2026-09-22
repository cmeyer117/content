import { describe, it, expect } from 'vitest'
import { generateNextPostBrief } from '@/lib/nextPostBrief'
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

function tracked(id: string, overrides: Partial<ContentIdeaWithPerformance>, views: number, perfOverrides: Partial<PostPerformance> = {}): ContentIdeaWithPerformance {
  return makeIdea({
    id,
    status: 'TRACKED',
    performances: [makePerformance({ id: `perf-${id}`, content_idea_id: id, views, ...perfOverrides })],
    ...overrides,
  })
}

describe('generateNextPostBrief', () => {
  it('returns null with fewer than 3 tracked posts with views', () => {
    const ideas = [
      tracked('a', { pillar: 'training' }, 100),
      tracked('b', { pillar: 'training' }, 200),
    ]
    expect(generateNextPostBrief(ideas)).toBeNull()
  })

  it('ignores ideas that are not TRACKED', () => {
    const ideas = [
      tracked('a', { pillar: 'training' }, 100),
      tracked('b', { pillar: 'training' }, 200),
      makeIdea({ id: 'c', status: 'DRAFT', pillar: 'training', performances: [makePerformance({ id: 'perf-c', content_idea_id: 'c', views: 9999 })] }),
    ]
    expect(generateNextPostBrief(ideas)).toBeNull()
  })

  it('ignores performance rows with null views', () => {
    const ideas = [
      tracked('a', { pillar: 'training' }, 100),
      tracked('b', { pillar: 'training' }, 200),
      tracked('c', { pillar: 'training' }, 0, { views: null }),
    ]
    expect(generateNextPostBrief(ideas)).toBeNull()
  })

  it('identifies the top pillar by median views', () => {
    const ideas = [
      tracked('a', { pillar: 'training' }, 100),
      tracked('b', { pillar: 'training' }, 120),
      tracked('c', { pillar: 'diet' }, 500),
      tracked('d', { pillar: 'diet' }, 600),
    ]
    const brief = generateNextPostBrief(ideas)
    expect(brief?.topPillar).toEqual({ pillar: 'diet', label: 'Diet', medianViews: 550, postCount: 2 })
  })

  it('identifies the top content class by median views, ignoring null classes', () => {
    const ideas = [
      tracked('a', { pillar: 'training', content_class: 'technique' }, 100),
      tracked('b', { pillar: 'training', content_class: 'technique' }, 300),
      tracked('c', { pillar: 'training', content_class: 'diary' }, 50),
      tracked('d', { pillar: 'training', content_class: null }, 9000),
    ]
    const brief = generateNextPostBrief(ideas)
    expect(brief?.topContentClass).toEqual({ contentClass: 'technique', medianViews: 200, postCount: 2 })
  })

  it('picks the single best-performing hook', () => {
    const ideas = [
      tracked('a', { pillar: 'training', title: 'Idea A', hook_first_2s: 'hook A' }, 100),
      tracked('b', { pillar: 'training', title: 'Idea B', hook_first_2s: 'hook B' }, 300),
      tracked('c', { pillar: 'training', title: 'Idea C', hook: null, hook_first_2s: null }, 50),
    ]
    const brief = generateNextPostBrief(ideas)
    expect(brief?.bestHook).toEqual({ ideaId: 'b', title: 'Idea B', hook: 'hook B', views: 300 })
  })

  it('falls back to hook when hook_first_2s is null', () => {
    const ideas = [
      tracked('a', { pillar: 'training', title: 'Idea A', hook: 'plain hook', hook_first_2s: null }, 400),
      tracked('b', { pillar: 'training' }, 100),
      tracked('c', { pillar: 'training' }, 50),
    ]
    const brief = generateNextPostBrief(ideas)
    expect(brief?.bestHook).toEqual({ ideaId: 'a', title: 'Idea A', hook: 'plain hook', views: 400 })
  })

  it('recommends a length from the median of the top half by views', () => {
    const ideas = [
      tracked('a', { pillar: 'training', target_length_seconds: 60 }, 10),
      tracked('b', { pillar: 'training', target_length_seconds: 30 }, 500),
      tracked('c', { pillar: 'training', target_length_seconds: 20 }, 400),
      tracked('d', { pillar: 'training', target_length_seconds: 90 }, 5),
    ]
    // top half by views: b(30s,500), c(20s,400) -> median 25, rounded
    const brief = generateNextPostBrief(ideas)
    expect(brief?.recommendedLengthSeconds).toBe(25)
  })

  it('produces a non-empty summary mentioning the top pillar', () => {
    const ideas = [
      tracked('a', { pillar: 'diet' }, 500),
      tracked('b', { pillar: 'diet' }, 600),
      tracked('c', { pillar: 'training' }, 10),
    ]
    const brief = generateNextPostBrief(ideas)
    expect(brief?.summary).toContain('Diet')
  })

  it('reports postCount as the number of tracked performance entries with views', () => {
    const ideas = [
      tracked('a', { pillar: 'training' }, 100),
      tracked('b', { pillar: 'training' }, 200),
      tracked('c', { pillar: 'training' }, 300),
    ]
    expect(generateNextPostBrief(ideas)?.postCount).toBe(3)
  })
})
