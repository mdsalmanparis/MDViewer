import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchProgress, upsertProgress } from '../supabase';

const LS_PREFIX  = 'mdview-progress-';
const SYNC_DELAY = 2500;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function calcStreak(days) {
  if (!days || days.length === 0) return 0;
  const unique = [...new Set(days)].sort().reverse();
  const today     = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (unique[0] !== today && unique[0] !== yesterday) return 0;
  let streak = 0, expected = unique[0];
  for (const day of unique) {
    if (day === expected) {
      streak++;
      const d = new Date(expected + 'T12:00:00Z');
      d.setUTCDate(d.getUTCDate() - 1);
      expected = d.toISOString().slice(0, 10);
    } else break;
  }
  return streak;
}

function mergeData(local, remote) {
  const readFiles     = [...new Set([...(local.readFiles || []),     ...(remote.read_files     || [])])];
  const activeDays    = [...new Set([...(local.activeDays || []),    ...(remote.active_days    || [])])];
  const scrollPositions = { ...(remote.scroll_positions || {}), ...(local.scrollPositions || {}) };

  // Merge heading_checks: union each file's slug arrays
  const localHC  = local.headingChecks  || {};
  const remoteHC = remote.heading_checks || {};
  const headingChecks = {};
  for (const path of new Set([...Object.keys(localHC), ...Object.keys(remoteHC)])) {
    headingChecks[path] = [...new Set([...(localHC[path] || []), ...(remoteHC[path] || [])])];
  }

  return { readFiles, activeDays, scrollPositions, headingChecks };
}

const EMPTY = { readFiles: [], activeDays: [], scrollPositions: {}, headingChecks: {} };

function lsLoad(key) {
  if (!key) return EMPTY;
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(key)) }; } catch { return EMPTY; }
}
function lsSave(key, data) {
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

export function useProgress(owner, repo) {
  const repoId = owner && repo ? `${owner}__${repo}` : null;
  const lsKey  = repoId ? `${LS_PREFIX}${repoId}` : null;

  const [data, setData]     = useState(() => lsLoad(lsKey));
  const syncedRef           = useRef(false);
  const syncTimer           = useRef(null);
  const pendingSync         = useRef(null);

  // ── Load: localStorage instantly, merge Supabase in background ──
  useEffect(() => {
    syncedRef.current = false;
    const local = lsLoad(lsKey);
    setData(local);
    if (!repoId) { syncedRef.current = true; return; }

    fetchProgress(repoId).then(remote => {
      if (remote) {
        syncedRef.current = true;           // set BEFORE setData so persist effect sees it
        setData(prev => {
          const merged = mergeData(prev, remote);
          lsSave(lsKey, merged);
          return merged;
        });
      } else {
        syncedRef.current = true;
      }
    });
  }, [repoId, lsKey]);

  // ── Persist: localStorage sync, Supabase debounced ──
  useEffect(() => {
    if (!repoId) return;
    lsSave(lsKey, data);

    if (!syncedRef.current) return;         // don't overwrite Supabase before initial merge
    clearTimeout(syncTimer.current);
    pendingSync.current = data;
    syncTimer.current = setTimeout(() => {
      const d = pendingSync.current;
      if (d) upsertProgress(repoId, d);
    }, SYNC_DELAY);

    return () => clearTimeout(syncTimer.current);
  }, [data, repoId, lsKey]);

  // ── Mutators ──
  const markRead = useCallback((path) => {
    const today = todayStr();
    setData(prev => ({
      ...prev,
      readFiles:  (prev.readFiles  || []).includes(path)  ? prev.readFiles  : [...(prev.readFiles  || []), path],
      activeDays: (prev.activeDays || []).includes(today) ? prev.activeDays : [...(prev.activeDays || []), today],
    }));
  }, []);

  const recordActivity = useCallback(() => {
    const today = todayStr();
    setData(prev => {
      if ((prev.activeDays || []).includes(today)) return prev;
      return { ...prev, activeDays: [...(prev.activeDays || []), today] };
    });
  }, []);

  const saveScrollPos = useCallback((path, pct) => {
    setData(prev => ({
      ...prev,
      scrollPositions: { ...(prev.scrollPositions || {}), [path]: pct },
    }));
  }, []);

  const toggleHeading = useCallback((filePath, slug) => {
    setData(prev => {
      const hc      = prev.headingChecks || {};
      const current = hc[filePath] || [];
      const next    = current.includes(slug)
        ? current.filter(s => s !== slug)
        : [...current, slug];
      return { ...prev, headingChecks: { ...hc, [filePath]: next } };
    });
  }, []);

  // ── Derived ──
  const readFilesSet = useMemo(() => new Set(data.readFiles || []), [data.readFiles]);
  const streak       = useMemo(() => calcStreak(data.activeDays || []), [data.activeDays]);

  return {
    readFilesSet,
    streak,
    markRead,
    recordActivity,
    saveScrollPos,
    toggleHeading,
    scrollPositions: data.scrollPositions || {},
    headingChecks:   data.headingChecks   || {},
    totalRead:       (data.readFiles || []).length,
  };
}
