// Per-device recovery of unsaved edits in the idea modal (a convenience, never the source of truth).
// Covers every free-text field in the modal. Every storage access is wrapped: private windows / blocked
// site data must not break the modal.
export type IdeaDraft = {
  title: string
  hook: string
  body: string
  notes: string
  hookFirst2s: string
  viewerPayoff: string
  lengthJustification: string
  diaryJustification: string
  ideaScoreNotes: string
  executionScoreNotes: string
}

type SavedIdeaText = {
  title: string
  hook: string | null
  body: string | null
  notes: string | null
  hook_first_2s: string | null
  viewer_payoff: string | null
  length_justification: string | null
  diary_justification: string | null
  idea_score_notes: string | null
  execution_score_notes: string | null
}

const key = (id: string) => `content:idea-draft:${id}`
const FIELDS: (keyof IdeaDraft)[] = [
  'title', 'hook', 'body', 'notes', 'hookFirst2s', 'viewerPayoff',
  'lengthJustification', 'diaryJustification', 'ideaScoreNotes', 'executionScoreNotes',
]

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
    return Object.fromEntries(FIELDS.map(f => [f, parsed[f] as string])) as IdeaDraft
  } catch {
    return null
  }
}

export function clearDraft(id: string): void {
  try { localStorage.removeItem(key(id)) } catch { /* storage unavailable */ }
}

export function draftDiffersFrom(draft: IdeaDraft, idea: SavedIdeaText): boolean {
  return draft.title !== idea.title
    || draft.hook !== (idea.hook ?? '')
    || draft.body !== (idea.body ?? '')
    || draft.notes !== (idea.notes ?? '')
    || draft.hookFirst2s !== (idea.hook_first_2s ?? '')
    || draft.viewerPayoff !== (idea.viewer_payoff ?? '')
    || draft.lengthJustification !== (idea.length_justification ?? '')
    || draft.diaryJustification !== (idea.diary_justification ?? '')
    || draft.ideaScoreNotes !== (idea.idea_score_notes ?? '')
    || draft.executionScoreNotes !== (idea.execution_score_notes ?? '')
}
