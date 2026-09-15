import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleIngestContentIdeasRequest } from './ingest-content-ideas.js';

describe('handleIngestContentIdeasRequest', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('rejects an empty body', async () => {
    const res = await handleIngestContentIdeasRequest([]);
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects an idea with no title', async () => {
    const res = await handleIngestContentIdeasRequest([{ title: '' }]);
    expect(res.status).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends a source_key per idea and reports skipped-as-duplicate from the returned row count', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [{ title: 'a' }], // Postgres returned 1 row -- the other was a source_key conflict, silently skipped
    });

    const res = await handleIngestContentIdeasRequest([{ title: 'a' }, { title: 'b' }]);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ candidates: 2, existing: 1, inserted: 1 });
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toContain('on_conflict=source_key');
    expect(opts.headers.Prefer).toContain('resolution=ignore-duplicates');
    const sentRows = JSON.parse(opts.body);
    expect(sentRows).toEqual([
      { title: 'a', source_key: 'ingest:a' },
      { title: 'b', source_key: 'ingest:b' },
    ]);
  });

  it('throws when Supabase rejects the insert', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });
    await expect(handleIngestContentIdeasRequest([{ title: 'a' }])).rejects.toThrow('Supabase insert failed');
  });
});
