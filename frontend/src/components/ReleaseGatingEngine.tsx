import React, { useState, useEffect } from 'react';
import type { ReleaseGatingResponse, ReleaseCertificateExportResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface ReleaseGatingEngineProps {
  repositoryUrl: string;
}

export const ReleaseGatingEngine: React.FC<ReleaseGatingEngineProps> = ({ repositoryUrl }) => {
  const [data, setData] = useState<ReleaseGatingResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchReleaseGating = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/release-gating?repository_url=${encodeURIComponent(repositoryUrl)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned HTTP ${res.status}`);
      }
      const json: ReleaseGatingResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to evaluate release deployment readiness gate');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryUrl) {
      fetchReleaseGating();
    }
  }, [repositoryUrl]);

  const handleExportCertificate = async (format: 'json' | 'markdown' | 'html') => {
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/release-gating/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository_url: repositoryUrl,
          export_format: format,
        }),
      });
      if (!res.ok) {
        throw new Error(`Export failed with status ${res.status}`);
      }
      const result: ReleaseCertificateExportResponse = await res.json();

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
      a.download = result.filename || `release_certificate.${format}`;
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED_FOR_RELEASE':
        return '#22c55e';
      case 'CONDITIONAL_RELEASE':
        return '#eab308';
      case 'RELEASE_BLOCKED':
        return '#ef4444';
      default:
        return '#38bdf8';
    }
  };

  return (
    <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#0f172a', borderRadius: '12px', color: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🚦 Release Deployment Risk Gate Engine</span>
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Automated release risk gating, deployment readiness checklists, and certified release exports.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading}
            onClick={fetchReleaseGating}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {loading ? 'Evaluating...' : '🔄 Re-Evaluate Gate'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !data}
            onClick={() => handleExportCertificate('json')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'json' ? 'Exporting...' : '📄 Certificate JSON'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !data}
            onClick={() => handleExportCertificate('markdown')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'markdown' ? 'Exporting...' : '📝 Certificate MD'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !data}
            onClick={() => handleExportCertificate('html')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'html' ? 'Exporting...' : '🌐 Certificate HTML'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#450a0a', border: '1px solid #ef4444', borderRadius: '6px', color: '#fca5a5', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Main Release Gate Status Hero */}
      {data && (
        <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: '#1e293b', border: `2px solid ${getStatusColor(data.release_gate_status)}`, borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>Overall Release Readiness</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: getStatusColor(data.release_gate_status), marginTop: '0.25rem' }}>
                {data.release_gate_status.replace(/_/g, ' ')}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Checklist Progress:</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#f8fafc' }}>
                {data.passed_checks_count} / {data.total_checks_count} Checks Passed
              </div>
            </div>
          </div>
          <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.95rem', color: '#cbd5e1', borderTop: '1px solid #334155', paddingTop: '0.75rem' }}>
            {data.gate_summary}
          </p>
        </div>
      )}

      {/* Deployment Readiness Checklist Grid */}
      {data && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.75rem' }}>Automated Deployment Readiness Checklist</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.checklist.map((item) => (
              <div
                key={item.id}
                style={{
                  background: '#1e293b',
                  border: `1px solid ${item.passed ? '#334155' : '#ef4444'}`,
                  borderLeft: `5px solid ${item.passed ? '#22c55e' : '#ef4444'}`,
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc' }}>{item.title}</h4>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        background: item.severity === 'CRITICAL' ? '#7f1d1d' : '#1e3a8a',
                        color: '#93c5fd',
                      }}
                    >
                      {item.severity}
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>{item.description}</p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#cbd5e1' }}>{item.value}</span>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: item.passed ? '#22c55e' : '#ef4444', marginTop: '0.2rem' }}>
                    {item.passed ? '✅ PASS' : '❌ FAIL'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
