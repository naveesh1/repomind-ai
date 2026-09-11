import React, { useEffect, useState } from 'react';
import type { AlertRecord, AnalyzeApiResponse, RepoMonitorResponse } from '../types';
import { RepoAlertNotifications } from './RepoAlertNotifications';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface RepoMonitoringProps {
  repositoryUrl?: string;
  repoData?: AnalyzeApiResponse;
}

export const RepoMonitoring: React.FC<RepoMonitoringProps> = ({
  repositoryUrl = '',
  repoData,
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monitorData, setMonitorData] = useState<RepoMonitorResponse | null>(null);
  const [expandedAlerts, setExpandedAlerts] = useState<Record<string, boolean>>({});

  const url = repositoryUrl || repoData?.repository_url || '';

  const fetchMonitoringData = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!url) {
      setError('No repository context available. Please analyze a repository first.');
      return;
    }

    setIsChecking(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/repository-monitor?repository_url=${encodeURIComponent(url)}`
      );
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to monitor repository (HTTP ${response.status})`);
      }
      const data: RepoMonitorResponse = await response.json();
      setMonitorData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch repository monitoring alerts.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleRefreshAndAnalyze = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!url) {
      setError('No repository context available. Please analyze a repository first.');
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/refresh-repository`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repository_url: url }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to refresh repository (HTTP ${response.status})`);
      }
      // Re-fetch monitoring state after refresh
      await fetchMonitoringData();
    } catch (err: any) {
      setError(err.message || 'Failed to refresh and analyze repository.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMonitoringData();
  }, [url]);

  const toggleAlertExpand = (alertId: string) => {
    setExpandedAlerts((prev) => ({ ...prev, [alertId]: !prev[alertId] }));
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'severity-critical';
      case 'HIGH':
        return 'severity-high';
      case 'MEDIUM':
        return 'severity-medium';
      case 'LOW':
        return 'severity-low';
      default:
        return 'severity-low';
    }
  };

  const getStatusTagClass = (status?: string) => {
    switch (status) {
      case 'CHANGES_DETECTED':
        return 'trend-increased';
      case 'NO_CHANGE':
        return 'trend-unchanged';
      case 'ANALYSIS_REQUIRED':
        return 'trend-sig-increased';
      default:
        return 'trend-unchanged';
    }
  };

  return (
    <div className="repo-monitoring-container">
      {/* Control Card & Actions */}
      <div className="sim-control-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
              Continuous Repository Monitoring &amp; Risk Alerts (Step 30)
            </h3>
            <p className="stats-subtext" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Detect revision updates, regression risk deltas, decision shifts, and new P0/P1 test impacts in real-time.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={fetchMonitoringData}
              className="btn-secondary"
              disabled={isChecking || isRefreshing}
              style={{ padding: '0.6rem 1.15rem' }}
            >
              {isChecking ? 'Checking...' : 'Check for Changes'}
            </button>

            <button
              type="button"
              onClick={handleRefreshAndAnalyze}
              className="btn-primary btn-sim-submit"
              disabled={isChecking || isRefreshing}
              style={{ padding: '0.6rem 1.15rem' }}
            >
              {isRefreshing ? (
                <>
                  <span>Refreshing...</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                  </svg>
                </>
              ) : (
                <span>Refresh &amp; Analyze</span>
              )}
            </button>
          </div>
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

        {/* Monitoring Dashboard Grid */}
        {monitorData && (
          <div className="risk-factors-grid" style={{ marginTop: '1.25rem' }}>
            <div className="risk-factor-card">
              <span className="sum-label">Repository</span>
              <span className="rf-val" style={{ fontSize: '1.05rem', wordBreak: 'break-all' }}>
                {monitorData.owner}/{monitorData.repository_name}
              </span>
              <span className="rf-desc">
                Status:{' '}
                <span className={`trend-banner-tag ${getStatusTagClass(monitorData.monitoring_status)}`} style={{ padding: '0.15rem 0.55rem', fontSize: '0.75rem' }}>
                  {monitorData.monitoring_status}
                </span>
              </span>
            </div>

            <div className="risk-factor-card">
              <span className="sum-label">Revisions</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.2rem' }}>
                <span className="mono" style={{ fontSize: '0.95rem', color: '#94a3b8' }} title={monitorData.previous_analyzed_revision}>
                  {monitorData.previous_analyzed_revision?.length > 12 ? monitorData.previous_analyzed_revision.substring(0, 7) : monitorData.previous_analyzed_revision}
                </span>
                <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
                <span className="mono" style={{ fontSize: '1.05rem', color: 'var(--accent-cyan)' }} title={monitorData.latest_available_revision}>
                  {monitorData.latest_available_revision?.length > 12 ? monitorData.latest_available_revision.substring(0, 7) : monitorData.latest_available_revision}
                </span>
              </div>
              <span className="rf-desc">Analyzed baseline vs latest commit</span>
            </div>

            <div className="risk-factor-card">
              <span className="sum-label">Risk Transition</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.2rem' }}>
                <span className="rf-val" style={{ fontSize: '1.1rem' }}>{monitorData.risk_summary.previous_score} &rarr; {monitorData.risk_summary.current_score}</span>
                <span className="rf-val" style={{ fontSize: '0.9rem', color: monitorData.risk_summary.score_delta > 0 ? '#fb923c' : '#34d399' }}>
                  ({monitorData.risk_summary.display_delta})
                </span>
              </div>
              <span className="rf-desc">Level: {monitorData.risk_summary.current_level}</span>
            </div>

            <div className="risk-factor-card">
              <span className="sum-label">Files Changed</span>
              <span className="rf-val">{monitorData.diff_metrics.changed_files_count}</span>
              <span className="rf-desc">+{monitorData.diff_metrics.additions} / -{monitorData.diff_metrics.deletions} lines</span>
            </div>

            <div className="risk-factor-card">
              <span className="sum-label">New P0 Tests</span>
              <span className="rf-val" style={{ color: monitorData.test_impact_summary.new_p0_tests_count > 0 ? '#f87171' : 'var(--text-light)' }}>
                {monitorData.test_impact_summary.new_p0_tests_count}
              </span>
              <span className="rf-desc">Critical test suite requirements</span>
            </div>

            <div className="risk-factor-card">
              <span className="sum-label">New Blockers</span>
              <span className="rf-val" style={{ color: monitorData.decision_summary.new_blockers_count > 0 ? '#f87171' : 'var(--text-light)' }}>
                {monitorData.decision_summary.new_blockers_count}
              </span>
              <span className="rf-desc">Merge decision: {monitorData.decision_summary.decision}</span>
            </div>
          </div>
        )}
      </div>

      {/* Prioritized Alerts List */}
      {monitorData && (
        <div className="exec-section" style={{ marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h4 className="exec-section-title" style={{ margin: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Prioritized Risk &amp; Impact Alerts ({monitorData.alerts.length})
            </h4>

            <span className="stats-subtext" style={{ fontSize: '0.85rem' }}>
              Sorted by severity: CRITICAL &rarr; HIGH &rarr; MEDIUM &rarr; LOW
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {monitorData.alerts.map((alert: AlertRecord) => {
              const isExpanded = !!expandedAlerts[alert.id];
              return (
                <div
                  key={alert.id}
                  className={`alert-card-item ${alert.severity.toLowerCase()}`}
                  style={{
                    padding: '1.15rem 1.35rem',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div
                    onClick={() => toggleAlertExpand(alert.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', flexWrap: 'wrap', gap: '0.75rem' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <span className={`alert-severity-badge ${getSeverityBadgeClass(alert.severity)}`}>
                        {alert.severity}
                      </span>
                      <span className="font-bold text-light" style={{ fontSize: '1rem' }}>
                        {alert.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <span className="stats-subtext" style={{ fontSize: '0.8rem' }}>{alert.related_info}</span>
                      <svg
                        className={`chevron-icon ${isExpanded ? 'rotated' : ''}`}
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>
                  </div>

                  <p style={{ margin: '0.65rem 0 0 0', fontSize: '0.92rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                    {alert.explanation}
                  </p>

                  {/* Expandable Details Box */}
                  {isExpanded && (
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <span className="sum-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Recommended Action</span>
                        <div className="warning-card-item" style={{ padding: '0.75rem 1rem', fontSize: '0.9rem' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 11 12 14 22 4"></polyline>
                          </svg>
                          <span>{alert.recommended_action}</span>
                        </div>
                      </div>

                      {alert.related_files.length > 0 && (
                        <div>
                          <span className="sum-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Related Code Modules</span>
                          <div className="chips-list-row">
                            {alert.related_files.map((file, i) => (
                              <span key={i} className="mono dep-path-chip">{file}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 31: Alert Notifications & Audit Export */}
      {url && (
        <RepoAlertNotifications repositoryUrl={url} monitorData={monitorData} />
      )}
    </div>
  );
};

