import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ScheduleIdeaModal from '@/components/ScheduleIdeaModal'
import type { ContentIdea } from '@/types/content'

const idea: ContentIdea = {
  id: 'idea-1', title: 'Ready to ship', body: null, pillar: 'training', platform: 'tiktok', status: 'READY',
  hook: null, content_class: null, hook_first_2s: null, viewer_payoff: null,
  target_length_seconds: null, length_justification: null, diary_justification: null,
  notes: null, scheduled_at: null, publish_at: null, posted_at: null, idea_score: null, idea_score_notes: null,
  execution_score: null, execution_score_notes: null, predicted_score: null,
  predicted_reasoning: null, predicted_at: null, prediction_version: null,
  source_intel_insight_id: null, experiment_id: null,
  series_source_performance_id: null, angle: null, position: null,
  created_at: '2026-07-13T00:00:00.000Z',
}

describe('ScheduleIdeaModal', () => {
  it('cannot submit with an empty datetime input', () => {
    const onSchedule = vi.fn()
    render(<ScheduleIdeaModal idea={idea} onClose={() => {}} onSchedule={onSchedule} />)
    fireEvent.click(screen.getByRole('button', { name: /schedule/i }))
    expect(onSchedule).not.toHaveBeenCalled()
    expect(screen.getByText(/enter a publish time/i)).toBeTruthy()
  })

  it('calls onSchedule with the idea id and the raw input value on submit', async () => {
    const onSchedule = vi.fn().mockResolvedValue(undefined)
    render(<ScheduleIdeaModal idea={idea} onClose={() => {}} onSchedule={onSchedule} />)
    fireEvent.change(screen.getByLabelText(/publish time/i), { target: { value: '2026-08-27T14:00' } })
    fireEvent.click(screen.getByRole('button', { name: /schedule/i }))
    expect(onSchedule).toHaveBeenCalledWith('idea-1', '2026-08-27T14:00')
  })

  it('keeps the modal open and shows an error when onSchedule rejects', async () => {
    const onClose = vi.fn()
    const onSchedule = vi.fn().mockRejectedValue(new Error('boom'))
    render(<ScheduleIdeaModal idea={idea} onClose={onClose} onSchedule={onSchedule} />)
    fireEvent.change(screen.getByLabelText(/publish time/i), { target: { value: '2026-08-27T14:00' } })
    fireEvent.click(screen.getByRole('button', { name: /schedule/i }))
    await vi.waitFor(() => expect(screen.getByText(/boom/i)).toBeTruthy())
    expect(onClose).not.toHaveBeenCalled()
  })
})
