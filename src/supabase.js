import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

// Tables live in public schema: mdview_progress, mdview_file_cache
export const supabase = url && key ? createClient(url, key) : null;

// ── Reading progress ──────────────────────────────────────────────────────────

export async function fetchProgress(repoId) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('mdview_progress')
      .select('read_files, active_days, scroll_positions, heading_checks, all_paths')
      .eq('repo_id', repoId)
      .maybeSingle();
    if (error) { console.warn('[MDview] fetchProgress error:', error.message); return null; }
    return data;
  } catch (e) { console.warn('[MDview] fetchProgress threw:', e.message); return null; }
}

export async function upsertProgress(repoId, { readFiles, activeDays, scrollPositions, headingChecks }) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('mdview_progress')
      .upsert({
        repo_id:          repoId,
        read_files:       readFiles,
        active_days:      activeDays,
        scroll_positions: scrollPositions,
        heading_checks:   headingChecks || {},
      }, { onConflict: 'repo_id' });
    if (error) console.warn('[MDview] upsertProgress error:', error.message);
  } catch (e) { console.warn('[MDview] upsertProgress threw:', e.message); }
}

// Save the full repo file list so other devices can load the tree without GitHub
export async function saveRepoPaths(repoId, paths) {
  if (!supabase || !paths?.length) return;
  try {
    const { error } = await supabase
      .from('mdview_progress')
      .upsert({ repo_id: repoId, all_paths: paths }, { onConflict: 'repo_id' });
    if (error) console.warn('[MDview] saveRepoPaths error:', error.message);
  } catch (e) { console.warn('[MDview] saveRepoPaths threw:', e.message); }
}

// Retrieve the file list — returns array or null
export async function fetchRepoPaths(repoId) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('mdview_progress')
      .select('all_paths')
      .eq('repo_id', repoId)
      .maybeSingle();
    if (error || !data?.all_paths?.length) return null;
    return data.all_paths;
  } catch { return null; }
}

// Fetch all repos' progress — used by the analytics dashboard
export async function fetchAllProgress() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('mdview_progress')
      .select('repo_id, read_files, active_days, heading_checks');
    if (error) return null;
    return data;
  } catch { return null; }
}

// ── File content cache (cross-device latest-version relay) ───────────────────

export async function saveFileToCache(repoId, filePath, content) {
  if (!supabase || !content || content.length > 400000) return;
  try {
    const { error } = await supabase
      .from('mdview_file_cache')
      .upsert(
        { repo_id: repoId, file_path: filePath, content, fetched_at: new Date().toISOString() },
        { onConflict: 'repo_id,file_path' }
      );
    if (error) console.warn('[MDview] saveFileToCache error:', error.message);
  } catch (e) { console.warn('[MDview] saveFileToCache threw:', e.message); }
}

export async function fetchFileFromCache(repoId, filePath) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('mdview_file_cache')
      .select('content')
      .eq('repo_id', repoId)
      .eq('file_path', filePath)
      .maybeSingle();
    if (error || !data) return null;
    return data.content;
  } catch { return null; }
}
