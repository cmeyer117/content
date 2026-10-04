import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveDraft, loadDraft, clearDraft, draftDiffersFrom } from '@/lib/ideaDraft'

beforeEach(() => { localStorage.clear() })

describe('ideaDraft', () => {
  it('round-trips the text fields per idea', () => {
    saveDraft('a', { title: 'T', hook: 'H', body: 'B', notes: 'N' })
    saveDraft('b', { title: 'other', hook: '', body: '', notes: '' })
    expect(loadDraft('a')).toEqual({ title: 'T', hook: 'H', body: 'B', notes: 'N' })
    expect(loadDraft('b')?.title).toBe('other')
  })

  it('clearDraft removes only that idea', () => {
    saveDraft('a', { title: 'T', hook: '', body: '', notes: '' })
    saveDraft('b', { title: 'U', hook: '', body: '', notes: '' })
    clearDraft('a')
    expect(loadDraft('a')).toBeNull()
    expect(loadDraft('b')).not.toBeNull()
  })

  it('returns null for missing, corrupt, or wrongly-shaped data', () => {
    expect(loadDraft('none')).toBeNull()
    localStorage.setItem('content:idea-draft:x', '{not json')
    expect(loadDraft('x')).toBeNull()
    localStorage.setItem('content:idea-draft:y', JSON.stringify({ title: 5 }))
    expect(loadDraft('y')).toBeNull()
  })

  it('never throws when storage is unavailable', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => saveDraft('a', { title: 'T', hook: '', body: '', notes: '' })).not.toThrow()
    spy.mockRestore()
    const spy2 = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadDraft('a')).toBeNull()
    spy2.mockRestore()
  })

  it('draftDiffersFrom is true only when a draft field differs from the saved idea', () => {
    const idea = { title: 'T', hook: 'H', body: 'B', notes: null }
    expect(draftDiffersFrom({ title: 'T', hook: 'H', body: 'B', notes: '' }, idea)).toBe(false)
    expect(draftDiffersFrom({ title: 'T', hook: 'H', body: 'B edited', notes: '' }, idea)).toBe(true)
  })
})
