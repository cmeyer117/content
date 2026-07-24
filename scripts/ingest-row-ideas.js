// Reusable, idempotent ingestion of Row Exercise Bible insights into the
// content_ideas idea bank. Re-run safely after new manuals are added — only
// titles not already present get inserted. Run with --dry-run to preview.
import { readFileSync } from 'node:fs'
import { filterNewIdeas } from './ingest-row-ideas-logic.js'

const SUPABASE_URL = 'https://vikpcejlyxieguorwysf.supabase.co'
const SUPABASE_KEY = 'sb_publishable_EvWPtfW1FBW5Vf-H6w0yHw_PcXK4imv'

async function fetchExistingTitles() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/content_ideas?select=title`, {
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
  })
  if (!r.ok) throw new Error(`Failed to fetch existing titles: ${r.status} ${await r.text()}`)
  const rows = await r.json()
  return new Set(rows.map((row) => row.title))
}

async function insertIdea(idea) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/content_ideas`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ title: idea.title, body: idea.body, pillar: idea.pillar, status: 'IDEA' }),
  })
  if (!r.ok) throw new Error(`Failed to insert "${idea.title}": ${r.status} ${await r.text()}`)
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const dataPathArg = process.argv.find((a) => a.endsWith('.json'))
  const dataPath = dataPathArg ?? new URL('./data/row-exercise-ideas.json', import.meta.url)

  const ideas = JSON.parse(readFileSync(dataPath, 'utf-8'))
  const existingTitles = await fetchExistingTitles()
  const newIdeas = filterNewIdeas(ideas, existingTitles)

  console.log(`${ideas.length} candidate ideas, ${ideas.length - newIdeas.length} already present, ${newIdeas.length} new.`)
  for (const idea of newIdeas) {
    console.log(`  ${dryRun ? '[dry-run] would insert' : 'inserting'}: ${idea.title}`)
    if (!dryRun) await insertIdea(idea)
  }
  console.log(dryRun ? 'Dry run complete, nothing written.' : `Inserted ${newIdeas.length} ideas.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
