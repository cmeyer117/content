import { describe, it, expect } from 'vitest'
import { buildPublishQueue, publishInputToIso, isoToPublishInput } from '@/lib/publishQueue'
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

// Fixed 'now' -- 2026-08-25T16:00:00.000Z is noon Eastern (EDT, UTC-4) on a Tuesday.
const NOW = new Date('2026-08-25T16:00:00.000Z')

describe('publishInputToIso / isoToPublishInput', () => {
  it('interprets a datetime-local value as Eastern wall-clock time and round-trips', () => {
    const iso = publishInputToIso('2026-08-25T14:00')
    expect(iso).not.toBeNull()
    expect(isoToPublishInput(iso)).toBe('2026-08-25T14:00')
  })

  it('rejects an empty or malformed local value', () => {
    expect(publishInputToIso('')).toBeNull()
    expect(publishInputToIso('not-a-date')).toBeNull()
    expect(publishInputToIso('2026-13-01T10:00')).toBeNull()
  })

  it('isoToPublishInput returns empty string for null or invalid input', () => {
    expect(isoToPublishInput(null)).toBe('')
    expect(isoToPublishInput('not-a-date')).toBe('')
  })
})

describe('buildPublishQueue', () => {
  it('buckets a past Eastern time as overdue', () => {
    const idea = makeIdea({ id: 'a', publish_at: '2026-08-25T10:00:00.000Z' })
    const queue = buildPublishQueue([idea], NOW)
    expect(queue.overdue.map(i => i.idea.id)).toEqual(['a'])
    expect(queue.today).toEqual([])
    expect(queue.upcoming).toEqual([])
    expect(queue.needsTime).toEqual([])
  })

  it('buckets a future time on the current Eastern calendar date as today', () => {
    const idea = makeIdea({ id: 'a', publish_at: '2026-08-25T22:00:00.000Z' })
    const queue = buildPublishQueue([idea], NOW)
    expect(queue.today.map(i => i.idea.id)).toEqual(['a'])
    expect(queue.overdue).toEqual([])
  })

  it('places a later current-week item in upcoming and its correct weekKeys slot', () => {
    const idea = makeIdea({ id: 'a', publish_at: '2026-08-27T22:00:00.000Z' })
    const queue = buildPublishQueue([idea], NOW)
    expect(queue.upcoming.map(i => i.idea.id)).toEqual(['a'])
    expect(queue.weekKeys).toContain('2026-08-27')
    expect(queue.weekKeys).toEqual(['2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'])
  })

  it('treats SCHEDULED with null publish_at as needsTime', () => {
    const idea = makeIdea({ id: 'a', publish_at: null })
    const queue = buildPublishQueue([idea], NOW)
    expect(queue.needsTime.map(i => i.idea.id)).toEqual(['a'])
  })

  it('excludes non-SCHEDULED rows entirely', () => {
    const idea = makeIdea({ id: 'a', status: 'DRAFT', publish_at: '2026-08-25T10:00:00.000Z' })
    const queue = buildPublishQueue([idea], NOW)
    expect(queue.overdue).toEqual([])
    expect(queue.today).toEqual([])
    expect(queue.upcoming).toEqual([])
    expect(queue.needsTime).toEqual([])
  })

  it('treats a malformed publish_at as needsTime, not a crash', () => {
    const idea = makeIdea({ id: 'a', publish_at: 'not-a-real-date' })
    const queue = buildPublishQueue([idea], NOW)
    expect(queue.needsTime.map(i => i.idea.id)).toEqual(['a'])
  })

  it('never places one item in two buckets', () => {
    const ideas = [
      makeIdea({ id: 'overdue', publish_at: '2026-08-25T10:00:00.000Z' }),
      makeIdea({ id: 'today', publish_at: '2026-08-25T22:00:00.000Z' }),
      makeIdea({ id: 'upcoming', publish_at: '2026-08-27T22:00:00.000Z' }),
      makeIdea({ id: 'needs', publish_at: null }),
    ]
    const queue = buildPublishQueue(ideas, NOW)
    const all = [...queue.overdue, ...queue.today, ...queue.upcoming, ...queue.needsTime].map(i => i.idea.id)
    expect(new Set(all).size).toBe(all.length)
    expect(all).toHaveLength(4)
  })
})
