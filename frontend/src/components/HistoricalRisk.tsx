import React, { useEffect, useState } from 'react';
import type { AnalyzeApiResponse, HistoricalRiskResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface HistoricalRiskProps {
  repositoryUrl?: string;
  repoData?: AnalyzeApiResponse;
}

export const HistoricalRisk: React.FC<HistoricalRiskProps> = ({
  repositoryUrl = '',
  repoData,
}) => {
  const [baseRevision, setBaseRevision] = useState('v2.28.0');
  const [targetRevision, setTargetRevision] = useState('v2.31.0');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<HistoricalRiskResponse | null>(null);

  const fetchHistoricalRisk = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const url = repositoryUrl || repoData?.repository_url;
    if (!url) {
      setError('No repository analysis data available. Please analyze a repository first.');
      return;
    }

    if (!baseRevision.trim()) {
      setError('Base Revision is required.');
      return;
    }

    if (!targetRevision.trim()) {
      setError('Target Revision is required.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/historical-risk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository_url: url,
          base_revision: baseRevision.trim(),
          target_revision: targetRevision.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to compare historical risk (HTTP ${response.status})`
        );
      }

      const data: HistoricalRiskResponse = await response.json();
      setCompareResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to compare historical risk.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoricalRisk();
  }, []);

  const getTrendBadgeClass = (trend: string) => {
    switch (trend) {
      case 'IMPROVED':
        return 'trend-improved';
      case 'UNCHANGED':
        return 'trend-unchanged';
      case 'INCREASED':
        return 'trend-increased';
      case 'SIGNIFICANTLY INCREASED':
        return 'trend-sig-increased';
      default:
        return 'trend-unchanged';
    }
  };

  return (
    <div className="historical-risk-container">
      {/* Input Form Card */}
      <div className="sim-control-card">
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
            Historical Risk &amp; Revision Comparison (Step 28)
          </h3>
          <p className="stats-subtext" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Compare regression risk score deltas, AST modifications, test suite impacts, and line diff metrics between two git revisions.
          </p>
        </div>

        <form onSubmit={fetchHistoricalRisk} className="sim-form">
          <div className="sim-form-grid">
            <div className="sim-form-group">
              <label className="sim-label">Base Revision (Older / Baseline)</label>
              <input
                type="text"
                className="sim-input mono"
                placeholder="e.g., v2.28.0 or main"
                value={baseRevision}
                onChange={(e) => setBaseRevision(e.target.value)}
              />
            </div>

            <div className="sim-form-group">
              <label className="sim-label">Target Revision (Newer / Release)</label>
              <input
                type="text"
                className="sim-input mono"
                placeholder="e.g., v2.31.0 or HEAD"
                value={targetRevision}
                onChange={(e) => setTargetRevision(e.target.value)}
              />
            </div>
          </div>

          <div className="sim-submit-row">
            <button
              type="button"
              onClick={fetchHistoricalRisk}
              className="btn-primary btn-sim-submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span>Comparing Revisions...</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                  </svg>
                </>
              ) : (
                <>
                  <span>Compare Historical Risk Profile</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"></path>
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="form-feedback feedback-error exec-error-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Comparison Results Card */}
      {compareResult && (
        <div
          className="change-results-wrapper"
          style={{
            opacity: isLoading ? 0.65 : 1,
            transition: 'opacity 0.2s ease',
            pointerEvents: isLoading ? 'none' : 'auto',
          }}
        >
          {/* Risk Trend Header Banner */}
          <div className="quality-score-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className={`trend-banner-tag ${getTrendBadgeClass(compareResult.risk_trend)}`}>
                    RISK TREND: {compareResult.risk_trend}
                  </span>
                  <span className="readiness-tag readiness-ok">
                    SCORE DELTA: {compareResult.score_change > 0 ? `+${compareResult.score_change}` : compareResult.score_change} pts
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div className="score-badge" style={{ padding: '0.4rem 0.85rem' }}>
                    <span className="score-value" style={{ fontSize: '1.4rem' }}>{compareResult.base_metrics.score}</span>
                    <span className="score-denom" style={{ fontSize: '0.75rem' }}>Base ({compareResult.base_revision})</span>
                  </div>
                  <div className="score-badge" style={{ padding: '0.4rem 0.85rem' }}>
                    <span className="score-value" style={{ fontSize: '1.4rem' }}>{compareResult.target_metrics.score}</span>
                    <span className="score-denom" style={{ fontSize: '0.75rem' }}>Target ({compareResult.target_revision})</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="font-bold text-light" style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                  Comparison Narrative ({compareResult.base_revision} &rarr; {compareResult.target_revision})
                </span>
                <p className="health-score-desc" style={{ fontSize: '0.92rem', lineHeight: '1.5', margin: 0 }}>
                  {compareResult.explanation}
                </p>
              </div>
            </div>
          </div>

          {/* Metric Comparison Side-by-Side Grid */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
              Before &amp; After Metric Comparison
            </h4>

            <div className="risk-factors-grid">
              <div className="risk-factor-card">
                <span className="sum-label">Risk Level</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <span className="rf-val" style={{ fontSize: '1.1rem', color: '#94a3b8' }}>{compareResult.base_metrics.level}</span>
                  <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
                  <span className="rf-val" style={{ fontSize: '1.25rem', color: 'var(--accent-cyan)' }}>{compareResult.target_metrics.level}</span>
                </div>
              </div>

              <div className="risk-factor-card">
                <span className="sum-label">Impact Radius</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <span className="rf-val" style={{ fontSize: '1.1rem', color: '#94a3b8' }}>{compareResult.base_metrics.impact_radius}</span>
                  <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
                  <span className="rf-val" style={{ fontSize: '1.25rem', color: 'var(--accent-cyan)' }}>{compareResult.target_metrics.impact_radius}</span>
                </div>
              </div>

              <div className="risk-factor-card">
                <span className="sum-label">Affected Test Suites</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <span className="rf-val" style={{ fontSize: '1.1rem', color: '#94a3b8' }}>{compareResult.base_metrics.total_affected_tests}</span>
                  <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
                  <span className="rf-val" style={{ fontSize: '1.25rem', color: 'var(--accent-cyan)' }}>{compareResult.target_metrics.total_affected_tests}</span>
                </div>
              </div>

              <div className="risk-factor-card">
                <span className="sum-label">Direct Unit Tests</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                  <span className="rf-val" style={{ fontSize: '1.1rem', color: '#94a3b8' }}>{compareResult.base_metrics.direct_tests}</span>
                  <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
                  <span className="rf-val" style={{ fontSize: '1.25rem', color: 'var(--accent-cyan)' }}>{compareResult.target_metrics.direct_tests}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Delta & Code Change Intensity */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              Code Change Metrics &amp; Intensity ({compareResult.delta_metrics.change_intensity})
            </h4>

            <div className="risk-factors-grid">
              <div className="risk-factor-card">
                <span className="sum-label">Files Modified</span>
                <span className="rf-val">{compareResult.delta_metrics.files_changed_count}</span>
                <span className="rf-desc">{compareResult.delta_metrics.modified_files_count} modified, {compareResult.delta_metrics.added_files_count} added, {compareResult.delta_metrics.deleted_files_count} deleted</span>
              </div>

              <div className="risk-factor-card">
                <span className="sum-label">Line Additions</span>
                <span className="rf-val" style={{ color: '#34d399' }}>+{compareResult.delta_metrics.additions}</span>
                <span className="rf-desc">New code added between revisions</span>
              </div>

              <div className="risk-factor-card">
                <span className="sum-label">Line Deletions</span>
                <span className="rf-val" style={{ color: '#f87171' }}>-{compareResult.delta_metrics.deletions}</span>
                <span className="rf-desc">Code removed or refactored</span>
              </div>

              <div className="risk-factor-card">
                <span className="sum-label">Total Line Delta</span>
                <span className="rf-val">{compareResult.delta_metrics.total_lines_changed}</span>
                <span className="rf-desc">Net churn across files</span>
              </div>
            </div>
          </div>

          {/* Affected Scope & Changed Files Breakdown */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              Changed Files Breakdown ({compareResult.ast_diff_summary.changed_files.length})
            </h4>

            <div className="affected-scope-box">
              <div className="chips-list-row">
                {compareResult.ast_diff_summary.changed_files.length > 0 ? (
                  compareResult.ast_diff_summary.changed_files.map((file, idx) => (
                    <span key={idx} className="mono dep-path-chip">{file}</span>
                  ))
                ) : (
                  <span className="stats-subtext">No changed files detected between {compareResult.base_revision} and {compareResult.target_revision}.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
