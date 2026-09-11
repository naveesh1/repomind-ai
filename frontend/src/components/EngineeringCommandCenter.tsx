import React, { useState, useEffect } from 'react';
import type {
  EngineeringCommandCenterResponse,
  EngineeringCommandCenterExportResponse,
  EngineeringRiskItem,
  EngineeringRecommendationItem,
  EngineeringEventItem,
} from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface EngineeringCommandCenterProps {
  repositoryUrl: string;
  onInvestigate?: (target: string, targetType: string) => void;
  onCreateAction?: (target: string, category: string) => void;
}

export const EngineeringCommandCenter: React.FC<EngineeringCommandCenterProps> = ({
  repositoryUrl,
  onInvestigate,
  onCreateAction,
}) => {
  const [data, setData] = useState<EngineeringCommandCenterResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const fetchCommandCenterData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/engineering-command-center?repository_url=${encodeURIComponent(repositoryUrl)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned HTTP ${res.status}`);
      }
      const json: EngineeringCommandCenterResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to load Engineering Command Center intelligence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryUrl) {
      fetchCommandCenterData();
    }
  }, [repositoryUrl]);

  const handleExport = async (format: 'json' | 'markdown' | 'html') => {
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/engineering-command-center/export`, {
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

      const result: EngineeringCommandCenterExportResponse = await res.json();
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
      a.download = result.filename || `engineering_command_center.${format}`;
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

  const getHealthColor = (status: string) => {
    if (status === 'EXCELLENT' || status === 'HEALTHY' || status === 'APPROVED_FOR_RELEASE') return '#22c55e';
    if (status === 'GOOD' || status === 'ATTENTION_REQUIRED' || status === 'CONDITIONAL_RELEASE') return '#38bdf8';
    if (status === 'FAIR' || status === 'DEGRADED') return '#eab308';
    return '#ef4444';
  };

  const getPriorityBadgeStyle = (priority: string) => {
    if (priority === 'P0') return { bg: '#7f1d1d', text: '#fca5a5' };
    if (priority === 'P1') return { bg: '#431407', text: '#fdba74' };
    if (priority === 'P2') return { bg: '#365314', text: '#bef264' };
    return { bg: '#0f172a', text: '#94a3b8' };
  };

  const getMedalIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const triggerDrillDown = (target: string, type: string) => {
    if (onInvestigate) {
      onInvestigate(target, type);
    }
  };

  const triggerActionCreation = (target: string, category: string) => {
    if (onCreateAction) {
      onCreateAction(target, category);
    }
  };

  return (
    <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: '#0f172a', borderRadius: '12px', color: '#f8fafc' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>🚀 Engineering Command Center</span>
          </h2>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Top-level executive product dashboard aggregating health, governance, risk, release readiness, and benchmarking intelligence.
          </p>
        </div>

        {/* Action & Export Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading}
            onClick={fetchCommandCenterData}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh Dashboard'}
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
            {exporting === 'markdown' ? 'Exporting...' : '📝 Export Markdown'}
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

      {/* Top Hero Banner */}
      {data && (
        <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: '#1e293b', border: `2px solid ${getHealthColor(data.engineering_health)}`, borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>Overall Engineering Score</span>
              <div style={{ fontSize: '2.4rem', fontWeight: 'bold', color: getHealthColor(data.engineering_health), marginTop: '0.25rem' }}>
                {data.overall_engineering_score} <span style={{ fontSize: '1.2rem', color: '#94a3b8' }}>/ 100</span> — {data.engineering_health}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ background: '#0f172a', padding: '0.65rem 1.2rem', borderRadius: '8px', textAlign: 'center', minWidth: '120px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>System Status</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: getHealthColor(data.system_status), marginTop: '0.25rem' }}>
                  {data.system_status}
                </div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.65rem 1.2rem', borderRadius: '8px', textAlign: 'center', minWidth: '120px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Release Gate</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: getHealthColor(data.release_gate_status), marginTop: '0.25rem' }}>
                  {data.release_gate_status}
                </div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.65rem 1.2rem', borderRadius: '8px', textAlign: 'center', minWidth: '120px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Release Confidence</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.25rem' }}>
                  {data.release_confidence}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Executive Summary Narrative */}
      {data && (
        <div style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', background: '#0b1329', borderLeft: '4px solid #38bdf8', borderRadius: '8px', color: '#f1f5f9', fontSize: '0.95rem', lineHeight: '1.5' }}>
          <strong style={{ color: '#38bdf8' }}>📢 Executive Summary:</strong> {data.executive_summary}
        </div>
      )}

      {/* KPI Cards Grid */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>🏛️ Governance</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.25rem' }}>{data.governance_score}</div>
          </div>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>📉 Regression Risk</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: data.current_regression_risk > 50 ? '#ef4444' : '#22c55e', marginTop: '0.25rem' }}>
              {data.current_regression_risk}
            </div>
          </div>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>🏥 Repo Health</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e', marginTop: '0.25rem' }}>{data.repository_health}</div>
          </div>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>⭐ Code Quality</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e', marginTop: '0.25rem' }}>{data.code_quality}</div>
          </div>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>🧪 Testing Health</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#a855f7', marginTop: '0.25rem' }}>{data.testing_health}</div>
          </div>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>🛰️ Monitoring</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e', marginTop: '0.25rem' }}>{data.monitoring_status}</div>
          </div>
          <div
            onClick={() => triggerDrillDown(data.full_name, 'ALERT')}
            style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem', textAlign: 'center', cursor: 'pointer' }}
            title="Click to investigate active alerts"
          >
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>🔔 Active Alerts</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: data.active_alerts > 0 ? '#ef4444' : '#38bdf8', marginTop: '0.25rem' }}>
              {data.active_alerts}
            </div>
            <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>Investigate →</span>
          </div>
        </div>
      )}

      {/* Top Engineering Risks Table */}
      {data && (
        <div style={{ marginTop: '1.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.75rem' }}>⚠️ Top Engineering Risks</h3>
          <div style={{ overflowX: 'auto', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', background: '#0f172a' }}>
                  <th style={{ padding: '0.75rem' }}>Priority</th>
                  <th style={{ padding: '0.75rem' }}>Repository</th>
                  <th style={{ padding: '0.75rem' }}>Category</th>
                  <th style={{ padding: '0.75rem' }}>Metric</th>
                  <th style={{ padding: '0.75rem' }}>Score</th>
                  <th style={{ padding: '0.75rem' }}>Explanation</th>
                  <th style={{ padding: '0.75rem' }}>Recommended Action</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.top_risks.map((risk: EngineeringRiskItem, idx: number) => {
                  const style = getPriorityBadgeStyle(risk.priority);
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #0f172a' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: style.bg, color: style.text, fontWeight: 'bold', fontSize: '0.75rem' }}>
                          {risk.priority}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: '#38bdf8' }}>{risk.repository}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{risk.category}</td>
                      <td style={{ padding: '0.75rem' }}>{risk.metric}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{risk.score}</td>
                      <td style={{ padding: '0.75rem', color: '#cbd5e1' }}>{risk.explanation}</td>
                      <td style={{ padding: '0.75rem', color: '#22c55e', fontWeight: 500 }}>{risk.recommended_action}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => triggerDrillDown(risk.metric || risk.repository, 'RISK_ITEM')}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Investigate →
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerActionCreation(risk.metric || risk.repository, risk.category)}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#15803d', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            🛠️ Action →
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grid for Recommendations & Trends */}
      {data && (
        <div style={{ marginTop: '1.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {/* Prioritized Recommendations */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', margin: '0 0 0.9rem 0' }}>💡 Prioritized Engineering Recommendations</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {data.recommendations.map((rec: EngineeringRecommendationItem, idx: number) => {
                const style = getPriorityBadgeStyle(rec.priority);
                return (
                  <div key={idx} style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px', borderLeft: `3px solid ${style.text}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#f8fafc' }}>{rec.title}</strong>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', background: style.bg, color: style.text, fontSize: '0.7rem', fontWeight: 'bold' }}>
                          {rec.priority}
                        </span>
                        <button
                          type="button"
                          onClick={() => triggerActionCreation(rec.title, rec.category)}
                          style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#15803d', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          🛠️ Action →
                        </button>
                      </div>
                    </div>
                    <p style={{ margin: '0 0 0.3rem 0', fontSize: '0.8rem', color: '#94a3b8' }}>{rec.explanation}</p>
                    <div style={{ fontSize: '0.8rem', color: '#22c55e', fontWeight: 600 }}>👉 Action: {rec.action}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trend Summary */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', margin: '0 0 0.9rem 0' }}>📈 Engineering Trend Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Risk Trend:</span>
                <strong style={{ color: data.trend_summary.risk_trend === 'IMPROVING' ? '#22c55e' : '#ef4444' }}>{data.trend_summary.risk_trend}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Governance Trend:</span>
                <strong style={{ color: '#22c55e' }}>{data.trend_summary.governance_trend}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Health Trend:</span>
                <strong style={{ color: '#38bdf8' }}>{data.trend_summary.health_trend}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Testing Trend:</span>
                <strong style={{ color: '#a855f7' }}>{data.trend_summary.testing_trend}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Release Trend:</span>
                <strong style={{ color: '#22c55e' }}>{data.trend_summary.release_trend}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Repository Leaderboard */}
      {data && data.repository_leaderboard.length > 0 && (
        <div style={{ marginTop: '1.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.75rem' }}>🥇 Repository Benchmarking Leaderboard</h3>
          <div style={{ overflowX: 'auto', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', background: '#0f172a' }}>
                  <th style={{ padding: '0.75rem' }}>Rank</th>
                  <th style={{ padding: '0.75rem' }}>Repository</th>
                  <th style={{ padding: '0.75rem' }}>Benchmark Score</th>
                  <th style={{ padding: '0.75rem' }}>Gov Score</th>
                  <th style={{ padding: '0.75rem' }}>Risk Safety</th>
                  <th style={{ padding: '0.75rem' }}>Health</th>
                  <th style={{ padding: '0.75rem' }}>Quality</th>
                  <th style={{ padding: '0.75rem' }}>Release Gate</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.repository_leaderboard.map((repo, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 'bold', fontSize: '1rem' }}>{getMedalIcon(repo.rank)}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#f8fafc' }}>{repo.full_name || repo.repo_name}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#22c55e' }}>{repo.benchmark_score}</td>
                    <td style={{ padding: '0.75rem' }}>{repo.governance_score}</td>
                    <td style={{ padding: '0.75rem' }}>{repo.risk_safety_score}</td>
                    <td style={{ padding: '0.75rem' }}>{repo.repository_health}</td>
                    <td style={{ padding: '0.75rem' }}>{repo.code_quality}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ color: repo.release_gate_status === 'APPROVED_FOR_RELEASE' ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                        {repo.release_gate_status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => triggerDrillDown(repo.full_name || repo.repo_name, 'LEADERBOARD_REPO')}
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Investigate →
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerActionCreation(repo.full_name || repo.repo_name, 'GOVERNANCE')}
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#15803d', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          🛠️ Action →
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Engineering Events */}
      {data && (
        <div style={{ marginTop: '1.75rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', margin: '0 0 0.75rem 0' }}>⚡ Recent Engineering Events</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
            {data.recent_events.map((event: EngineeringEventItem, idx: number) => (
              <div key={idx} style={{ background: '#0f172a', padding: '0.6rem 0.9rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <span style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 'bold' }}>{event.repository}</span>: {event.summary}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', background: event.severity === 'CRITICAL' ? '#7f1d1d' : '#1e293b', color: event.severity === 'CRITICAL' ? '#fca5a5' : '#38bdf8', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    {event.severity}
                  </span>
                  <button
                    type="button"
                    onClick={() => triggerDrillDown(event.repository, 'EVENT')}
                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Investigate →
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerActionCreation(event.summary, 'MAINTAINABILITY')}
                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#15803d', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    🛠️ Action →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
