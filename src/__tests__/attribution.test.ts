import { describe, it, expect } from 'vitest'
import { buildCoachingLink, countInquiriesByIdea, inquiriesChipLabel, COACHING_LANDING_URL } from '@/lib/attribution'

describe('buildCoachingLink', () => {
  it('builds the landing URL with platform, pillar and idea id', () => {
    const url = buildCoachingLink({ id: 'idea-1', platform: 'tiktok', pillar: 'training' })
    expect(url).toBe(`${COACHING_LANDING_URL}?utm_source=tiktok&utm_campaign=training&content_idea_id=idea-1`)
  })

  it('URL-encodes every value', () => {
    const url = buildCoachingLink({ id: 'a b&c=d', platform: 'tik tok', pillar: 'faith/life' })
    const parsed = new URL(url)
    expect(parsed.searchParams.get('content_idea_id')).toBe('a b&c=d')
    expect(parsed.searchParams.get('utm_source')).toBe('tik tok')
    expect(parsed.searchParams.get('utm_campaign')).toBe('faith/life')
    expect(url).not.toContain('a b&c=d')
  })

  it('falls back to "unknown" when platform or pillar are missing', () => {
    const parsed = new URL(buildCoachingLink({ id: 'idea-1', platform: null, pillar: '' }))
    expect(parsed.searchParams.get('utm_source')).toBe('unknown')
    expect(parsed.searchParams.get('utm_campaign')).toBe('unknown')
    expect(parsed.searchParams.get('content_idea_id')).toBe('idea-1')
  })
})

describe('countInquiriesByIdea', () => {
  it('groups rows by content_idea_id', () => {
    const counts = countInquiriesByIdea([
      { content_idea_id: 'a' },
      { content_idea_id: 'b' },
      { content_idea_id: 'a' },
    ])
    expect(counts).toEqual({ a: 2, b: 1 })
  })

  it('skips rows with a null or missing content_idea_id', () => {
    const counts = countInquiriesByIdea([
      { content_idea_id: null },
      {},
      null,
      { content_idea_id: 'a' },
    ])
    expect(counts).toEqual({ a: 1 })
  })

  it('returns an empty map for a non-array (failed/odd read)', () => {
    expect(countInquiriesByIdea(undefined)).toEqual({})
    expect(countInquiriesByIdea(null)).toEqual({})
    expect(countInquiriesByIdea({ error: 'nope' })).toEqual({})
  })
})

describe('inquiriesChipLabel', () => {
  it('shows the count when there are inquiries', () => {
    expect(inquiriesChipLabel(3)).toBe('Inquiries: 3')
  })

  it('shows "none yet" for zero', () => {
    expect(inquiriesChipLabel(0)).toBe('Inquiries: none yet')
  })

  it('fails soft to "none yet" when the count is unavailable', () => {
    expect(inquiriesChipLabel(null)).toBe('Inquiries: none yet')
    expect(inquiriesChipLabel(undefined)).toBe('Inquiries: none yet')
  })
})
