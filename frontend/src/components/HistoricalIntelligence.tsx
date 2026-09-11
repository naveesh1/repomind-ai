import React, { useState, useEffect } from 'react';
import type { HistoricalIntelligenceReport, HistoricalIntelligenceExportResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface HistoricalIntelligenceProps {
  repositoryUrl: string;
}

export const HistoricalIntelligence: React.FC<HistoricalIntelligenceProps> = ({ repositoryUrl }) => {
  const [data, setData] = useState<HistoricalIntelligenceReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchHistoricalIntelligence = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/historical-intelligence?repository_url=${encodeURIComponent(repositoryUrl)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned HTTP ${res.status}`);
      }
      const json: HistoricalIntelligenceReport = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch historical intelligence report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryUrl) {
      fetchHistoricalIntelligence();
    }
  }, [repositoryUrl]);

  const handleExport = async (format: 'json' | 'markdown' | 'html') => {
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/historical-intelligence/export`, {
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
      const result: HistoricalIntelligenceExportResponse = await res.json();

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
      a.download = result.filename || `historical_intelligence.${format}`;
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

  const getTrendColor = (trend: string) => {
    if (trend === 'IMPROVING' || trend === 'HEALTHY') return '#22c55e';
    if (trend === 'DETERIORATING' || trend === 'CRITICAL') return '#ef4444';
    return '#38bdf8';
  };

  return (
    <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#0f172a', borderRadius: '12px', color: '#f8fafc' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📈 Engineering Trend &amp; Historical Intelligence Dashboard</span>
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Step 35: Time-based repository risk trends, historical snapshot timelines, recurring risk hotspots, and release history.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading}
            onClick={fetchHistoricalIntelligence}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {loading ? 'Analyzing...' : '🔄 Refresh Trends'}
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

      {/* 1. Engineering Trend Header */}
      {data && (
        <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: '#1e293b', border: `2px solid ${getTrendColor(data.trends.overall_engineering_trend)}`, borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>Overall Engineering Health Trend</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: getTrendColor(data.trends.overall_engineering_trend), marginTop: '0.25rem' }}>
                {data.trends.overall_engineering_trend}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ background: '#0f172a', padding: '0.6rem 1rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Gov Score</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#38bdf8' }}>{data.governance_summary.current_score}</div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.6rem 1rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Risk Trend</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: getTrendColor(data.trends.risk_trend) }}>{data.trends.risk_trend}</div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.6rem 1rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Health Trend</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: getTrendColor(data.trends.health_trend) }}>{data.trends.health_trend}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid Layout for Trends & Summaries */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
          {/* 2. Risk Trend */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#f97316', fontSize: '0.95rem' }}>📉 Regression Risk Trend</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Current Risk Score:</span>
                <span style={{ fontWeight: 'bold' }}>{data.risk_summary.current_risk_score}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Previous Risk Score:</span>
                <span style={{ fontWeight: 'bold' }}>{data.risk_summary.previous_risk_score}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Risk Delta:</span>
                <span style={{ fontWeight: 'bold', color: data.risk_summary.risk_delta > 0 ? '#ef4444' : '#22c55e' }}>
                  {data.risk_summary.risk_delta > 0 ? `+${data.risk_summary.risk_delta}` : data.risk_summary.risk_delta}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Engineering Health Trend */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#38bdf8', fontSize: '0.95rem' }}>🏛️ Governance Score Trend</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Current Score:</span>
                <span style={{ fontWeight: 'bold' }}>{data.governance_summary.current_score}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Previous Score:</span>
                <span style={{ fontWeight: 'bold' }}>{data.governance_summary.previous_score}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Governance Delta:</span>
                <span style={{ fontWeight: 'bold', color: '#22c55e' }}>+{data.governance_summary.delta}</span>
              </div>
            </div>
          </div>

          {/* 4. Repository Quality Trend */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#22c55e', fontSize: '0.95rem' }}>🏥 Repository Quality Trend</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Repository Health:</span>
                <span style={{ fontWeight: 'bold' }}>{data.quality_summary.repository_health} / 100</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Code Quality:</span>
                <span style={{ fontWeight: 'bold' }}>{data.quality_summary.code_quality} / 100</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Maintainability:</span>
                <span style={{ fontWeight: 'bold', color: '#22c55e' }}>{data.quality_summary.maintainability}</span>
              </div>
            </div>
          </div>

          {/* 5. Testing Trend */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#a855f7', fontSize: '0.95rem' }}>🧪 Testing &amp; Coverage Trend</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Affected Tests Count:</span>
                <span style={{ fontWeight: 'bold' }}>{data.testing_summary.affected_tests_count}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Test Ratio:</span>
                <span style={{ fontWeight: 'bold' }}>{data.testing_summary.test_to_source_ratio.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Testing Trend:</span>
                <span style={{ fontWeight: 'bold', color: getTrendColor(data.trends.testing_trend) }}>{data.trends.testing_trend}</span>
              </div>
            </div>
          </div>

          {/* 6. Alert History */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#eab308', fontSize: '0.95rem' }}>🔔 Alert History Summary</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', fontSize: '0.8rem', textAlign: 'center' }}>
              <div style={{ background: '#0f172a', padding: '0.3rem', borderRadius: '4px' }}>
                <span style={{ color: '#ef4444' }}>CRITICAL: {data.alert_history.critical_count}</span>
              </div>
              <div style={{ background: '#0f172a', padding: '0.3rem', borderRadius: '4px' }}>
                <span style={{ color: '#f97316' }}>HIGH: {data.alert_history.high_count}</span>
              </div>
              <div style={{ background: '#0f172a', padding: '0.3rem', borderRadius: '4px' }}>
                <span style={{ color: '#eab308' }}>MEDIUM: {data.alert_history.medium_count}</span>
              </div>
              <div style={{ background: '#0f172a', padding: '0.3rem', borderRadius: '4px' }}>
                <span style={{ color: '#38bdf8' }}>LOW: {data.alert_history.low_count}</span>
              </div>
            </div>
          </div>

          {/* 7. Release History */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#06b6d4', fontSize: '0.95rem' }}>🚀 Release History Summary</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Latest Release Status:</span>
                <span style={{ fontWeight: 'bold', color: data.release_history.latest_release_status === 'APPROVED_FOR_RELEASE' ? '#22c55e' : '#ef4444' }}>
                  {data.release_history.latest_release_status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Evaluated Releases:</span>
                <span style={{ fontWeight: 'bold' }}>{data.release_history.total_evaluated_releases}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94a3b8' }}>Approved Releases:</span>
                <span style={{ fontWeight: 'bold', color: '#22c55e' }}>{data.release_history.approved_count}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. Recurring Risk Hotspots */}
      {data && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.75rem' }}>🔥 Recurring Risk Hotspots</h3>
          {data.risk_hotspots.length === 0 ? (
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '8px', color: '#22c55e', fontSize: '0.9rem' }}>
              ✅ No high-risk hotspots detected across historical repository snapshots.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                    <th style={{ padding: '0.75rem' }}>File / Module</th>
                    <th style={{ padding: '0.75rem' }}>Occurrences</th>
                    <th style={{ padding: '0.75rem' }}>Latest Risk</th>
                    <th style={{ padding: '0.75rem' }}>Trend</th>
                    <th style={{ padding: '0.75rem' }}>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.risk_hotspots.map((spot, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #0f172a' }}>
                      <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: '#38bdf8' }}>{spot.file_module}</td>
                      <td style={{ padding: '0.75rem' }}>{spot.occurrence_count}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold', color: spot.latest_risk_contribution >= 70 ? '#ef4444' : '#f97316' }}>
                        {spot.latest_risk_contribution}
                      </td>
                      <td style={{ padding: '0.75rem', color: getTrendColor(spot.trend) }}>{spot.trend}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', background: spot.severity === 'CRITICAL' ? '#7f1d1d' : '#431407', color: '#fca5a5', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {spot.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 9. Engineering Timeline */}
      {data && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.75rem' }}>⏳ Normalized Engineering Timeline</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.timeline.map((entry, idx) => (
              <div
                key={idx}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                }}
              >
                <div>
                  <span style={{ fontWeight: 'bold', color: '#38bdf8', fontFamily: 'monospace' }}>Rev: {entry.revision}</span>
                  <span style={{ marginLeft: '1rem', color: '#94a3b8' }}>Status: </span>
                  <span style={{ fontWeight: 'bold', color: entry.release_status === 'APPROVED_FOR_RELEASE' ? '#22c55e' : '#ef4444' }}>
                    {entry.release_status}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '1.25rem' }}>
                  <span>Risk Score: <strong style={{ color: '#f97316' }}>{entry.risk_score}</strong></span>
                  <span>Health: <strong>{entry.repository_health}</strong></span>
                  <span>Quality: <strong>{entry.code_quality}</strong></span>
                  <span>Gov Score: <strong style={{ color: '#38bdf8' }}>{entry.governance_score}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
