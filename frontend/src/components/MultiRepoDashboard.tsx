import React, { useState, useEffect } from 'react';
import type {
  MultiRepoSummaryResponse,
  MonitoredRepoCardData,
  MultiRepoExportResponse,
} from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface MultiRepoDashboardProps {
  initialRepoUrl?: string;
}

export const MultiRepoDashboard: React.FC<MultiRepoDashboardProps> = ({ initialRepoUrl }) => {
  const [data, setData] = useState<MultiRepoSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchMultiRepoSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/multi-repo-monitor`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned HTTP ${res.status}`);
      }
      const json: MultiRepoSummaryResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch multi-repository dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMultiRepoSummary();
  }, [initialRepoUrl]);

  const handleExport = async (format: 'json' | 'markdown' | 'html') => {
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/multi-repo-monitor/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ export_format: format }),
      });
      if (!res.ok) {
        throw new Error(`Export failed with status ${res.status}`);
      }
      const result: MultiRepoExportResponse = await res.json();

      let blobContent: string;
      if (format === 'json') {
        blobContent = typeof result.content === 'object' ? JSON.stringify(result.content, null, 2) : String(result.content);
      } else {
        blobContent = String(result.content);
      }

      const blob = new Blob([blobContent], { type: result.content_type || 'text/plain' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = result.filename || `multi_repo_export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(`Export Error: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  const filteredRepos: MonitoredRepoCardData[] = (data?.repositories || []).filter((r) => {
    if (statusFilter === 'ALL') return true;
    return r.monitoring_status === statusFilter;
  });

  return (
    <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#0f172a', borderRadius: '12px', color: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📊 Multi-Repository Risk Dashboard</span>
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Step 32: Cross-repository monitoring, aggregate risk metrics, and multi-repo audit exports.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading}
            onClick={fetchMultiRepoSummary}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh All'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null}
            onClick={() => handleExport('json')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'json' ? 'Exporting...' : '📄 Export JSON'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null}
            onClick={() => handleExport('markdown')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'markdown' ? 'Exporting...' : '📝 Export MD'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null}
            onClick={() => handleExport('html')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'html' ? 'Exporting...' : '🌐 Export HTML'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#450a0a', border: '1px solid #ef4444', borderRadius: '6px', color: '#fca5a5', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Aggregate Overview Metrics */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
          <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>Monitored Repos</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f8fafc', marginTop: '0.2rem' }}>{data.total_monitored_repositories}</div>
          </div>
          <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>High-Risk Repos</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: data.high_risk_repositories_count > 0 ? '#ef4444' : '#22c55e', marginTop: '0.2rem' }}>
              {data.high_risk_repositories_count}
            </div>
          </div>
          <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>Total Blockers</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: data.total_new_blockers > 0 ? '#f97316' : '#38bdf8', marginTop: '0.2rem' }}>
              {data.total_new_blockers}
            </div>
          </div>
          <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
            <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>Active Alerts</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#eab308', marginTop: '0.2rem' }}>{data.total_alerts_count}</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
        {['ALL', 'CHANGES_DETECTED', 'NO_CHANGE'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              background: statusFilter === f ? '#0284c7' : '#1e293b',
              color: statusFilter === f ? '#ffffff' : '#94a3b8',
            }}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Repository Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        {filteredRepos.map((repo, idx) => (
          <div
            key={idx}
            style={{
              background: '#1e293b',
              border: `1px solid ${repo.risk_score >= 50 ? '#ef4444' : '#334155'}`,
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '1rem' }}>
                  {repo.repo_name} <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'normal' }}>({repo.owner})</span>
                </h4>
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    background: repo.monitoring_status === 'CHANGES_DETECTED' ? '#ca8a04' : '#0284c7',
                    color: '#fff',
                  }}
                >
                  {repo.monitoring_status}
                </span>
              </div>
              <p style={{ margin: '0.4rem 0', fontSize: '0.75rem', color: '#64748b', wordBreak: 'break-all' }}>{repo.repository_url}</p>
            </div>

            <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #334155', fontSize: '0.8rem', color: '#cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>Revisions:</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {String(repo.previous_revision).slice(0, 7)} &rarr; {String(repo.latest_revision).slice(0, 7)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>Risk Score:</span>
                <span style={{ fontWeight: 'bold', color: repo.risk_score >= 50 ? '#ef4444' : '#22c55e' }}>
                  {repo.risk_score} ({repo.risk_level})
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>Merge Decision:</span>
                <span style={{ fontWeight: 'bold', color: repo.decision === 'READY' ? '#22c55e' : '#f97316' }}>{repo.decision}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Active Alerts:</span>
                <span>{repo.alerts_count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
