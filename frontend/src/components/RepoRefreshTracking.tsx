import React, { useEffect, useState } from 'react';
import type { AnalyzeApiResponse, RepoTrackingResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface RepoRefreshTrackingProps {
  repositoryUrl?: string;
  repoData?: AnalyzeApiResponse;
}

export const RepoRefreshTracking: React.FC<RepoRefreshTrackingProps> = ({
  repositoryUrl = '',
  repoData,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<RepoTrackingResponse | null>(null);

  const url = repositoryUrl || repoData?.repository_url || '';

  const fetchRepoTracking = async () => {
    if (!url) return;
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/repo-tracking?repository_url=${encodeURIComponent(url)}`
      );
      if (response.ok) {
        const data: RepoTrackingResponse = await response.json();
        setTrackingData(data);
      }
    } catch {
      // Ignore initial load fetch errors if repo not yet tracked
    }
  };

  const handleRefreshRepository = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!url) {
      setError('No repository URL provided. Please analyze a repository first.');
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/refresh-repository`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository_url: url,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData.detail || `Failed to refresh repository (HTTP ${response.status})`
        );
      }

      const data: RepoTrackingResponse = await response.json();
      setTrackingData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh repository.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRepoTracking();
  }, [url]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleString();
    } catch {
      return isoString;
    }
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case 'REFRESHED':
        return 'trend-improved';
      case 'UNCHANGED':
        return 'trend-unchanged';
      default:
        return 'trend-unchanged';
    }
  };

  return (
    <div className="repo-tracking-container">
      {/* Header Info & Action Card */}
      <div className="sim-control-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
              Repository Refresh &amp; Change Tracking (Step 29)
            </h3>
            <p className="stats-subtext" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Track git revisions across refreshes, detect added/modified/deleted files, and connect updates with test impact and risk decisions.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRefreshRepository}
            className="btn-primary btn-sim-submit"
            disabled={isRefreshing}
            style={{ padding: '0.65rem 1.35rem' }}
          >
            {isRefreshing ? (
              <>
                <span>Refreshing Repository...</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
                  <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                </svg>
              </>
            ) : (
              <>
                <span>Refresh Repository</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6M1 20v-6h6"></path>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="form-feedback feedback-error exec-error-card" style={{ marginTop: '1rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Repository Metadata Strip */}
        <div className="risk-factors-grid" style={{ marginTop: '1rem' }}>
          <div className="risk-factor-card">
            <span className="sum-label">Repository</span>
            <span className="rf-val" style={{ fontSize: '1.05rem', wordBreak: 'break-all' }}>
              {trackingData?.repository_name || repoData?.repository_name || 'repository'}
            </span>
            <span className="rf-desc">Owner: {trackingData?.owner || 'GitHub'}</span>
          </div>

          <div className="risk-factor-card">
            <span className="sum-label">Current Revision</span>
            <span className="rf-val mono" style={{ fontSize: '1.1rem', color: 'var(--accent-cyan)' }}>
              {trackingData?.current_analyzed_revision || 'v2.31.0'}
            </span>
            <span className="rf-desc">Branch: {trackingData?.branch || 'main'}</span>
          </div>

          <div className="risk-factor-card">
            <span className="sum-label">Previous Revision</span>
            <span className="rf-val mono" style={{ fontSize: '1.1rem', color: '#94a3b8' }}>
              {trackingData?.previous_analyzed_revision || 'v2.28.0'}
            </span>
            <span className="rf-desc">Last baseline commit</span>
          </div>

          <div className="risk-factor-card">
            <span className="sum-label">Analysis Timestamp</span>
            <span className="rf-val" style={{ fontSize: '0.95rem' }}>
              {formatDate(trackingData?.analysis_timestamp)}
            </span>
            <span className="rf-desc">
              Status:{' '}
              <span className={`trend-banner-tag ${getStatusBadgeClass(trackingData?.refresh_status)}`} style={{ padding: '0.15rem 0.6rem', fontSize: '0.75rem' }}>
                {trackingData?.refresh_status || 'INITIALIZED'}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Diffs & Detected Changes Breakdown Card */}
      {trackingData && (
        <div
          className="change-results-wrapper"
          style={{
            opacity: isRefreshing ? 0.65 : 1,
            transition: 'opacity 0.2s ease',
          }}
        >
          {/* Change Summary Banner */}
          <div className="quality-score-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span className="font-bold text-light" style={{ display: 'block', fontSize: '1.1rem', marginBottom: '0.35rem' }}>
                  Repository Refresh Diff Breakdown ({trackingData.previous_analyzed_revision} &rarr; {trackingData.current_analyzed_revision})
                </span>
                <p className="health-score-desc" style={{ fontSize: '0.92rem', margin: 0 }}>
                  {trackingData.has_changes
                    ? `Detected modifications across ${trackingData.diff_summary.total_files_changed} file(s) with +${trackingData.diff_summary.additions} line additions and -${trackingData.diff_summary.deletions} line removals.`
                    : `No code modifications detected between revision '${trackingData.previous_analyzed_revision}' and '${trackingData.current_analyzed_revision}'.`}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="score-badge" style={{ padding: '0.4rem 0.85rem' }}>
                  <span className="score-value" style={{ fontSize: '1.3rem' }}>{trackingData.diff_summary.total_files_changed}</span>
                  <span className="score-denom" style={{ fontSize: '0.75rem' }}>Files Changed</span>
                </span>
              </div>
            </div>
          </div>

          {/* Detailed File Categories Grid */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              Detected File Changes
            </h4>

            <div className="risk-factors-grid">
              <div className="risk-factor-card">
                <span className="sum-label" style={{ color: '#34d399' }}>Added Files ({trackingData.diff_summary.added_files.length})</span>
                {trackingData.diff_summary.added_files.length > 0 ? (
                  <div className="chips-list-row" style={{ marginTop: '0.5rem' }}>
                    {trackingData.diff_summary.added_files.map((file, i) => (
                      <span key={i} className="mono dep-path-chip" style={{ borderLeft: '3px solid #34d399' }}>{file}</span>
                    ))}
                  </div>
                ) : (
                  <span className="stats-subtext" style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>No new files added</span>
                )}
              </div>

              <div className="risk-factor-card">
                <span className="sum-label" style={{ color: '#38bdf8' }}>Modified Files ({trackingData.diff_summary.modified_files.length})</span>
                {trackingData.diff_summary.modified_files.length > 0 ? (
                  <div className="chips-list-row" style={{ marginTop: '0.5rem' }}>
                    {trackingData.diff_summary.modified_files.map((file, i) => (
                      <span key={i} className="mono dep-path-chip" style={{ borderLeft: '3px solid #38bdf8' }}>{file}</span>
                    ))}
                  </div>
                ) : (
                  <span className="stats-subtext" style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>No files modified</span>
                )}
              </div>

              <div className="risk-factor-card">
                <span className="sum-label" style={{ color: '#f87171' }}>Deleted Files ({trackingData.diff_summary.deleted_files.length})</span>
                {trackingData.diff_summary.deleted_files.length > 0 ? (
                  <div className="chips-list-row" style={{ marginTop: '0.5rem' }}>
                    {trackingData.diff_summary.deleted_files.map((file, i) => (
                      <span key={i} className="mono dep-path-chip" style={{ borderLeft: '3px solid #f87171' }}>{file}</span>
                    ))}
                  </div>
                ) : (
                  <span className="stats-subtext" style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>No files deleted</span>
                )}
              </div>

              <div className="risk-factor-card">
                <span className="sum-label" style={{ color: '#facc15' }}>Renamed Files ({trackingData.diff_summary.renamed_files.length})</span>
                {trackingData.diff_summary.renamed_files.length > 0 ? (
                  <div className="chips-list-row" style={{ marginTop: '0.5rem' }}>
                    {trackingData.diff_summary.renamed_files.map((file, i) => (
                      <span key={i} className="mono dep-path-chip" style={{ borderLeft: '3px solid #facc15' }}>
                        {typeof file === 'string' ? file : `${file.old_path} -> ${file.new_path}`}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="stats-subtext" style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>No files renamed</span>
                )}
              </div>
            </div>
          </div>

          {/* Connected Risk & Decision Summary */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 11 12 14 22 4"></polyline>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              Connected Change Decision &amp; Regression Risk Status
            </h4>

            <div className="risk-factors-grid">
              <div className="risk-factor-card">
                <span className="sum-label">Merge Readiness Decision</span>
                <span className="rf-val" style={{ color: trackingData.change_decision.merge_readiness === 'READY' ? '#34d399' : '#f87171' }}>
                  {trackingData.change_decision.decision}
                </span>
                <span className="rf-desc">{trackingData.change_decision.decision_explanation}</span>
              </div>

              <div className="risk-factor-card">
                <span className="sum-label">Historical Risk Trend</span>
                <span className="rf-val" style={{ color: trackingData.historical_risk.score_change <= 0 ? '#34d399' : '#fb923c' }}>
                  {trackingData.historical_risk.risk_trend} ({trackingData.historical_risk.score_change > 0 ? `+${trackingData.historical_risk.score_change}` : trackingData.historical_risk.score_change} pts)
                </span>
                <span className="rf-desc">{trackingData.historical_risk.explanation}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
