import { describe, it, expect } from 'vitest'
import { countByPillar, countByStage, countByWeek, countByPillarAndStage } from '@/lib/chartData'
import type { ContentIdea } from '@/types/content'

function makeIdea(overrides: Partial<ContentIdea>): ContentIdea {
  return {
    id: 'x', title: 't', body: null, pillar: 'training', platform: 'tiktok', status: 'IDEA',
    hook: null, notes: null, scheduled_at: null, posted_at: null, views: null, likes: null,
    shares: null, saves: null, post_url: null, idea_score: null, idea_score_notes: null,
    execution_score: null, execution_score_notes: null, created_at: '2026-01-01T12:00:00Z',
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
