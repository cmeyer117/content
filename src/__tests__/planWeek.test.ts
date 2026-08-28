import { describe, it, expect } from 'vitest'
import { planWeek } from '@/lib/planWeek'
import type { ContentIdea } from '@/types/content'

function makeIdea(overrides: Partial<ContentIdea>): ContentIdea {
  return {
    id: 'x', title: 't', body: null, pillar: 'training', platform: 'tiktok', status: 'SCHEDULED',
    hook: null, content_class: null, hook_first_2s: null, viewer_payoff: null,
    target_length_seconds: null, length_justification: null, diary_justification: null,
    notes: null, scheduled_at: null, publish_at: null, posted_at: null, idea_score: null, idea_score_notes: null,
    execution_score: null, execution_score_notes: null, predicted_score: null,
    predicted_reasoning: null, predicted_at: null, prediction_version: null,
    source_intel_insight_id: null, experiment_id: null,
    series_source_performance_id: null, angle: null, position: null,
    created_at: '2026-01-01T12:00:00Z',
    ...overrides,
  }
}

// 2026-08-25T16:00:00.000Z is noon Eastern (EDT, UTC-4) on a Tuesday.
const NOW = new Date('2026-08-25T16:00:00.000Z')

describe('planWeek', () => {
  it('places each idea on the next open day, in order given', () => {
    const result = planWeek([], ['a', 'b', 'c'], NOW)
    expect(result.unplaced).toEqual([])
    expect(result.placed).toEqual([
      { id: 'a', day: '2026-08-25', publishInput: '2026-08-25T14:00' },
      { id: 'b', day: '2026-08-26', publishInput: '2026-08-26T14:00' },
      { id: 'c', day: '2026-08-27', publishInput: '2026-08-27T14:00' },
    ])
  })

  it('skips a day that already has a scheduled post today or upcoming', () => {
    const already = makeIdea({ id: 'existing', status: 'SCHEDULED', publish_at: '2026-08-26T16:00:00.000Z' })
    const result = planWeek([already], ['a', 'b'], NOW)
    expect(result.placed.map(p => p.day)).toEqual(['2026-08-25', '2026-08-27'])
  })

  it('never places on a day before today, even if it is in this week', () => {
    const result = planWeek([], ['a'], NOW)
    expect(result.placed[0].day >= '2026-08-25').toBe(true)
  })

  it('returns unplaced ids when there are more ideas than open days left this week', () => {
    // Tuesday NOW -- open days are Tue-Sun = 6 days.
    const result = planWeek([], ['a', 'b', 'c', 'd', 'e', 'f', 'g'], NOW)
    expect(result.placed).toHaveLength(6)
    expect(result.unplaced).toEqual(['g'])
  })

  it('handles an empty selection', () => {
    const result = planWeek([], [], NOW)
    expect(result.placed).toEqual([])
    expect(result.unplaced).toEqual([])
  })
})
