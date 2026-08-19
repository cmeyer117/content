import { describe, it, expect } from 'vitest'
import { countByPillar, countByStage, countByWeek, countByPillarAndStage, getTopPerformer, getTopNByViews, sumViewsByPillar, sumViewsByWeek, postedDaysSet, metricoolTotals } from '@/lib/chartData'
import type { ContentIdea } from '@/types/content'

function makeIdea(overrides: Partial<ContentIdea>): ContentIdea {
  return {
    id: 'x', title: 't', body: null, pillar: 'training', platform: 'tiktok', status: 'IDEA',
    hook: null, content_class: null, hook_first_2s: null, viewer_payoff: null,
    target_length_seconds: null, length_justification: null, diary_justification: null,
    notes: null, scheduled_at: null, posted_at: null, views: null, likes: null,
    shares: null, saves: null, post_url: null, post_url_instagram: null, idea_score: null, idea_score_notes: null,
    execution_score: null, execution_score_notes: null, predicted_score: null,
    predicted_reasoning: null, predicted_at: null, prediction_version: null,
    metricool_reach: null, metricool_engagement_rate: null, metricool_comments: null, metricool_3s_retention_pct: null, metricool_watch_through_ratio: null, metricool_synced_at: null,
    source_intel_insight_id: null,
    created_at: '2026-01-01T12:00:00Z',
    ...overrides,
  }
}

describe('countByPillar', () => {
  it('returns all 5 pillars even when some have zero ideas', () => {
    const ideas = [makeIdea({ pillar: 'training' }), makeIdea({ pillar: 'training' }), makeIdea({ pillar: 'faith' })]
    const result = countByPillar(ideas)
    expect(result).toHaveLength(5)
    expect(result.find(r => r.pillar === 'training')?.count).toBe(2)
    expect(result.find(r => r.pillar === 'faith')?.count).toBe(1)
    expect(result.find(r => r.pillar === 'diet')?.count).toBe(0)
  })

  it('returns all-zero counts for an empty array', () => {
    const result = countByPillar([])
    expect(result).toHaveLength(5)
    expect(result.every(r => r.count === 0)).toBe(true)
  })
})

describe('sumViewsByPillar', () => {
  it('sums views per pillar for TRACKED ideas only', () => {
    const ideas = [
      makeIdea({ pillar: 'training', status: 'TRACKED', views: 100 }),
      makeIdea({ pillar: 'training', status: 'TRACKED', views: 50 }),
      makeIdea({ pillar: 'faith', status: 'TRACKED', views: 30 }),
      makeIdea({ pillar: 'training', status: 'IDEA', views: 9000 }), // not TRACKED, ignored
    ]
    const result = sumViewsByPillar(ideas)
    expect(result).toHaveLength(5)
    expect(result.find(r => r.pillar === 'training')?.views).toBe(150)
    expect(result.find(r => r.pillar === 'faith')?.views).toBe(30)
    expect(result.find(r => r.pillar === 'diet')?.views).toBe(0)
  })

  it('treats null views as 0', () => {
    const ideas = [makeIdea({ pillar: 'life', status: 'TRACKED', views: null })]
    const result = sumViewsByPillar(ideas)
    expect(result.find(r => r.pillar === 'life')?.views).toBe(0)
  })

  it('returns all-zero views for an empty array', () => {
    const result = sumViewsByPillar([])
    expect(result).toHaveLength(5)
    expect(result.every(r => r.views === 0)).toBe(true)
  })
})

describe('countByStage', () => {
  it('returns all 6 stages in PIPELINE_STAGES order, even at zero', () => {
    const ideas = [makeIdea({ status: 'IDEA' }), makeIdea({ status: 'IDEA' }), makeIdea({ status: 'TRACKED' })]
    const result = countByStage(ideas)
    expect(result.map(r => r.stage)).toEqual(['IDEA', 'DRAFT', 'READY', 'SCHEDULED', 'POSTED', 'TRACKED'])
    expect(result.find(r => r.stage === 'IDEA')?.count).toBe(2)
    expect(result.find(r => r.stage === 'READY')?.count).toBe(0)
  })
})

describe('countByWeek', () => {
  it('returns an empty array for no ideas', () => {
    expect(countByWeek([])).toEqual([])
  })

  it('buckets by America/New_York, not UTC — a Mon 04:30 UTC timestamp is Sun 23:30 EST', () => {
    // 2026-01-05T04:30:00Z is UTC-Monday, but EST (UTC-5, no DST in January) local time
    // is 2026-01-04 23:30, a Sunday. Sunday Jan 4 2026 falls in the week starting
    // Monday Dec 29 2025 — NOT the week starting Jan 5. If this bucketed by UTC or
    // browser-local time instead of America/New_York, it would land in the wrong week.
    const result = countByWeek([makeIdea({ created_at: '2026-01-05T04:30:00Z' })])
    expect(result).toEqual([{ weekStart: '2025-12-29', count: 1 }])
  })

  it('fills missing weeks between the earliest and latest idea with zero', () => {
    const ideas = [
      makeIdea({ created_at: '2026-01-05T12:00:00Z' }), // Mon Jan 5 (NY: still Jan 5, noon UTC = 7am EST)
      makeIdea({ created_at: '2026-01-19T12:00:00Z' }), // Mon Jan 19 — two weeks later, one week gap
    ]
    const result = countByWeek(ideas)
    expect(result).toEqual([
      { weekStart: '2026-01-05', count: 1 },
      { weekStart: '2026-01-12', count: 0 },
      { weekStart: '2026-01-19', count: 1 },
    ])
  })
})

describe('sumViewsByWeek', () => {
  it('returns an empty array when nothing has posted_at set', () => {
    expect(sumViewsByWeek([makeIdea({ posted_at: null, views: 500 })])).toEqual([])
  })

  it('buckets by posted_at (America/New_York), summing views instead of counting', () => {
    const ideas = [
      makeIdea({ posted_at: '2026-01-05T12:00:00Z', views: 100 }),
      makeIdea({ posted_at: '2026-01-06T12:00:00Z', views: 50 }),
      makeIdea({ posted_at: '2026-01-19T12:00:00Z', views: 30 }),
    ]
    const result = sumViewsByWeek(ideas)
    expect(result).toEqual([
      { weekStart: '2026-01-05', views: 150 },
      { weekStart: '2026-01-12', views: 0 },
      { weekStart: '2026-01-19', views: 30 },
    ])
  })

  it('treats null views as 0 and ignores ideas with no posted_at', () => {
    const ideas = [
      makeIdea({ posted_at: '2026-01-05T12:00:00Z', views: null }),
      makeIdea({ posted_at: null, views: 9000 }),
    ]
    expect(sumViewsByWeek(ideas)).toEqual([{ weekStart: '2026-01-05', views: 0 }])
  })

  it('buckets by America/New_York, not UTC — a Mon 04:30 UTC posted_at is Sun 23:30 EST', () => {
    // Same boundary case as countByWeek's test above: 2026-01-05T04:30:00Z is UTC-Monday,
    // but EST (UTC-5, no DST in January) local time is 2026-01-04 23:30, a Sunday — the
    // week starting Mon Dec 29, not the week starting Jan 5. A naive UTC/local bucketing
    // would land this in the wrong week.
    const result = sumViewsByWeek([makeIdea({ posted_at: '2026-01-05T04:30:00Z', views: 42 })])
    expect(result).toEqual([{ weekStart: '2025-12-29', views: 42 }])
  })
})

describe('postedDaysSet', () => {
  it('returns NY-local YYYY-MM-DD keys for every idea with a posted_at', () => {
    const ideas = [
      makeIdea({ posted_at: '2026-01-05T12:00:00Z' }), // noon UTC = 7am EST, still Jan 5 in NY
      makeIdea({ posted_at: '2026-01-06T04:30:00Z' }), // 4:30am UTC = Jan 5 11:30pm EST, previous day
    ]
    const result = postedDaysSet(ideas)
    expect(result.has('2026-01-05')).toBe(true)
    expect(result.has('2026-01-06')).toBe(false)
    expect(result.size).toBe(1)
  })

  it('ignores ideas with no posted_at', () => {
    const result = postedDaysSet([makeIdea({ posted_at: null })])
    expect(result.size).toBe(0)
  })

  it('returns an empty set for an empty array', () => {
    expect(postedDaysSet([]).size).toBe(0)
  })
})

describe('metricoolTotals', () => {
  it('sums metricool_reach and averages metricool_engagement_rate across TRACKED ideas', () => {
    const ideas = [
      makeIdea({ status: 'TRACKED', metricool_reach: 100, metricool_engagement_rate: 2.5 }),
      makeIdea({ status: 'TRACKED', metricool_reach: 200, metricool_engagement_rate: 7.5 }),
      makeIdea({ status: 'IDEA', metricool_reach: 9000, metricool_engagement_rate: 99 }), // not TRACKED, ignored
    ]
    const result = metricoolTotals(ideas)
    expect(result.totalReach).toBe(300)
    expect(result.avgEngagementRate).toBe(5)
  })

  it('treats null metricool_reach as 0 but excludes null metricool_engagement_rate from the average', () => {
    const ideas = [
      makeIdea({ status: 'TRACKED', metricool_reach: null, metricool_engagement_rate: null }),
      makeIdea({ status: 'TRACKED', metricool_reach: 100, metricool_engagement_rate: 4 }),
    ]
    const result = metricoolTotals(ideas)
    expect(result.totalReach).toBe(100)
    expect(result.avgEngagementRate).toBe(4)
  })

  it('returns avgEngagementRate: null when no TRACKED idea has synced data yet', () => {
    const result = metricoolTotals([makeIdea({ status: 'TRACKED', metricool_engagement_rate: null })])
    expect(result.avgEngagementRate).toBeNull()
  })

  it('returns totalReach: 0 and avgEngagementRate: null for an empty array', () => {
    const result = metricoolTotals([])
    expect(result.totalReach).toBe(0)
    expect(result.avgEngagementRate).toBeNull()
  })
})

describe('countByPillarAndStage', () => {
  it('returns all 5 pillars each with all 6 stage keys, zero-filled where absent', () => {
    const ideas = [makeIdea({ pillar: 'training', status: 'IDEA' }), makeIdea({ pillar: 'training', status: 'DRAFT' })]
    const result = countByPillarAndStage(ideas)
    expect(result).toHaveLength(5)
    const training = result.find(r => r.pillar === 'training')!
    expect(training.IDEA).toBe(1)
    expect(training.DRAFT).toBe(1)
    expect(training.READY).toBe(0)
    expect(training.TRACKED).toBe(0)
    const diet = result.find(r => r.pillar === 'diet')!
    expect(diet.IDEA).toBe(0)
  })
})

describe('getTopPerformer', () => {
  it('returns the tracked idea with the highest views', () => {
    const ideas = [
      makeIdea({ id: 'a', status: 'TRACKED', views: 100 }),
      makeIdea({ id: 'b', status: 'TRACKED', views: 500 }),
      makeIdea({ id: 'c', status: 'TRACKED', views: 200 }),
    ]
    expect(getTopPerformer(ideas)?.id).toBe('b')
  })

  it('ignores non-tracked ideas even if their views field is set', () => {
    const ideas = [
      makeIdea({ id: 'a', status: 'DRAFT', views: 9000 }),
      makeIdea({ id: 'b', status: 'TRACKED', views: 50 }),
    ]
    expect(getTopPerformer(ideas)?.id).toBe('b')
  })

  it('treats null views as 0', () => {
    const ideas = [
      makeIdea({ id: 'a', status: 'TRACKED', views: null }),
      makeIdea({ id: 'b', status: 'TRACKED', views: 10 }),
    ]
    expect(getTopPerformer(ideas)?.id).toBe('b')
  })

  it('breaks a views tie by most-recently-created', () => {
    const ideas = [
      makeIdea({ id: 'a', status: 'TRACKED', views: 100, created_at: '2026-01-01T00:00:00Z' }),
      makeIdea({ id: 'b', status: 'TRACKED', views: 100, created_at: '2026-02-01T00:00:00Z' }),
    ]
    expect(getTopPerformer(ideas)?.id).toBe('b')
  })

  it('returns null when there are no tracked ideas', () => {
    const ideas = [makeIdea({ status: 'DRAFT' })]
    expect(getTopPerformer(ideas)).toBeNull()
  })
})

describe('getTopNByViews', () => {
  it('returns tracked ideas sorted by views descending, capped at n', () => {
    const ideas = [
      makeIdea({ id: 'a', status: 'TRACKED', views: 100 }),
      makeIdea({ id: 'b', status: 'TRACKED', views: 500 }),
      makeIdea({ id: 'c', status: 'TRACKED', views: 200 }),
      makeIdea({ id: 'd', status: 'TRACKED', views: 50 }),
    ]
    const result = getTopNByViews(ideas, 2)
    expect(result.map(i => i.id)).toEqual(['b', 'c'])
  })

  it('returns fewer than n items when fewer tracked ideas exist', () => {
    const ideas = [makeIdea({ id: 'a', status: 'TRACKED', views: 10 })]
    expect(getTopNByViews(ideas, 5)).toHaveLength(1)
  })

  it('returns an empty array for n = 0', () => {
    const ideas = [makeIdea({ status: 'TRACKED', views: 10 })]
    expect(getTopNByViews(ideas, 0)).toEqual([])
  })

  it('returns an empty array for negative n', () => {
    const ideas = [makeIdea({ status: 'TRACKED', views: 10 })]
    expect(getTopNByViews(ideas, -3)).toEqual([])
  })

  it('returns an empty array when there are no tracked ideas', () => {
    expect(getTopNByViews([makeIdea({ status: 'IDEA' })], 5)).toEqual([])
  })
})
