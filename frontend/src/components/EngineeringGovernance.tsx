import React, { useState, useEffect } from 'react';
import type { EngineeringGovernanceResponse, GovernanceReportExportResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface EngineeringGovernanceProps {
  repositoryUrl: string;
}

export const EngineeringGovernance: React.FC<EngineeringGovernanceProps> = ({ repositoryUrl }) => {
  const [data, setData] = useState<EngineeringGovernanceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchGovernanceReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/engineering-governance?repository_url=${encodeURIComponent(repositoryUrl)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned HTTP ${res.status}`);
      }
      const json: EngineeringGovernanceResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch engineering governance report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryUrl) {
      fetchGovernanceReport();
    }
  }, [repositoryUrl]);

  const handleExportReport = async (format: 'json' | 'markdown' | 'html') => {
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/engineering-governance/export`, {
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
      const result: GovernanceReportExportResponse = await res.json();

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
      a.download = result.filename || `engineering_governance.${format}`;
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

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'EXCELLENT':
        return '#22c55e';
      case 'GOOD':
        return '#38bdf8';
      case 'FAIR':
        return '#eab308';
      case 'POOR':
        return '#f97316';
      case 'CRITICAL':
        return '#ef4444';
      default:
        return '#cbd5e1';
    }
  };

  return (
    <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#0f172a', borderRadius: '12px', color: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🏛️ Engineering Governance & Repository Health Center</span>
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Step 34: Higher-level governance view consolidating health scores, risk trends, release confidence, and actionable recommendations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading}
            onClick={fetchGovernanceReport}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {loading ? 'Analyzing...' : '🔄 Refresh Governance'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !data}
            onClick={() => handleExportReport('json')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'json' ? 'Exporting...' : '📄 Export JSON'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !data}
            onClick={() => handleExportReport('markdown')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'markdown' ? 'Exporting...' : '📝 Export MD'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !data}
            onClick={() => handleExportReport('html')}
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

      {/* 1. Overall Governance Health Score Hero */}
      {data && (
        <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: '#1e293b', border: `2px solid ${getHealthColor(data.governance_score.overall_health)}`, borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>Overall Engineering Health Score</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: getHealthColor(data.governance_score.overall_health) }}>
                  {data.governance_score.overall_score}
                </span>
                <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>/ 100</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: getHealthColor(data.governance_score.overall_health), background: '#0f172a', padding: '0.25rem 0.75rem', borderRadius: '6px' }}>
                  {data.governance_score.overall_health}
                </span>
              </div>
            </div>

            {/* 5-Factor Score Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', minWidth: '320px' }}>
              {Object.entries(data.governance_score.factors).map(([factor, val]) => (
                <div key={factor} style={{ textAlign: 'center', background: '#0f172a', padding: '0.5rem', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>{factor.replace('_', ' ')}</div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#f8fafc', marginTop: '0.2rem' }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Grid Layout for Metrics & Indicators */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
          {/* 2. Repository Health */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#38bdf8', fontSize: '0.95rem' }}>🏥 Repository Health</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Health Score:</span>
                <span style={{ fontWeight: 'bold' }}>{data.health_metrics.repository_health_score} / 100</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Maintainability:</span>
                <span style={{ fontWeight: 'bold', color: '#22c55e' }}>{data.health_metrics.maintainability_classification}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Code Quality:</span>
                <span style={{ fontWeight: 'bold' }}>{data.health_metrics.code_quality_score} / 100</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Test-to-Source Ratio:</span>
                <span style={{ fontWeight: 'bold' }}>{data.health_metrics.test_to_source_ratio.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 3. Risk Overview */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#f97316', fontSize: '0.95rem' }}>📈 Risk Trend &amp; Delta</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Current Risk Score:</span>
                <span style={{ fontWeight: 'bold' }}>{data.risk_metrics.current_regression_risk}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Previous Risk Score:</span>
                <span style={{ fontWeight: 'bold' }}>{data.risk_metrics.previous_regression_risk}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Risk Delta:</span>
                <span style={{ fontWeight: 'bold', color: data.risk_metrics.risk_delta > 0 ? '#ef4444' : '#22c55e' }}>
                  {data.risk_metrics.risk_delta > 0 ? `+${data.risk_metrics.risk_delta}` : data.risk_metrics.risk_delta}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Risk Trend:</span>
                <span style={{ fontWeight: 'bold', color: data.indicators.risk_trend === 'DETERIORATING' ? '#ef4444' : '#22c55e' }}>
                  {data.indicators.risk_trend}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Monitoring Alerts */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#eab308', fontSize: '0.95rem' }}>🔔 Monitoring Alerts</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
              <div style={{ background: '#0f172a', padding: '0.4rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>CRITICAL</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{data.risk_metrics.critical_alerts_count}</div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.4rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#f97316', fontWeight: 600 }}>HIGH</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{data.risk_metrics.high_alerts_count}</div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.4rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#eab308', fontWeight: 600 }}>MEDIUM</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{data.risk_metrics.medium_alerts_count}</div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.4rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 600 }}>LOW</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{data.risk_metrics.low_alerts_count}</div>
              </div>
            </div>
          </div>

          {/* 5. Testing Health */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#22c55e', fontSize: '0.95rem' }}>🧪 Testing Health</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Test Health Status:</span>
                <span style={{ fontWeight: 'bold', color: '#22c55e' }}>{data.indicators.test_health}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Affected Tests Count:</span>
                <span style={{ fontWeight: 'bold' }}>{data.change_metrics.affected_test_count}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Changed Files:</span>
                <span style={{ fontWeight: 'bold' }}>{data.change_metrics.changed_files_count}</span>
              </div>
            </div>
          </div>

          {/* 6. Release Confidence */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#a855f7', fontSize: '0.95rem' }}>🚀 Release Readiness</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Release Gate:</span>
                <span style={{ fontWeight: 'bold', color: data.decision_metrics.release_gate_status === 'APPROVED_FOR_RELEASE' ? '#22c55e' : '#ef4444' }}>
                  {data.decision_metrics.release_gate_status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Merge Decision:</span>
                <span style={{ fontWeight: 'bold', color: data.decision_metrics.merge_decision === 'READY' ? '#22c55e' : '#f97316' }}>
                  {data.decision_metrics.merge_decision}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Active Blockers:</span>
                <span style={{ fontWeight: 'bold', color: data.decision_metrics.new_blockers_count > 0 ? '#ef4444' : '#22c55e' }}>
                  {data.decision_metrics.new_blockers_count}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Release Confidence:</span>
                <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{data.indicators.release_confidence}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Actionable Engineering Recommendations */}
      {data && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.75rem' }}>Prioritized Engineering Recommendations</h3>
          {data.recommendations.length === 0 ? (
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', color: '#22c55e', fontSize: '0.9rem' }}>
              ✅ No critical engineering recommendations. Repository health and risk metrics are within optimal bounds.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  style={{
                    background: '#1e293b',
                    border: `1px solid ${rec.priority === 'P0' ? '#ef4444' : '#334155'}`,
                    borderLeft: `5px solid ${rec.priority === 'P0' ? '#ef4444' : (rec.priority === 'P1' ? '#f97316' : '#eab308')}`,
                    borderRadius: '8px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          background: rec.priority === 'P0' ? '#7f1d1d' : '#431407',
                          color: rec.priority === 'P0' ? '#fca5a5' : '#fdba74',
                        }}
                      >
                        {rec.priority}
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>{rec.category}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>Metric: {rec.affected_metric}</span>
                  </div>
                  <p style={{ margin: '0.4rem 0', fontSize: '0.85rem', color: '#cbd5e1' }}>{rec.reason}</p>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#22c55e' }}>Recommended Action: {rec.recommended_action}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
