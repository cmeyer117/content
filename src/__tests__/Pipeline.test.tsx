import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import Pipeline from '@/pages/Pipeline'
import type { ContentIdea } from '@/types/content'

const idea = {
  id: 'abc', title: 'Deep linked idea', body: 'Caption', pillar: 'training', platform: 'tiktok', status: 'READY', hook: null,
  content_class: null, hook_first_2s: null, viewer_payoff: null, target_length_seconds: null, length_justification: null,
  diary_justification: null, notes: null, scheduled_at: null, publish_at: null, posted_at: null, idea_score: null,
  idea_score_notes: null, execution_score: null, execution_score_notes: null, predicted_score: null, predicted_reasoning: null,
  predicted_at: null, prediction_version: null, source_intel_insight_id: null, experiment_id: null,
  series_source_performance_id: null, angle: null, position: null, created_at: '2026-10-01T00:00:00Z', performances: [],
} as unknown as ContentIdea

const pipe = vi.hoisted(() => ({
  state: { loading: false, error: null as string | null, grouped: new Map<string, unknown[]>(), refresh: vi.fn() },
}))

vi.mock('@/hooks/usePipeline', () => ({
  usePipeline: () => ({
    grouped: pipe.state.grouped, loading: pipe.state.loading, error: pipe.state.error, refresh: pipe.state.refresh,
    moveStage: vi.fn(), scheduleIdea: vi.fn(), markPosted: vi.fn(), remove: vi.fn(),
  }),
}))
vi.mock('@/hooks/useIdeas', () => ({ useIdeas: () => ({ update: vi.fn() }) }))
vi.mock('@/hooks/useExperiments', () => ({ useExperiments: () => ({ active: null }) }))

function Probe() {
  const loc = useLocation()
  return <p data-testid="search">{loc.search}</p>
}
function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Pipeline />
      <Probe />
    </MemoryRouter>,
  )
}

describe('Pipeline posting-nudge deep link', () => {
  beforeEach(() => {
    pipe.state = { loading: false, error: null, grouped: new Map([['READY', [idea]]]), refresh: vi.fn() }
  })

  it('opens the named idea and clears the link once the board has loaded', () => {
    renderAt('/pipeline?idea=abc')
    expect(screen.getByText('Edit Idea')).toBeTruthy()
    expect(screen.getByTestId('search').textContent).toBe('')
  })

  it('an unknown idea id just clears the link and opens nothing', () => {
    renderAt('/pipeline?idea=missing')
    expect(screen.queryByText('Edit Idea')).toBeNull()
    expect(screen.getByTestId('search').textContent).toBe('')
  })

  // Codex review (2026-10-04): a failed load leaves the board empty. Consuming the link then would lose the idea for good.
  it('keeps the link while the load has failed, and opens the idea after a retry succeeds', () => {
    pipe.state = { loading: false, error: 'database unavailable', grouped: new Map(), refresh: vi.fn() }
    const view = renderAt('/pipeline?idea=abc')
    expect(screen.getByRole('alert').textContent).toMatch(/database unavailable/)
    expect(screen.queryByText('Edit Idea')).toBeNull()
    expect(screen.getByTestId('search').textContent).toBe('?idea=abc')

    pipe.state = { loading: false, error: null, grouped: new Map([['READY', [idea]]]), refresh: vi.fn() }
    view.rerender(
      <MemoryRouter initialEntries={['/pipeline?idea=abc']}>
        <Pipeline />
        <Probe />
      </MemoryRouter>,
    )
    expect(screen.getByText('Edit Idea')).toBeTruthy()
    expect(screen.getByTestId('search').textContent).toBe('')
  })

  it('the error banner has a Retry button that calls refresh', () => {
    pipe.state = { loading: false, error: 'database unavailable', grouped: new Map(), refresh: vi.fn() }
    renderAt('/pipeline')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(pipe.state.refresh).toHaveBeenCalledOnce()
  })
})
