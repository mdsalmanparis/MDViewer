import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

// All tables live in the "md" schema
export const supabase = url && key
  ? createClient(url, key, { db: { schema: 'md' } })
  : null;

// ── Reading progress ──────────────────────────────────────────────────────────

export async function fetchProgress(repoId) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('reading_progress')
      .select('read_files, active_days, scroll_positions, heading_checks')
      .eq('repo_id', repoId)
      .maybeSingle();
    if (error) { console.warn('[MDview] Supabase fetch error:', error.message); return null; }
    return data;
  } catch { return null; }
}

export async function upsertProgress(repoId, { readFiles, activeDays, scrollPositions, headingChecks }) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('reading_progress')
      .upsert({
        repo_id:          repoId,
        read_files:       readFiles,
        active_days:      activeDays,
        scroll_positions: scrollPositions,
        heading_checks:   headingChecks || {},
      }, { onConflict: 'repo_id' });
    if (error) console.warn('[MDview] Supabase upsert error:', error.message);
  } catch {}
}

// Fetch all repos' progress — used by the analytics dashboard
export async function fetchAllProgress() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('reading_progress')
      .select('repo_id, read_files, active_days, heading_checks');
    if (error) return null;
    return data;
  } catch { return null; }
}

// ── File content cache (cross-device latest-version relay) ───────────────────

// Save a file's content after fetching from GitHub so blocked machines get
// the most recently loaded version, not a stale CI snapshot.
export async function saveFileToCache(repoId, filePath, content) {
  if (!supabase || !content || content.length > 400000) return; // skip huge files
  try {
    await supabase
      .from('file_cache')
      .upsert(
        { repo_id: repoId, file_path: filePath, content, fetched_at: new Date().toISOString() },
        { onConflict: 'repo_id,file_path' }
      );
  } catch {}
}

// Returns the cached content or null
export async function fetchFileFromCache(repoId, filePath) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('file_cache')
      .select('content')
      .eq('repo_id', repoId)
      .eq('file_path', filePath)
      .maybeSingle();
    if (error || !data) return null;
    return data.content;
  } catch { return null; }
}
