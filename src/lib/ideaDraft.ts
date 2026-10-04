// Per-device recovery of unsaved edits in the idea modal (a convenience, never the source of truth).
// Every storage access is wrapped: private windows / blocked site data must not break the modal.
export type IdeaDraft = { title: string; hook: string; body: string; notes: string }

const key = (id: string) => `content:idea-draft:${id}`
const FIELDS: (keyof IdeaDraft)[] = ['title', 'hook', 'body', 'notes']

export function saveDraft(id: string, draft: IdeaDraft): void {
  try { localStorage.setItem(key(id), JSON.stringify(draft)) } catch { /* storage unavailable */ }
}

export function loadDraft(id: string): IdeaDraft | null {
  try {
    const raw = localStorage.getItem(key(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null
    if (!FIELDS.every(f => typeof parsed[f] === 'string')) return null
    return { title: parsed.title as string, hook: parsed.hook as string, body: parsed.body as string, notes: parsed.notes as string }
  } catch {
    return null
  }
}

export function clearDraft(id: string): void {
  try { localStorage.removeItem(key(id)) } catch { /* storage unavailable */ }
}

export function draftDiffersFrom(draft: IdeaDraft, idea: { title: string; hook: string | null; body: string | null; notes: string | null }): boolean {
  return draft.title !== idea.title || draft.hook !== (idea.hook ?? '') || draft.body !== (idea.body ?? '') || draft.notes !== (idea.notes ?? '')
}
