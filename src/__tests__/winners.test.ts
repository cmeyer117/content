import { describe, it, expect } from 'vitest'
import { detectWinners, SERIES_ANGLES } from '@/lib/winners'
import type { ContentIdeaWithPerformance, PostPerformance, SeriesAngle } from '@/types/content'

function makeIdea(overrides: Partial<ContentIdeaWithPerformance>): ContentIdeaWithPerformance {
  return {
    id: 'x', title: 't', body: null, pillar: 'training', platform: 'tiktok', status: 'IDEA',
    hook: null, content_class: null, hook_first_2s: null, viewer_payoff: null,
    target_length_seconds: null, length_justification: null, diary_justification: null,
    notes: null, scheduled_at: null, posted_at: null, idea_score: null, idea_score_notes: null,
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

const NOW = new Date('2026-08-20T12:00:00Z')

// Builds N tracked TikTok posts posted on distinct days ending `daysAgo` back
// from NOW, with the given views (index 0 = most recent).
function baseline(views: number[], platform: 'tiktok' | 'instagram' = 'tiktok', startDaysAgo = 10): ContentIdeaWithPerformance[] {
  return views.map((v, i) => {
    const daysAgo = startDaysAgo + i
    const postedAt = new Date(NOW.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
    return makeIdea({
      id: `idea-${i}`,
      status: 'TRACKED',
      performances: [makePerformance({ id: `perf-${i}`, content_idea_id: `idea-${i}`, platform, views: v, posted_at: postedAt })],
    })
  })
}

describe('detectWinners', () => {
  it('returns nothing with fewer than 5 tracked posts on a platform', () => {
    const ideas = baseline([10, 20, 30, 40])
    expect(detectWinners(ideas, NOW)).toEqual([])
  })

  it('flags a post at >= 2x the baseline median, old enough, as a winner', () => {
    // baseline views: 10,10,10,10,10 -> median 10. Add a 6th post (most
    // recent, index 0) at 25 views, 10 days old -- 2.5x median.
    const rest = baseline([10, 10, 10, 10, 10], 'tiktok', 10)
    const winnerIdea = makeIdea({
      id: 'winner',
      status: 'TRACKED',
      performances: [makePerformance({ id: 'perf-winner', content_idea_id: 'winner', platform: 'tiktok', views: 25, posted_at: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString() })],
    })
    const winners = detectWinners([...rest, winnerIdea], NOW)
    expect(winners).toHaveLength(1)
    expect(winners[0].idea.id).toBe('winner')
    expect(winners[0].baselineMedian).toBe(10)
    expect(winners[0].multiple).toBe(2.5)
  })

  it('does not flag a post under 2x the median', () => {
    const ideas = baseline([10, 10, 10, 10, 10, 15])
    expect(detectWinners(ideas, NOW)).toEqual([])
  })

  it('computes a true-middle median for an odd-length baseline (5 posts)', () => {
    // Candidate(20) + rest(10,10,12,5) sorted: 5,10,10,12,20 -> middle
    // element is 10, a true median (not an average of two), and no other
    // post in the window crosses 2x that median on its own.
    const rest = baseline([10, 10, 12, 5], 'tiktok', 11)
    const candidate = makeIdea({
      id: 'odd-winner',
      status: 'TRACKED',
      performances: [makePerformance({ id: 'perf-odd', content_idea_id: 'odd-winner', platform: 'tiktok', views: 20, posted_at: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString() })],
    })
    const winners = detectWinners([...rest, candidate], NOW)
    expect(winners).toHaveLength(1)
    expect(winners[0].baselineMedian).toBe(10)
    expect(winners[0].multiple).toBe(2)
  })

  it('flags exactly at the 2.00x boundary (inclusive)', () => {
    const rest = baseline([10, 10, 10, 10, 10], 'tiktok', 10)
    const exact = makeIdea({
      id: 'exact-2x',
      status: 'TRACKED',
      performances: [makePerformance({ id: 'perf-exact-2x', content_idea_id: 'exact-2x', platform: 'tiktok', views: 20, posted_at: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString() })],
    })
    const winners = detectWinners([...rest, exact], NOW)
    expect(winners.map(w => w.idea.id)).toContain('exact-2x')
  })

  it('does not flag just under the 2.00x boundary', () => {
    const rest = baseline([10, 10, 10, 10, 10], 'tiktok', 10)
    const justUnder = makeIdea({
      id: 'under-2x',
      status: 'TRACKED',
      performances: [makePerformance({ id: 'perf-under-2x', content_idea_id: 'under-2x', platform: 'tiktok', views: 19, posted_at: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString() })],
    })
    const winners = detectWinners([...rest, justUnder], NOW)
    expect(winners.map(w => w.idea.id)).not.toContain('under-2x')
  })

  it('flags exactly at the 7-day-old boundary (inclusive)', () => {
    const rest = baseline([10, 10, 10, 10, 10], 'tiktok', 8)
    const exactlySevenDays = makeIdea({
      id: 'exact-7d',
      status: 'TRACKED',
      performances: [makePerformance({ id: 'perf-exact-7d', content_idea_id: 'exact-7d', platform: 'tiktok', views: 100, posted_at: new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() })],
    })
    const winners = detectWinners([...rest, exactlySevenDays], NOW)
    expect(winners.map(w => w.idea.id)).toContain('exact-7d')
  })

  it('does not flag just under the 7-day-old boundary', () => {
    const rest = baseline([10, 10, 10, 10, 10], 'tiktok', 8)
    const justUnderSevenDays = makeIdea({
      id: 'under-7d',
      status: 'TRACKED',
      performances: [makePerformance({ id: 'perf-under-7d', content_idea_id: 'under-7d', platform: 'tiktok', views: 100, posted_at: new Date(NOW.getTime() - 6.9 * 24 * 60 * 60 * 1000).toISOString() })],
    })
    const winners = detectWinners([...rest, justUnderSevenDays], NOW)
    expect(winners.map(w => w.idea.id)).not.toContain('under-7d')
  })

  it('does not flag a winner-shaped post younger than 7 days', () => {
    const rest = baseline([10, 10, 10, 10, 10], 'tiktok', 10)
    const tooYoung = makeIdea({
      id: 'young',
      status: 'TRACKED',
      performances: [makePerformance({ id: 'perf-young', content_idea_id: 'young', platform: 'tiktok', views: 100, posted_at: new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString() })],
    })
    expect(detectWinners([...rest, tooYoung], NOW)).toEqual([])
  })

  it('excludes a performance already used as a series source', () => {
    const rest = baseline([10, 10, 10, 10, 10], 'tiktok', 10)
    const alreadyUsed = makeIdea({
      id: 'used-source',
      status: 'TRACKED',
      performances: [makePerformance({ id: 'perf-used', content_idea_id: 'used-source', platform: 'tiktok', views: 50, posted_at: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString() })],
    })
    const followUp = makeIdea({ id: 'follow-up', status: 'DRAFT', series_source_performance_id: 'perf-used' })
    expect(detectWinners([...rest, alreadyUsed, followUp], NOW)).toEqual([])
  })

  it('keeps TikTok and Instagram baselines independent', () => {
    // 5 TikTok posts (enough baseline), only 2 Instagram posts (not enough).
    const tiktok = baseline([10, 10, 10, 10, 10], 'tiktok', 10)
    const instagram = baseline([5, 5], 'instagram', 3)
    const igWinnerShaped = makeIdea({
      id: 'ig-candidate',
      status: 'TRACKED',
      performances: [makePerformance({ id: 'perf-ig', content_idea_id: 'ig-candidate', platform: 'instagram', views: 999, posted_at: new Date(NOW.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString() })],
    })
    // Instagram has only 3 tracked posts total (< BASELINE_MIN) -- no IG
    // winners possible despite the huge view count, and TikTok's own
    // baseline (all equal views) produces no winners of its own either.
    const winners = detectWinners([...tiktok, ...instagram, igWinnerShaped], NOW)
    expect(winners).toEqual([])
  })

  it('only considers the most recent BASELINE_WINDOW posts per platform', () => {
    // 11 tracked posts, all views=10 except the OLDEST (11th, outside the
    // 10-post window) which is 1000 -- must not skew the median or be a candidate.
    const recent10 = baseline([10, 10, 10, 10, 10, 10, 10, 10, 10, 10], 'tiktok', 8)
    const outlierOld = makeIdea({
      id: 'ancient',
      status: 'TRACKED',
      performances: [makePerformance({ id: 'perf-ancient', content_idea_id: 'ancient', platform: 'tiktok', views: 1000, posted_at: new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString() })],
    })
    const winners = detectWinners([...recent10, outlierOld], NOW)
    expect(winners).toEqual([])
  })
})

describe('SERIES_ANGLES', () => {
  it('has exactly the three documented angles, in order', () => {
    expect(SERIES_ANGLES.map(a => a.angle)).toEqual<SeriesAngle[]>(['same-promise', 'objection', 'progression'])
  })
})
