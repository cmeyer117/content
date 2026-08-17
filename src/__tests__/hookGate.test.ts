import { describe, it, expect } from 'vitest'
import { isReadyForDraft } from '@/lib/hookGate'
import type { ContentIdea } from '@/types/content'

const BASE: ContentIdea = {
  id: 'idea-1',
  title: 'Card title',
  body: null,
  pillar: 'training',
  platform: 'tiktok',
  status: 'IDEA',
  hook: null,
  content_class: 'technique',
  hook_first_2s: 'Open on the failed rep',
  viewer_payoff: 'The exact cue that fixes it',
  target_length_seconds: 22,
  length_justification: null,
  diary_justification: null,
  notes: null,
  scheduled_at: null,
  posted_at: null,
  views: null,
  likes: null,
  shares: null,
  saves: null,
  post_url: null,
  post_url_instagram: null,
  idea_score: null,
  idea_score_notes: null,
  execution_score: null,
  execution_score_notes: null,
  predicted_score: null,
  predicted_reasoning: null,
  predicted_at: null,
  prediction_version: null,
  metricool_reach: null,
  metricool_engagement_rate: null,
  metricool_comments: null,
  metricool_synced_at: null,
  created_at: '2026-07-13T00:00:00.000Z',
}

describe('isReadyForDraft', () => {
  it('is ready when all 4 base fields are present, length <=30, non-diary', () => {
    expect(isReadyForDraft(BASE)).toEqual({ ready: true, missing: [] })
  })

  it('is not ready when content_class is missing', () => {
    const idea = { ...BASE, content_class: null }
    expect(isReadyForDraft(idea).ready).toBe(false)
    expect(isReadyForDraft(idea).missing).toContain('content class')
  })

  it('is not ready when hook_first_2s is missing', () => {
    const idea = { ...BASE, hook_first_2s: null }
    expect(isReadyForDraft(idea).ready).toBe(false)
    expect(isReadyForDraft(idea).missing).toContain('opening hook')
  })

  it('is not ready when viewer_payoff is missing', () => {
    const idea = { ...BASE, viewer_payoff: null }
    expect(isReadyForDraft(idea).ready).toBe(false)
    expect(isReadyForDraft(idea).missing).toContain('viewer payoff')
  })

  it('is not ready when target_length_seconds is missing', () => {
    const idea = { ...BASE, target_length_seconds: null }
    expect(isReadyForDraft(idea).ready).toBe(false)
    expect(isReadyForDraft(idea).missing).toContain('target length')
  })

  it('is not ready for diary class without diary_justification', () => {
    const idea = { ...BASE, content_class: 'diary' as const, diary_justification: null }
    expect(isReadyForDraft(idea).ready).toBe(false)
    expect(isReadyForDraft(idea).missing).toContain('diary justification')
  })

  it('is ready for diary class with diary_justification', () => {
    const idea = { ...BASE, content_class: 'diary' as const, diary_justification: 'Real transformation story, earns the exception' }
    expect(isReadyForDraft(idea)).toEqual({ ready: true, missing: [] })
  })

  it('is ready at exactly 30 seconds with no justification', () => {
    const idea = { ...BASE, target_length_seconds: 30 }
    expect(isReadyForDraft(idea)).toEqual({ ready: true, missing: [] })
  })

  it('is not ready over 30 seconds without length_justification', () => {
    const idea = { ...BASE, target_length_seconds: 45, length_justification: null }
    expect(isReadyForDraft(idea).ready).toBe(false)
    expect(isReadyForDraft(idea).missing).toContain('length justification (over 30s)')
  })

  it('is ready over 30 seconds with length_justification', () => {
    const idea = { ...BASE, target_length_seconds: 45, length_justification: 'Pushup narrative earns the extra runtime' }
    expect(isReadyForDraft(idea)).toEqual({ ready: true, missing: [] })
  })
})
