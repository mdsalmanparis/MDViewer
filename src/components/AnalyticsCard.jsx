import { useState, useEffect, useMemo } from 'react';
import { fetchAllProgress } from '../supabase';

const LS_PROGRESS = 'mdview-progress-';
const LS_NOTEBOOKS = 'mdview-notebooks';

function todayStr() { return new Date().toISOString().slice(0, 10); }

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

function loadLocalStats() {
  // Aggregate all mdview-progress-* entries from localStorage
  const map = {};
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(LS_PROGRESS)) continue;
    try {
      const d = JSON.parse(localStorage.getItem(key)) || {};
      const repoId = key.slice(LS_PROGRESS.length);
      map[repoId] = {
        readFiles:    d.readFiles    || [],
        activeDays:   d.activeDays   || [],
        headingChecks: d.headingChecks || {},
      };
    } catch {}
  }
  return map;
}

function loadNotebooks() {
  try { return JSON.parse(localStorage.getItem(LS_NOTEBOOKS)) || []; } catch { return []; }
}

export default function AnalyticsCard({ onOpen }) {
  const [remoteData, setRemoteData] = useState(null);
  const [expanded,   setExpanded]   = useState(false);

  useEffect(() => {
    fetchAllProgress().then(rows => { if (rows) setRemoteData(rows); });
  }, []);

  const { stats, streak, totalRead, totalFiles } = useMemo(() => {
    const local     = loadLocalStats();
    const notebooks = loadNotebooks();

    // Merge remote rows into local map
    if (remoteData) {
      for (const row of remoteData) {
        const id  = row.repo_id;
        const loc = local[id] || { readFiles: [], activeDays: [], headingChecks: {} };
        local[id] = {
          readFiles:     [...new Set([...loc.readFiles,  ...(row.read_files  || [])])],
          activeDays:    [...new Set([...loc.activeDays, ...(row.active_days || [])])],
          headingChecks: { ...(row.heading_checks || {}), ...loc.headingChecks },
        };
      }
    }

    // Build per-repo stats using notebook file counts
    const nbMap = {};
    for (const n of notebooks) nbMap[`${n.owner}__${n.repo}`] = n;

    const stats = [];
    for (const [repoId, d] of Object.entries(local)) {
      const nb    = nbMap[repoId];
      const total = nb?.fileCount || 0;
      const read  = d.readFiles.length;

      // Count heading completions across all files
      let totalHeadings = 0, doneHeadings = 0;
      for (const slugs of Object.values(d.headingChecks)) {
        doneHeadings += slugs.length;
        totalHeadings += slugs.length; // we only know done; total is unknown without content
      }

      if (total > 0 || read > 0) {
        stats.push({ repoId, owner: nb?.owner || repoId.split('__')[0], repo: nb?.repo || repoId.split('__')[1], total, read, doneHeadings, nb });
      }
    }
    stats.sort((a, b) => b.read - a.read);

    // Global aggregates
    const allDays    = [...new Set(Object.values(local).flatMap(d => d.activeDays))];
    const streak     = calcStreak(allDays);
    const totalRead  = stats.reduce((s, r) => s + r.read,   0);
    const totalFiles = stats.reduce((s, r) => s + r.total,  0);

    return { stats, streak, totalRead, totalFiles };
  }, [remoteData]);

  if (!stats.length && streak === 0) return null;

  const visible = expanded ? stats : stats.slice(0, 3);

  return (
    <div className="analytics-card">
      <div className="analytics-header">
        <span className="analytics-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Learning Analytics
        </span>
        {stats.length > 3 && (
          <button className="analytics-expand" onClick={() => setExpanded(v => !v)}>
            {expanded ? 'Show less' : `+${stats.length - 3} more`}
          </button>
        )}
      </div>

      <div className="analytics-kpis">
        <div className="analytics-kpi">
          <span className="kpi-value">{streak > 0 ? `🔥 ${streak}` : '—'}</span>
          <span className="kpi-label">Day streak</span>
        </div>
        <div className="analytics-kpi">
          <span className="kpi-value">{totalRead}</span>
          <span className="kpi-label">Files read</span>
        </div>
        <div className="analytics-kpi">
          <span className="kpi-value">{stats.length}</span>
          <span className="kpi-label">Repos</span>
        </div>
      </div>

      {visible.length > 0 && (
        <div className="analytics-repos">
          {visible.map(r => {
            const pct = r.total > 0 ? Math.round((r.read / r.total) * 100) : 0;
            const done = r.read === r.total && r.total > 0;
            return (
              <div
                key={r.repoId}
                className={`analytics-repo-row ${r.nb ? 'clickable' : ''}`}
                onClick={() => r.nb && onOpen?.(r.nb)}
                title={r.nb ? `Open ${r.repoId}` : undefined}
              >
                <span className="analytics-repo-name">
                  <span className="repo-owner">{r.owner}/</span>{r.repo}
                  {done && <span className="repo-done-badge">✓</span>}
                </span>
                <div className="analytics-repo-bar-wrap">
                  <div className="analytics-repo-bar">
                    <div
                      className={`analytics-repo-bar-fill ${done ? 'done' : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="analytics-repo-count">
                    {r.total > 0 ? `${r.read}/${r.total}` : `${r.read} read`}
                  </span>
                </div>
                {r.doneHeadings > 0 && (
                  <span className="analytics-concepts">
                    {r.doneHeadings} concept{r.doneHeadings !== 1 ? 's' : ''} done
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
