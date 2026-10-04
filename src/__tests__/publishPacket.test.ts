import { describe, it, expect } from 'vitest'
import { packetText, packetMissing, packetStatus } from '@/lib/publishPacket'
import { buildCoachingLink } from '@/lib/attribution'

const base = { id: 'idea-1', platform: 'tiktok', pillar: 'training', body: '  Hit your lifts.  ', status: 'READY', posted_at: null } as const

describe('packetText', () => {
  it('caption is the trimmed body', () => {
    expect(packetText(base, 'caption')).toBe('Hit your lifts.')
  })
  it('link is the attributed coaching link', () => {
    expect(packetText(base, 'link')).toBe(buildCoachingLink(base))
  })
  it('both is caption, blank line, link', () => {
    expect(packetText(base, 'both')).toBe(`Hit your lifts.\n\n${buildCoachingLink(base)}`)
  })
  it('both with no caption is just the link (no stray blank lines)', () => {
    expect(packetText({ ...base, body: null }, 'both')).toBe(buildCoachingLink(base))
    expect(packetText({ ...base, body: '   ' }, 'caption')).toBe('')
  })
})

describe('packetMissing', () => {
  it('lists what a post still needs before it can go out', () => {
    expect(packetMissing({ ...base, body: null })).toEqual(['caption'])
    expect(packetMissing({ ...base, body: '  ' })).toEqual(['caption'])
    expect(packetMissing(base)).toEqual([])
  })
})

describe('packetStatus', () => {
  it('an unposted READY post is "ready", with no inquiry claim', () => {
    expect(packetStatus(base)).toEqual({ stage: 'ready', publishedAt: null, inquiries: null })
  })
  it('SCHEDULED is still not published', () => {
    expect(packetStatus({ ...base, status: 'SCHEDULED' }).stage).toBe('ready')
  })
  it('a posted post is "published" with its date and an honest inquiry label', () => {
    const posted = { ...base, status: 'POSTED' as const, posted_at: '2026-10-03T18:00:00Z' }
    expect(packetStatus({ ...posted, inquiry_count: 2 })).toEqual({ stage: 'published', publishedAt: '2026-10-03T18:00:00Z', inquiries: 'Inquiries: 2' })
    expect(packetStatus({ ...posted, inquiry_count: 0 }).inquiries).toBe('Inquiries: none yet')
    expect(packetStatus({ ...posted, inquiry_count: null }).inquiries).toBe('Inquiries: unavailable')
    expect(packetStatus(posted).inquiries).toBe('Inquiries: unavailable')
  })
  it('TRACKED counts as published even if posted_at is missing', () => {
    expect(packetStatus({ ...base, status: 'TRACKED', inquiry_count: 1 }).stage).toBe('published')
  })
})
