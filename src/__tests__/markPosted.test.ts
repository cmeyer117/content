import { describe, it, expect } from 'vitest'
import { platformsToMark } from '@/lib/markPosted'

describe('platformsToMark', () => {
  it('returns just tiktok for a tiktok idea', () => {
    expect(platformsToMark('tiktok')).toEqual(['tiktok'])
  })

  it('returns just instagram for an instagram idea', () => {
    expect(platformsToMark('instagram')).toEqual(['instagram'])
  })

  it('returns both platforms for a both idea', () => {
    expect(platformsToMark('both')).toEqual(['tiktok', 'instagram'])
  })
})
