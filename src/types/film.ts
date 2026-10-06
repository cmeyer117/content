export type FilmTake = { ref: string; note: string }
export type FilmShot = { id: string; label: string; filmed: boolean; takes: FilmTake[] }
export type FilmState = 'filming' | 'ready_to_edit'
export type FilmContent = { shots: FilmShot[]; state: FilmState }
export type FilmPacket = FilmContent & { id: string; content_idea_id: string; version: number }
// A local, unsynced edit: `baseVersion` is the server version the edit started from.
export type FilmDraft = FilmContent & { baseVersion: number }
