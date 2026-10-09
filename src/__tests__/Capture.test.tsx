import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Capture from '@/pages/Capture'

const listMock = vi.fn()
const uploadMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        list: (...args: unknown[]) => listMock(...args),
        upload: (...args: unknown[]) => uploadMock(...args),
      }),
    },
  },
}))

beforeEach(() => {
  listMock.mockReset()
  uploadMock.mockReset()
})

describe('Capture', () => {
  it('does not claim an empty queue when the storage listing is denied', async () => {
    listMock.mockResolvedValue({ data: null, error: { message: 'Permission denied' } })
    render(<Capture />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/permission denied/i)
    expect(screen.queryByText(/nothing waiting/i)).toBeNull()
  })

  it('recovers the upload control and retains the selected file when the SDK throws', async () => {
    listMock.mockResolvedValue({ data: [], error: null })
    uploadMock.mockRejectedValueOnce(new Error('Connection lost'))
    render(<Capture />)
    const file = new File(['x'], 'take.mp4', { type: 'video/mp4' })
    fireEvent.change(screen.getByLabelText(/upload a take/i), { target: { files: [file] } })
    expect(await screen.findByText(/upload not confirmed/i)).toBeTruthy()
    expect((screen.getByLabelText(/upload a take/i) as HTMLInputElement).disabled).toBe(false)
    uploadMock.mockResolvedValue({ error: null })
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(2))
    expect(uploadMock.mock.calls[1][1]).toBe(file)
  })

  it('lets a failed queue read recover without retrying an upload', async () => {
    listMock.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ data: [], error: null })
    render(<Capture />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/offline/i)
    fireEvent.click(screen.getByRole('button', { name: /check again/i }))
    expect(await screen.findByText(/nothing waiting/i)).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('shows an empty state when nothing is waiting', async () => {
    listMock.mockResolvedValue({ data: [], error: null })
    render(<Capture />)
    await waitFor(() => expect(listMock).toHaveBeenCalled())
    expect(screen.getByText(/nothing waiting/i)).toBeTruthy()
  })

  it('lists a pending capture with its age', async () => {
    listMock.mockResolvedValue({
      data: [{ name: '1755172800000-clip.mp4', created_at: '2026-08-14T12:00:00.000Z' }],
      error: null,
    })
    render(<Capture />)
    expect(await screen.findByText(/clip\.mp4/)).toBeTruthy()
  })

  it('uploads a selected file and shows it in the waiting list', async () => {
    listMock.mockResolvedValueOnce({ data: [], error: null })
    uploadMock.mockResolvedValue({ error: null })
    listMock.mockResolvedValueOnce({
      data: [{ name: '1755172800000-take.mp4', created_at: '2026-08-14T12:00:00.000Z' }],
      error: null,
    })
    render(<Capture />)
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))

    const file = new File(['x'], 'take.mp4', { type: 'video/mp4' })
    const input = screen.getByLabelText(/upload a take/i)
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(uploadMock).toHaveBeenCalled())
    expect(await screen.findByText(/take\.mp4/)).toBeTruthy()
  })

  it('shows a visible error and lets the user retry on upload failure', async () => {
    listMock.mockResolvedValue({ data: [], error: null })
    uploadMock.mockResolvedValue({ error: { message: 'Network error' } })
    render(<Capture />)
    await waitFor(() => expect(listMock).toHaveBeenCalled())

    const file = new File(['x'], 'take.mp4', { type: 'video/mp4' })
    const input = screen.getByLabelText(/upload a take/i)
    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/upload failed/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
  })
})
