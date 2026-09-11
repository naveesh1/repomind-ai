import React, { useState, useEffect } from 'react';
import type {
  RepoMonitorResponse,
  AlertNotificationsResponse,
  NotificationPayloadRecord,
} from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface RepoAlertNotificationsProps {
  repositoryUrl: string;
  monitorData?: RepoMonitorResponse | null;
}

export const RepoAlertNotifications: React.FC<RepoAlertNotificationsProps> = ({
  repositoryUrl,
  monitorData,
}) => {
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [notificationsData, setNotificationsData] = useState<AlertNotificationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});

  const fetchNotifications = async (filter: string) => {
    if (!repositoryUrl) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/repository-monitor/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository_url: repositoryUrl,
          severity_filter: filter,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Failed to fetch alert notifications.');
      }

      const data: AlertNotificationsResponse = await res.json();
      setNotificationsData(data);
    } catch (err: any) {
      setError(err.message || 'Error loading notification payloads.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(severityFilter);
  }, [repositoryUrl, severityFilter, monitorData]);

  const handleExport = async (format: 'json' | 'markdown' | 'html') => {
    if (!repositoryUrl) return;
    setIsExporting(true);
    setExportStatus(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/repository-monitor/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository_url: repositoryUrl,
          export_format: format,
          format: format,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || `Failed to generate ${format.toUpperCase()} report.`);
      }

      const data = await res.json();
      let blob: Blob;
      let filename = data.filename || `monitoring_audit.${format}`;

      if (format === 'json') {
        const contentStr = typeof data.content === 'string' ? data.content : JSON.stringify(data.content, null, 2);
        blob = new Blob([contentStr], { type: 'application/json' });
      } else if (format === 'markdown') {
        blob = new Blob([data.content], { type: 'text/markdown' });
      } else {
        blob = new Blob([data.content], { type: 'text/html' });
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportStatus(`Successfully exported ${format.toUpperCase()} report as '${filename}'.`);
    } catch (err: any) {
      setError(err.message || `Export failed for ${format.toUpperCase()}.`);
    } finally {
      setIsExporting(false);
    }
  };

  const togglePayloadExpand = (id: string) => {
    setExpandedPayloads((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL':
        return 'severity-critical';
      case 'HIGH':
        return 'severity-high';
      case 'MEDIUM':
        return 'severity-medium';
      case 'LOW':
        return 'severity-low';
      default:
        return 'severity-info';
    }
  };

  const filterOptions = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

  return (
    <div className="exec-card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.2rem' }}>
        <div>
          <h3 className="exec-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            Alert Notifications &amp; Audit Report Export
          </h3>
          <span className="stats-subtext" style={{ fontSize: '0.85rem', marginTop: '0.2rem', display: 'block' }}>
            Generate structured alert notification payloads &amp; export monitoring audit reports.
          </span>
        </div>

        {/* Audit Export Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleExport('json')}
            disabled={isExporting || !repositoryUrl}
            className="exec-action-btn"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export JSON
          </button>

          <button
            onClick={() => handleExport('markdown')}
            disabled={isExporting || !repositoryUrl}
            className="exec-action-btn"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
            Export Markdown
          </button>

          <button
            onClick={() => handleExport('html')}
            disabled={isExporting || !repositoryUrl}
            className="exec-action-btn"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            Export HTML
          </button>
        </div>
      </div>

      {exportStatus && (
        <div className="warning-card-item" style={{ padding: '0.65rem 1rem', marginBottom: '1rem', background: 'rgba(52, 211, 153, 0.1)', borderColor: 'rgba(52, 211, 153, 0.4)', color: '#34d399', fontSize: '0.88rem' }}>
          <span>{exportStatus}</span>
        </div>
      )}

      {error && (
        <div className="warning-card-item" style={{ padding: '0.65rem 1rem', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171', fontSize: '0.88rem' }}>
          <span>{error}</span>
        </div>
      )}

      {/* Severity Filter Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="sum-label" style={{ fontSize: '0.85rem' }}>Filter by Severity:</span>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {filterOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setSeverityFilter(opt)}
                className={`tab-btn ${severityFilter === opt ? 'active' : ''}`}
                style={{
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.78rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  background: severityFilter === opt ? 'var(--accent-blue)' : 'var(--bg-card-hover)',
                  color: severityFilter === opt ? '#ffffff' : 'var(--text-muted)',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {notificationsData && (
          <span className="stats-subtext" style={{ fontSize: '0.82rem' }}>
            Showing {notificationsData.filtered_alerts_count} of {notificationsData.total_alerts_count} active notifications
          </span>
        )}
      </div>

      {/* Notification Payloads List */}
      {isLoading ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Generating alert notification payloads...
        </div>
      ) : notificationsData && notificationsData.notifications.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {notificationsData.notifications.map((notif: NotificationPayloadRecord) => {
            const isExpanded = !!expandedPayloads[notif.id];
            return (
              <div
                key={notif.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className={`alert-severity-badge ${getSeverityBadgeClass(notif.severity)}`}>
                      {notif.severity}
                    </span>
                    <span className="font-bold text-light" style={{ fontSize: '0.95rem' }}>
                      {notif.title}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      onClick={() => togglePayloadExpand(notif.id)}
                      style={{
                        background: 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--accent-cyan)',
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      {isExpanded ? 'Hide Payload' : 'View Payload Preview'}
                    </button>
                  </div>
                </div>

                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.45' }}>
                  {notif.explanation}
                </p>

                {/* Expanded Payload Preview */}
                {isExpanded && (
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px dashed var(--border-color)' }}>
                    <span className="sum-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Dispatch Notification Payload (JSON)</span>
                    <pre
                      style={{
                        background: '#0f172a',
                        color: '#38bdf8',
                        padding: '0.85rem 1rem',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.78rem',
                        overflowX: 'auto',
                        maxHeight: '260px',
                        margin: 0,
                      }}
                    >
                      {JSON.stringify(notif, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No notifications match severity filter '{severityFilter}'.
        </div>
      )}
    </div>
  );
};
