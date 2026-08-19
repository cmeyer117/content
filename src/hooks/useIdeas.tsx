import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { ContentIdea, NewContentIdea, ContentIdeaWithPerformance, PostPerformance, NewPostPerformance } from '@/types/content'

interface IdeasContextValue {
  ideas: ContentIdeaWithPerformance[]
  loading: boolean
  error: string | null
  add: (idea: NewContentIdea) => Promise<ContentIdea>
  update: (id: string, changes: Partial<ContentIdea>) => Promise<void>
  remove: (id: string) => Promise<void>
  savePerformance: (contentIdeaId: string, platform: PostPerformance['platform'], changes: Partial<NewPostPerformance>) => Promise<void>
  refresh: () => Promise<void>
}

const IdeasContext = createContext<IdeasContextValue | null>(null)

function joinPerformances(ideas: ContentIdea[], performances: PostPerformance[]): ContentIdeaWithPerformance[] {
  const byIdea = new Map<string, PostPerformance[]>()
  for (const p of performances) {
    const list = byIdea.get(p.content_idea_id) ?? []
    list.push(p)
    byIdea.set(p.content_idea_id, list)
  }
  return ideas.map(i => ({ ...i, performances: byIdea.get(i.id) ?? [] }))
}

export function IdeasProvider({ children }: { children: ReactNode }) {
  const [ideas, setIdeas] = useState<ContentIdeaWithPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [ideasRes, perfRes] = await Promise.all([
      supabase.from('content_ideas').select('*').order('created_at', { ascending: false }),
      supabase.from('content_post_performance').select('*'),
    ])
    if (ideasRes.error) setError(ideasRes.error.message)
    else if (perfRes.error) setError(perfRes.error.message)
    else setIdeas(joinPerformances((ideasRes.data as ContentIdea[]) ?? [], (perfRes.data as PostPerformance[]) ?? []))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('content_ideas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_ideas' }, () => {
        void load()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_post_performance' }, () => {
        void load()
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [load])

  const add = async (idea: NewContentIdea) => {
    const { data, error } = await supabase
      .from('content_ideas')
      .insert(idea)
      .select()
      .single()
    if (error) throw error
    setIdeas(prev => [{ ...(data as ContentIdea), performances: [] }, ...prev])
    return data as ContentIdea
  }

  const update = async (id: string, changes: Partial<ContentIdea>) => {
    const { error } = await supabase
      .from('content_ideas')
      .update(changes)
      .eq('id', id)
    if (error) throw error
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, ...changes } : i))
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('content_ideas').delete().eq('id', id)
    if (error) throw error
    setIdeas(prev => prev.filter(i => i.id !== id))
  }

  const savePerformance = async (contentIdeaId: string, platform: PostPerformance['platform'], changes: Partial<NewPostPerformance>) => {
    const { data, error } = await supabase
      .from('content_post_performance')
      .upsert({ content_idea_id: contentIdeaId, platform, ...changes }, { onConflict: 'content_idea_id,platform' })
      .select()
      .single()
    if (error) throw error
    const saved = data as PostPerformance
    setIdeas(prev => prev.map(i => i.id !== contentIdeaId ? i : {
      ...i,
      performances: [...i.performances.filter(p => p.platform !== platform), saved],
    }))
  }

  const value: IdeasContextValue = { ideas, loading, error, add, update, remove, savePerformance, refresh: load }
  return <IdeasContext.Provider value={value}>{children}</IdeasContext.Provider>
}

export function useIdeas(): IdeasContextValue {
  const ctx = useContext(IdeasContext)
  if (!ctx) throw new Error('useIdeas must be used within an IdeasProvider')
  return ctx
}
