import { describe, it, expect } from 'vitest'
import { PILLARS, PIPELINE_STAGES, PLATFORMS, PIPELINE_STAGE_COLORS } from '@/lib/constants'

describe('constants', () => {
  it('has 5 pillars', () => {
    expect(PILLARS).toHaveLength(5)
  })

  it('has 6 pipeline stages in correct order', () => {
    expect(PIPELINE_STAGES).toEqual(['IDEA', 'DRAFT', 'READY', 'SCHEDULED', 'POSTED', 'TRACKED'])
  })

  it('has 3 platforms', () => {
    expect(PLATFORMS).toHaveLength(3)
  })
})

describe('PIPELINE_STAGE_COLORS', () => {
  it('has a color entry for every stage in PIPELINE_STAGES', () => {
    for (const stage of PIPELINE_STAGES) {
      expect(PIPELINE_STAGE_COLORS[stage]).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('gives every stage a distinct color', () => {
    const values = PIPELINE_STAGES.map(s => PIPELINE_STAGE_COLORS[s])
    expect(new Set(values).size).toBe(values.length)
  })
})
