import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthGate from '@/components/AuthGate'

// Codex portfolio audit 2026-10-06, finding 6: the sign-in fields had only placeholders (no accessible name: a placeholder is not
// a label and disappears as soon as you type) and the failure message was a bare div that a screen reader never announced.

const signIn = vi.fn()
const signOut = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      // Supabase fires the listener immediately with the current session; here: signed out.
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        cb('INITIAL_SESSION', null)
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
      signInWithPassword: (...args: unknown[]) => signIn(...args),
      signOut: (...args: unknown[]) => signOut(...args),
    },
  },
}))

beforeEach(() => {
  signIn.mockReset()
  signOut.mockReset()
})

describe('AuthGate sign-in form', () => {
  it('both fields have an accessible name, not just a placeholder', () => {
    render(<AuthGate><div>app</div></AuthGate>)
    expect(screen.getByRole('textbox', { name: /^email$/i })).toBeTruthy()
    expect(screen.getByLabelText(/^password$/i).getAttribute('type')).toBe('password')
    expect(screen.getByRole('button', { name: /sign in/i })).toBeTruthy()
  })

  it('a failed sign-in is announced as an alert with the real message', async () => {
    signIn.mockResolvedValue({ data: { session: null }, error: { message: 'Invalid login credentials' } })
    const user = userEvent.setup()
    render(<AuthGate><div>app</div></AuthGate>)
    expect(screen.queryByRole('alert')).toBeNull()
    await user.type(screen.getByLabelText(/^email$/i), 'someone@example.test')
    await user.type(screen.getByLabelText(/^password$/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect((await screen.findByRole('alert')).textContent).toContain('Invalid login credentials')
  })

  it('a signed-in account that is not the owner is signed out and told so, as an alert', async () => {
    signIn.mockResolvedValue({ data: { session: { user: { email: 'not-the-owner@example.test' } } }, error: null })
    signOut.mockResolvedValue({})
    const user = userEvent.setup()
    render(<AuthGate><div>app</div></AuthGate>)
    await user.type(screen.getByLabelText(/^email$/i), 'not-the-owner@example.test')
    await user.type(screen.getByLabelText(/^password$/i), 'pw')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(signOut).toHaveBeenCalled())
    expect((await screen.findByRole('alert')).textContent).toContain('This account is not authorized.')
  })

  it('the form is reachable by keyboard in order: email, password, button', async () => {
    const user = userEvent.setup()
    render(<AuthGate><div>app</div></AuthGate>)
    await user.tab()
    expect(document.activeElement).toBe(screen.getByLabelText(/^email$/i))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByLabelText(/^password$/i))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /sign in/i }))
  })
})
