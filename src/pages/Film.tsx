import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useIdeas } from '@/hooks/useIdeas'
import { listPackets } from '@/lib/filmStore'
import { filmProgress } from '@/lib/filmPacket'
import FilmCard from '@/components/FilmCard'
import PillarBadge from '@/components/PillarBadge'
import type { FilmPacket } from '@/types/film'

export default function Film() {
  const { ideas, loading, error } = useIdeas()
  const [params, setParams] = useSearchParams()
  const [packets, setPackets] = useState<Map<string, FilmPacket>>(new Map())
  const [packetsFailed, setPacketsFailed] = useState(false)
  const selectedId = params.get('idea')

  const loadPackets = useCallback(async () => {
    try {
      const list = await listPackets()
      setPackets(new Map(list.map(p => [p.content_idea_id, p])))
      setPacketsFailed(false)
    } catch {
      setPacketsFailed(true)
    }
  }, [])

  // Reload the list whenever we land on it (opening or leaving a card), so progress is current.
  useEffect(() => { if (!selectedId) void loadPackets() }, [loadPackets, selectedId])

  const ready = ideas.filter(i => i.status === 'READY')
  const selected = selectedId ? ready.find(i => i.id === selectedId) : undefined

  if (selected) return <FilmCard key={selected.id} idea={selected} onBack={() => setParams({})} />

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-3">
      <h1 className="text-lg font-semibold text-gray-900">Film</h1>
      {loading && <p className="text-sm text-gray-600">Loading…</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {packetsFailed && <p className="text-xs text-red-700">Progress unavailable right now.</p>}
      {!loading && !error && ready.length === 0 && (
        <p className="text-sm text-gray-600">No ideas are ready to film. Move an idea to READY in the pipeline first.</p>
      )}
      {ready.map(idea => (
        <button
          key={idea.id}
          type="button"
          onClick={() => setParams({ idea: idea.id })}
          className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0 flex items-center gap-2">
            <PillarBadge pillar={idea.pillar} />
            <span className="text-sm text-gray-900 truncate">{idea.title}</span>
          </span>
          <span className="text-xs text-gray-600 shrink-0">{packetsFailed ? '—' : filmProgress(packets.get(idea.id) ?? null)}</span>
        </button>
      ))}
    </div>
  )
}
