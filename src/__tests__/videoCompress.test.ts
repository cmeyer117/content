import { describe, it, expect } from 'vitest'
import { computeTargetBitrate } from '@/lib/videoCompress'

describe('computeTargetBitrate', () => {
  it('caps at 8Mbps for a short clip that would otherwise get a much higher bitrate', () => {
    expect(computeTargetBitrate(10)).toBe(8_000_000)
  })

  it('scales bitrate down for a long clip to fit the 48MB budget, reserving room for audio', () => {
    // (48MiB*8)/200s = 2_013_265.92 total, minus the 128kbps audio reservation.
    expect(computeTargetBitrate(200)).toBe(1_885_265)
  })

  it('lands exactly on the 8Mbps ceiling at the duration where the budget-based rate (after reserving audio) equals it', () => {
    const boundaryDuration = (48 * 1024 * 1024 * 8) / (8_000_000 + 128_000)
    expect(computeTargetBitrate(boundaryDuration)).toBe(8_000_000)
  })

  it('floors at 0 rather than going negative for a duration too long for the budget even with zero video', () => {
    // (48MiB*8)/4000s = 100_663.296, well under the 128kbps audio reservation.
    expect(computeTargetBitrate(4000)).toBe(0)
  })

  it('falls back to the ceiling instead of a zero bitrate when duration reads as Infinity', () => {
    expect(computeTargetBitrate(Infinity)).toBe(8_000_000)
  })

  it('falls back to the ceiling for a zero or negative duration', () => {
    expect(computeTargetBitrate(0)).toBe(8_000_000)
    expect(computeTargetBitrate(-5)).toBe(8_000_000)
  })
})
