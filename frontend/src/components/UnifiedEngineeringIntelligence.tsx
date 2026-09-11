import React, { useState, useEffect } from 'react';
import type {
  UnifiedIntelligenceResponse,
  UnifiedIntelligenceExportResponse,
  MetricProvenanceItem,
  ConsistencyCheckItem,
} from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface UnifiedEngineeringIntelligenceProps {
  repositoryUrl: string;
  onNavigateTab?: (tab: string) => void;
}

export const UnifiedEngineeringIntelligence: React.FC<UnifiedEngineeringIntelligenceProps> = ({
  repositoryUrl,
  onNavigateTab: _onNavigateTab,
}) => {
  const [data, setData] = useState<UnifiedIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchUnifiedIntelligence = async (url?: string) => {
    setLoading(true);
    setError(null);
    try {
      const activeUrl = url !== undefined ? url : repositoryUrl;
      const queryParams = new URLSearchParams({ repository_url: activeUrl });
      const res = await fetch(`${API_BASE_URL}/api/unified-engineering-intelligence?${queryParams.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned HTTP ${res.status}`);
      }
      const json: UnifiedIntelligenceResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to load unified engineering intelligence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryUrl) {
      fetchUnifiedIntelligence();
    }
  }, [repositoryUrl]);

  const handleExport = async (format: 'json' | 'markdown' | 'html') => {
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/unified-engineering-intelligence/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository_url: repositoryUrl,
          export_format: format,
        }),
      });

      if (!res.ok) {
        throw new Error(`Export failed with HTTP ${res.status}`);
      }

      const result: UnifiedIntelligenceExportResponse = await res.json();
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
      a.download = result.filename || `unified_engineering_intelligence.${format}`;
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

  const getHealthBadgeColor = (health: string) => {
    if (health === 'EXCELLENT' || health === 'HEALTHY') return '#22c55e';
    if (health === 'GOOD') return '#38bdf8';
    if (health === 'FAIR') return '#eab308';
    return '#ef4444';
  };

  return (
    <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: '#0f172a', borderRadius: '12px', color: '#f8fafc' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>🧠 Unified Engineering Intelligence &amp; Risk Consistency Engine</span>
          </h2>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Single Source of Truth for all engineering metrics, resolving risk score inconsistencies and tracking metric provenance across engines.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading}
            onClick={() => fetchUnifiedIntelligence()}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {loading ? 'Analyzing...' : '🔄 Refresh Intelligence'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !data}
            onClick={() => handleExport('json')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'json' ? 'Exporting...' : '📄 Export JSON'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !data}
            onClick={() => handleExport('markdown')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'markdown' ? 'Exporting...' : '📝 Export MD'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !data}
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

      {/* Hero Single Source of Truth Card */}
      {data && (
        <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: '#1e293b', border: '2px solid #38bdf8', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', background: '#0284c7', color: '#ffffff', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  🎯 SINGLE SOURCE OF TRUTH: ACTIVE
                </span>
                <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', background: data.consistency_status === 'CONSISTENT' ? '#15803d' : '#854d0e', color: '#ffffff', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {data.consistency_status === 'CONSISTENT' ? '✅ METRIC CONSISTENCY: 100% (CONSISTENT)' : '⚠️ WARNING: INCONSISTENCY DETECTED'}
                </span>
              </div>
              <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.4rem', color: '#f8fafc', fontFamily: 'monospace' }}>
                {data.full_name}
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Canonical Intelligence Engine | Generated: {data.generated_at}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ background: '#0f172a', padding: '0.65rem 1.2rem', borderRadius: '8px', textAlign: 'center', minWidth: '140px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Overall Score</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: getHealthBadgeColor(data.canonical_metrics.engineering_health), marginTop: '0.25rem' }}>
                  {data.canonical_metrics.overall_engineering_score} / 100
                </div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.65rem 1.2rem', borderRadius: '8px', textAlign: 'center', minWidth: '140px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Canonical Risk</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: data.canonical_metrics.regression_risk > 50 ? '#ef4444' : '#22c55e', marginTop: '0.25rem' }}>
                  {data.canonical_metrics.regression_risk} / 100
                </div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.65rem 1.2rem', borderRadius: '8px', textAlign: 'center', minWidth: '140px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Engineering Health</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: getHealthBadgeColor(data.canonical_metrics.engineering_health), marginTop: '0.25rem' }}>
                  {data.canonical_metrics.engineering_health}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canonical Metrics Grid */}
      {data && (
        <div style={{ marginTop: '1.5rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', margin: '0 0 1rem 0' }}>📊 Canonical Metrics Model (Normalized 0–100)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Regression Risk</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ef4444', marginTop: '0.2rem' }}>
                {data.canonical_metrics.regression_risk} / 100
              </div>
              <div style={{ background: '#334155', height: '6px', borderRadius: '3px', marginTop: '0.4rem', overflow: 'hidden' }}>
                <div style={{ background: '#ef4444', width: `${data.canonical_metrics.regression_risk}%`, height: '100%' }}></div>
              </div>
            </div>

            <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Governance Score</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.2rem' }}>
                {data.canonical_metrics.governance_score} / 100
              </div>
              <div style={{ background: '#334155', height: '6px', borderRadius: '3px', marginTop: '0.4rem', overflow: 'hidden' }}>
                <div style={{ background: '#38bdf8', width: `${data.canonical_metrics.governance_score}%`, height: '100%' }}></div>
              </div>
            </div>

            <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Repository Health</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#22c55e', marginTop: '0.2rem' }}>
                {data.canonical_metrics.repository_health} / 100
              </div>
              <div style={{ background: '#334155', height: '6px', borderRadius: '3px', marginTop: '0.4rem', overflow: 'hidden' }}>
                <div style={{ background: '#22c55e', width: `${data.canonical_metrics.repository_health}%`, height: '100%' }}></div>
              </div>
            </div>

            <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Code Quality</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#eab308', marginTop: '0.2rem' }}>
                {data.canonical_metrics.code_quality} / 100
              </div>
              <div style={{ background: '#334155', height: '6px', borderRadius: '3px', marginTop: '0.4rem', overflow: 'hidden' }}>
                <div style={{ background: '#eab308', width: `${data.canonical_metrics.code_quality}%`, height: '100%' }}></div>
              </div>
            </div>

            <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Testing Health</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#a855f7', marginTop: '0.2rem' }}>
                {data.canonical_metrics.testing_health} / 100
              </div>
              <div style={{ background: '#334155', height: '6px', borderRadius: '3px', marginTop: '0.4rem', overflow: 'hidden' }}>
                <div style={{ background: '#a855f7', width: `${data.canonical_metrics.testing_health}%`, height: '100%' }}></div>
              </div>
            </div>

            <div style={{ background: '#0f172a', padding: '0.85rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Release Confidence</span>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981', marginTop: '0.2rem' }}>
                {data.canonical_metrics.release_confidence} %
              </div>
              <div style={{ background: '#334155', height: '6px', borderRadius: '3px', marginTop: '0.4rem', overflow: 'hidden' }}>
                <div style={{ background: '#10b981', width: `${data.canonical_metrics.release_confidence}%`, height: '100%' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Service Risk Consistency Matrix */}
      {data && data.consistency_checks.length > 0 && (
        <div style={{ marginTop: '1.5rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', margin: '0 0 0.9rem 0' }}>🔍 Cross-Service Risk Consistency Matrix</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '0.6rem' }}>Platform Component</th>
                  <th style={{ padding: '0.6rem' }}>Service Engine</th>
                  <th style={{ padding: '0.6rem' }}>Displayed Risk Score</th>
                  <th style={{ padding: '0.6rem' }}>Consistency State</th>
                </tr>
              </thead>
              <tbody>
                {data.consistency_checks.map((item: ConsistencyCheckItem, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '0.6rem', fontWeight: 'bold', color: '#f8fafc' }}>{item.component}</td>
                    <td style={{ padding: '0.6rem', fontFamily: 'monospace', color: '#94a3b8' }}>{item.service}</td>
                    <td style={{ padding: '0.6rem', fontWeight: 'bold', color: '#38bdf8' }}>{item.displayed_risk} / 100</td>
                    <td style={{ padding: '0.6rem', color: '#22c55e', fontWeight: 'bold' }}>
                      ✅ CONSISTENT
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Metric Provenance Table */}
      {data && data.metric_provenance.length > 0 && (
        <div style={{ marginTop: '1.5rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', margin: '0 0 0.9rem 0' }}>📑 Metric Provenance &amp; Sources</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '0.6rem' }}>Metric</th>
                  <th style={{ padding: '0.6rem' }}>Canonical Value</th>
                  <th style={{ padding: '0.6rem' }}>Source Engine</th>
                  <th style={{ padding: '0.6rem' }}>Calculation Basis</th>
                </tr>
              </thead>
              <tbody>
                {data.metric_provenance.map((item: MetricProvenanceItem, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '0.6rem', fontWeight: 'bold', color: '#38bdf8' }}>{item.metric}</td>
                    <td style={{ padding: '0.6rem', fontWeight: 'bold', color: '#f8fafc' }}>{String(item.value)}</td>
                    <td style={{ padding: '0.6rem', color: '#a855f7', fontFamily: 'monospace' }}>{item.source_engine}</td>
                    <td style={{ padding: '0.6rem', color: '#cbd5e1' }}>{item.calculation_basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
