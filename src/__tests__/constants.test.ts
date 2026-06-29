import { describe, it, expect } from 'vitest'
import { PILLARS, PIPELINE_STAGES, PLATFORMS } from '@/lib/constants'

describe('constants', () => {
  it('has 6 pillars', () => {
    expect(PILLARS).toHaveLength(6)
  })

  it('has 6 pipeline stages in correct order', () => {
    expect(PIPELINE_STAGES).toEqual(['IDEA', 'DRAFT', 'READY', 'SCHEDULED', 'POSTED', 'TRACKED'])
  })

  it('has 3 platforms', () => {
    expect(PLATFORMS).toHaveLength(3)
  })
})
