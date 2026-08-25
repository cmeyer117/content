import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IdeaCard from '@/components/IdeaCard'
import type { ContentIdea } from '@/types/content'

const idea: ContentIdea = {
  id: 'idea-1',
  title: 'Card title',
  body: null,
  pillar: 'training',
  platform: 'tiktok',
  status: 'IDEA',
  hook: null,
  content_class: null,
  hook_first_2s: null,
  viewer_payoff: null,
  target_length_seconds: null,
  length_justification: null,
  diary_justification: null,
  notes: null,
  scheduled_at: null,
  publish_at: null,
  posted_at: null,
  idea_score: null,
  idea_score_notes: null,
  execution_score: null,
  execution_score_notes: null,
  predicted_score: null,
  predicted_reasoning: null,
  predicted_at: null,
  prediction_version: null,
  source_intel_insight_id: null,
  experiment_id: null,
  series_source_performance_id: null,
  angle: null,
  position: null,
  created_at: '2026-07-13T00:00:00.000Z',
}

describe('IdeaCard', () => {
  it('calls onOpen when the card body is clicked', () => {
    const onOpen = vi.fn()
    render(
      <IdeaCard idea={idea} onMove={() => {}} onDelete={() => {}} onOpen={onOpen} />
    )
    fireEvent.click(screen.getByText('Card title'))
    expect(onOpen).toHaveBeenCalledWith(idea)
  })

  it('does not call onOpen when delete is clicked', () => {
    const onOpen = vi.fn()
    const onDelete = vi.fn()
    render(
      <IdeaCard idea={idea} onMove={() => {}} onDelete={onDelete} onOpen={onOpen} />
    )
    fireEvent.click(screen.getByText('✕'))
    expect(onDelete).toHaveBeenCalledWith('idea-1')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('shows an idea score badge when idea_score is set', () => {
    const scored = { ...idea, idea_score: 8 }
    render(<IdeaCard idea={scored} onMove={() => {}} onDelete={() => {}} onOpen={() => {}} />)
    expect(screen.getByText('🎯 8')).toBeTruthy()
  })

  it('shows an execution score badge when execution_score is set', () => {
    const scored = { ...idea, execution_score: 6 }
    render(<IdeaCard idea={scored} onMove={() => {}} onDelete={() => {}} onOpen={() => {}} />)
    expect(screen.getByText('🎬 6')).toBeTruthy()
  })

  it('shows no score badges when both scores are null', () => {
    render(<IdeaCard idea={idea} onMove={() => {}} onDelete={() => {}} onOpen={() => {}} />)
    expect(screen.queryByText(/🎯/)).toBeNull()
    expect(screen.queryByText(/🎬/)).toBeNull()
  })

  it('shows a predicted score badge when predicted_score is set', () => {
    const predicted = { ...idea, predicted_score: 8 }
    render(<IdeaCard idea={predicted} onMove={() => {}} onDelete={() => {}} onOpen={() => {}} />)
    expect(screen.getByText('🔮 8')).toBeTruthy()
  })

  it('shows no predicted score badge when predicted_score is null', () => {
    render(<IdeaCard idea={idea} onMove={() => {}} onDelete={() => {}} onOpen={() => {}} />)
    expect(screen.queryByText(/🔮/)).toBeNull()
  })

  // Fixed 2026-08-19: the gate previously applied to IDEA -> DRAFT, a
  // semantic mismatch against the stated intent of protecting the READY
  // decision point (found via a Codex code review). Now applies to
  // DRAFT -> READY instead.
  it('does not gate Move -> DRAFT regardless of hook-first fields', () => {
    render(<IdeaCard idea={idea} onMove={() => {}} onDelete={() => {}} onOpen={() => {}} />)
    const moveButton = screen.getByText('Move → DRAFT') as HTMLButtonElement
    expect(moveButton.disabled).toBe(false)
  })

  it('disables Move -> READY when the hook-first gate is not satisfied', () => {
    const draftIdea = { ...idea, status: 'DRAFT' as const }
    render(<IdeaCard idea={draftIdea} onMove={() => {}} onDelete={() => {}} onOpen={() => {}} />)
    const moveButton = screen.getByText('Move → READY') as HTMLButtonElement
    expect(moveButton.disabled).toBe(true)
  })

  it('enables Move -> READY when the hook-first gate is satisfied', () => {
    const ready = {
      ...idea,
      status: 'DRAFT' as const,
      content_class: 'technique' as const,
      hook_first_2s: 'Open on the failed rep',
      viewer_payoff: 'The exact cue that fixes it',
      target_length_seconds: 22,
    }
    render(<IdeaCard idea={ready} onMove={() => {}} onDelete={() => {}} onOpen={() => {}} />)
    const moveButton = screen.getByText('Move → READY') as HTMLButtonElement
    expect(moveButton.disabled).toBe(false)
  })

  it('does not gate moves to stages other than READY', () => {
    const readyIdea = { ...idea, status: 'READY' as const }
    render(<IdeaCard idea={readyIdea} onMove={() => {}} onDelete={() => {}} onOpen={() => {}} />)
    const moveButton = screen.getByText('Move → SCHEDULED') as HTMLButtonElement
    expect(moveButton.disabled).toBe(false)
  })
})
