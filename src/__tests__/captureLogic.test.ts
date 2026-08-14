import { describe, it, expect } from 'vitest'
import { captureObjectName, formatCaptureAge } from '@/lib/captureLogic'

describe('captureObjectName', () => {
  it('prefixes the filename with the given timestamp', () => {
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' })
    const name = captureObjectName(file, new Date('2026-08-14T12:00:00.000Z'))
    expect(name).toBe('1786708800000-clip.mp4')
  })

  it('sanitizes unsafe characters in the original filename', () => {
    const file = new File(['x'], 'leg day (final)!!.mov', { type: 'video/quicktime' })
    const name = captureObjectName(file, new Date('2026-08-14T12:00:00.000Z'))
    expect(name).toBe('1786708800000-leg_day__final___.mov')
  })
})

describe('formatCaptureAge', () => {
  it('formats a recent upload in minutes', () => {
    const uploadedAt = new Date('2026-08-14T12:00:00.000Z')
    const now = new Date('2026-08-14T12:05:00.000Z')
    expect(formatCaptureAge(uploadedAt, now)).toBe('5m ago')
  })

  it('formats an older upload in hours', () => {
    const uploadedAt = new Date('2026-08-14T12:00:00.000Z')
    const now = new Date('2026-08-14T15:30:00.000Z')
    expect(formatCaptureAge(uploadedAt, now)).toBe('3h ago')
  })

  it('formats an upload under a minute old as just now', () => {
    const uploadedAt = new Date('2026-08-14T12:00:00.000Z')
    const now = new Date('2026-08-14T12:00:30.000Z')
    expect(formatCaptureAge(uploadedAt, now)).toBe('just now')
  })
})
