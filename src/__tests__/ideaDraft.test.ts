import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveDraft, loadDraft, clearDraft, draftDiffersFrom } from '@/lib/ideaDraft'

beforeEach(() => { localStorage.clear() })

const full = (title: string, hook: string, body: string, notes: string) => ({
  title, hook, body, notes,
  hookFirst2s: '', viewerPayoff: '', lengthJustification: '', diaryJustification: '', ideaScoreNotes: '', executionScoreNotes: '',
})

describe('ideaDraft', () => {
  it('round-trips the text fields per idea', () => {
    saveDraft('a', full('T', 'H', 'B', 'N'))
    saveDraft('b', full('other', '', '', ''))
    expect(loadDraft('a')).toEqual(full('T', 'H', 'B', 'N'))
    expect(loadDraft('b')?.title).toBe('other')
  })

  it('recovers the hook-first brief and score-note text too, not just the four main fields', () => {
    const d = { ...full('T', 'H', 'B', 'N'), hookFirst2s: 'opening', viewerPayoff: 'payoff', lengthJustification: 'why', diaryJustification: 'diary', ideaScoreNotes: 'is', executionScoreNotes: 'es' }
    saveDraft('a', d)
    expect(loadDraft('a')).toEqual(d)
  })

  it('clearDraft removes only that idea', () => {
    saveDraft('a', full('T', '', '', ''))
    saveDraft('b', full('U', '', '', ''))
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
    expect(() => saveDraft('a', full('T', '', '', ''))).not.toThrow()
    spy.mockRestore()
    const spy2 = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadDraft('a')).toBeNull()
    spy2.mockRestore()
  })

  it('draftDiffersFrom is true only when a draft field differs from the saved idea', () => {
    const idea = { title: 'T', hook: 'H', body: 'B', notes: null, hook_first_2s: null, viewer_payoff: null, length_justification: null, diary_justification: null, idea_score_notes: null, execution_score_notes: null }
    expect(draftDiffersFrom(full('T', 'H', 'B', ''), idea)).toBe(false)
    expect(draftDiffersFrom(full('T', 'H', 'B edited', ''), idea)).toBe(true)
    expect(draftDiffersFrom({ ...full('T', 'H', 'B', ''), viewerPayoff: 'new' }, idea)).toBe(true)
  })
})
