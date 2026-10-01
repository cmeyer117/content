import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { IdeasProvider, useIdeas } from '@/hooks/useIdeas'
import Ideas from '@/pages/Ideas'

const { read } = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {
  from: () => ({ select: () => {
    const result = read()
    return Object.assign(result, { order: () => result })
  } }),
  channel: () => ({ on() { return this }, subscribe() { return this } }),
  removeChannel: vi.fn(),
} }))
vi.mock('@/hooks/usePipeline', () => ({ usePipeline: () => ({ moveStage: vi.fn(), scheduleIdea: vi.fn() }) }))
vi.mock('@/hooks/useExperiments', () => ({ useExperiments: () => ({ active: null }) }))
vi.mock('@/components/NextPostBrief', () => ({ default: () => null }))

beforeEach(() => { cleanup(); read.mockReset() })
const wrapper = ({ children }: { children: React.ReactNode }) => <IdeasProvider>{children}</IdeasProvider>

describe('idea load recovery', () => {
  it('clears a returned read error after a successful retry', async () => {
    read.mockResolvedValue({ data: null, error: { message: 'Read unavailable' } })
    const { result } = renderHook(() => useIdeas(), { wrapper })
    await waitFor(() => expect(result.current.error).toBe('Read unavailable'))
    read.mockResolvedValue({ data: [], error: null })
    await act(async () => { await result.current.refresh() })
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('finishes loading and exposes a rejected read', async () => {
    read.mockRejectedValue(new Error('Network unavailable'))
    const { result } = renderHook(() => useIdeas(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Network unavailable')
  })

  it('shows retry instead of an empty account, then recovers', async () => {
    read.mockResolvedValue({ data: null, error: { message: 'Read unavailable' } })
    render(<Ideas />, { wrapper })
    await waitFor(() => expect(screen.queryByRole('alert')).toBeTruthy())
    expect(screen.queryByText('No ideas yet. Add one above.')).toBeNull()
    read.mockResolvedValue({ data: [], error: null })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.queryByText('No ideas yet. Add one above.')).toBeTruthy())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
