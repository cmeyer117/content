import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ContentIdea, NewContentIdea } from '@/types/content'

export function useIdeas() {
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('content_ideas')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setIdeas((data as ContentIdea[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const add = async (idea: NewContentIdea) => {
    const { data, error } = await supabase
      .from('content_ideas')
      .insert(idea)
      .select()
      .single()
    if (error) throw error
    setIdeas(prev => [data as ContentIdea, ...prev])
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

  return { ideas, loading, error, add, update, remove, refresh: load }
}
