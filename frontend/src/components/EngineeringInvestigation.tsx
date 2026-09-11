import React, { useState, useEffect } from 'react';
import type {
  EngineeringInvestigationResponse,
  EngineeringInvestigationExportResponse,
  InvestigationEvidenceItem,
  AffectedFileAnalysisItem,
  FunctionImpactAnalysisItem,
  DependencyPathAnalysisItem,
  InvestigatedTestItem,
} from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface EngineeringInvestigationProps {
  repositoryUrl: string;
  initialTarget?: string;
  initialTargetType?: string;
  onCreateAction?: (target: string, category: string) => void;
}

export const EngineeringInvestigation: React.FC<EngineeringInvestigationProps> = ({
  repositoryUrl,
  initialTarget,
  initialTargetType,
  onCreateAction,
}) => {
  const [target, setTarget] = useState<string>(initialTarget || '');
  const [targetType, setTargetType] = useState<string>(initialTargetType || 'FILE');
  const [data, setData] = useState<EngineeringInvestigationResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchInvestigationData = async (t?: string, tt?: string) => {
    setLoading(true);
    setError(null);
    try {
      const activeTarget = t !== undefined ? t : target;
      const activeTargetType = tt !== undefined ? tt : targetType;
      const queryParams = new URLSearchParams({
        repository_url: repositoryUrl,
        target: activeTarget,
        target_type: activeTargetType,
      });

      const res = await fetch(`${API_BASE_URL}/api/engineering-investigation?${queryParams.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned HTTP ${res.status}`);
      }
      const json: EngineeringInvestigationResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to perform engineering investigation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryUrl) {
      fetchInvestigationData(initialTarget, initialTargetType);
    }
  }, [repositoryUrl, initialTarget, initialTargetType]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInvestigationData();
  };

  const handleCreateActionFromTarget = async () => {
    if (!data) return;
    setActionNotice(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/engineering-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository_url: repositoryUrl,
          source: 'INVESTIGATION',
          source_reference: data.target,
          title: `Remediate Investigation Findings: ${data.target}`,
          description: data.summary,
          category: data.overall_risk === 'CRITICAL' || data.overall_risk === 'HIGH' ? 'RISK' : 'DEPENDENCY',
          priority: data.overall_risk === 'CRITICAL' ? 'P0' : (data.overall_risk === 'HIGH' ? 'P1' : 'P2'),
          severity: data.overall_risk,
          affected_files: data.affected_files.map((af) => af.path),
          affected_tests: data.affected_tests.map((at) => at.test_file),
          risk_score: data.risk_score,
          governance_score: data.governance_impact?.governance_score || 80.0,
          release_status: data.release_impact?.release_status || 'APPROVED_FOR_RELEASE',
          recommended_action: data.recommendations?.[0]?.action || 'Execute remediation recommendations.',
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const resJson = await res.json();
      const act = resJson.action;
      const noticeMsg = `Engineering action created: ${act.action_id} (${act.priority} - ${act.category})`;
      setActionNotice(noticeMsg);

      if (onCreateAction) {
        onCreateAction(data.target, 'RISK');
      }
    } catch (err: any) {
      alert(`Action Creation Failed: ${err.message}`);
    }
  };

  const handleExport = async (format: 'json' | 'markdown' | 'html') => {
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/engineering-investigation/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository_url: repositoryUrl,
          target: target,
          target_type: targetType,
          export_format: format,
        }),
      });

      if (!res.ok) {
        throw new Error(`Export failed with HTTP ${res.status}`);
      }

      const result: EngineeringInvestigationExportResponse = await res.json();
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
      a.download = result.filename || `engineering_investigation.${format}`;
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

  const getRiskColor = (level: string) => {
    if (level === 'LOW') return '#22c55e';
    if (level === 'MEDIUM') return '#eab308';
    if (level === 'HIGH') return '#f97316';
    return '#ef4444';
  };

  const getPriorityBadgeStyle = (priority: string) => {
    if (priority === 'P0') return { bg: '#7f1d1d', text: '#fca5a5' };
    if (priority === 'P1') return { bg: '#431407', text: '#fdba74' };
    if (priority === 'P2') return { bg: '#365314', text: '#bef264' };
    return { bg: '#0f172a', text: '#94a3b8' };
  };

  return (
    <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: '#0f172a', borderRadius: '12px', color: '#f8fafc' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>🔎 Engineering Investigation &amp; Drill-Down Center</span>
          </h2>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Step 38: Deep-dive root cause analysis investigating why risks occur, what components are affected, and exact test priorities.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {data && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleCreateActionFromTarget}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: '#15803d' }}
            >
              🛠️ Create Engineering Action
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={loading}
            onClick={() => fetchInvestigationData()}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {loading ? 'Analyzing...' : '🔄 Refresh Investigation'}
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

      {/* Target Selector Form */}
      <form onSubmit={handleSearch} style={{ marginTop: '1.25rem', background: '#1e293b', padding: '1rem', borderRadius: '8px', border: '1px solid #334155', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1', minWidth: '240px' }}>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Investigation Target (File / Function / Commit / Risk)</label>
          <input
            type="text"
            className="tab-search-input"
            style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '0.45rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
            placeholder="e.g. src/requests/api.py or request_task or P0 Risk"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>

        <div style={{ width: '160px' }}>
          <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.25rem' }}>Target Type</label>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid #334155', padding: '0.45rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}
          >
            <option value="FILE">FILE</option>
            <option value="FUNCTION">FUNCTION</option>
            <option value="COMMIT">COMMIT</option>
            <option value="RISK_ITEM">RISK_ITEM</option>
            <option value="ALERT">ALERT</option>
            <option value="LEADERBOARD_REPO">LEADERBOARD_REPO</option>
            <option value="EVENT">EVENT</option>
          </select>
        </div>

        <div style={{ alignSelf: 'flex-end' }}>
          <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
            🔎 Investigate Target
          </button>
        </div>
      </form>

      {error && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#450a0a', border: '1px solid #ef4444', borderRadius: '6px', color: '#fca5a5', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      {actionNotice && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#064e3b', border: '1px solid #10b981', borderRadius: '6px', color: '#a7f3d0', fontSize: '0.85rem', fontWeight: 'bold' }}>
          ✅ {actionNotice}
        </div>
      )}

      {/* Target Hero & Executive Finding */}
      {data && (
        <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: '#1e293b', border: `2px solid ${getRiskColor(data.overall_risk)}`, borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                Investigation Target [{data.target_type}]
              </span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.4rem', color: '#38bdf8', fontFamily: 'monospace' }}>
                {data.target}
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                ID: <code style={{ color: '#cbd5e1' }}>{data.investigation_id}</code> | Repository: {data.full_name}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ background: '#0f172a', padding: '0.65rem 1.2rem', borderRadius: '8px', textAlign: 'center', minWidth: '130px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Overall Risk Level</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: getRiskColor(data.overall_risk), marginTop: '0.25rem' }}>
                  {data.overall_risk}
                </div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.65rem 1.2rem', borderRadius: '8px', textAlign: 'center', minWidth: '130px' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Risk Score</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: getRiskColor(data.overall_risk), marginTop: '0.25rem' }}>
                  {data.risk_score} / 100
                </div>
              </div>
              <button
                type="button"
                onClick={handleCreateActionFromTarget}
                style={{ background: '#15803d', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.75rem 1.2rem', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                🛠️ Create Action →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Executive Finding Summary */}
      {data && (
        <div style={{ marginTop: '1.25rem', padding: '1rem 1.25rem', background: '#0b1329', borderLeft: '4px solid #38bdf8', borderRadius: '8px', color: '#f1f5f9', fontSize: '0.95rem', lineHeight: '1.5' }}>
          <strong style={{ color: '#38bdf8' }}>🔍 Executive Investigation Finding:</strong> {data.summary}
        </div>
      )}

      {/* Risk Factors Breakdown */}
      {data && data.risk_factors && (
        <div style={{ marginTop: '1.5rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', margin: '0 0 0.9rem 0' }}>📊 Risk Factor Score Breakdown</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Dependency Radius</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.25rem' }}>
                {data.risk_factors.dependency_radius} / 30
              </div>
            </div>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Target Complexity</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#eab308', marginTop: '0.25rem' }}>
                {data.risk_factors.target_complexity} / 25
              </div>
            </div>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Module Fan-out</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#a855f7', marginTop: '0.25rem' }}>
                {data.risk_factors.module_fanout} / 25
              </div>
            </div>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Test Coverage Gap</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ef4444', marginTop: '0.25rem' }}>
                {data.risk_factors.test_coverage_gap} / 20
              </div>
            </div>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px', textAlign: 'center', border: '1px solid #38bdf8' }}>
              <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 'bold' }}>Calculated Score</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: getRiskColor(data.overall_risk), marginTop: '0.25rem' }}>
                {data.risk_factors.total_score} / 100
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Engine Cards */}
      {data && data.evidence.length > 0 && (
        <div style={{ marginTop: '1.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.75rem' }}>📑 Investigation Evidence Engine</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {data.evidence.map((ev: InvestigationEvidenceItem, idx: number) => (
              <div key={idx} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#38bdf8' }}>{ev.category}</span>
                  <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', background: ev.severity === 'HIGH' || ev.severity === 'CRITICAL' ? '#7f1d1d' : '#0f172a', color: ev.severity === 'HIGH' || ev.severity === 'CRITICAL' ? '#fca5a5' : '#38bdf8', fontSize: '0.7rem', fontWeight: 'bold' }}>
                    {ev.severity}
                  </span>
                </div>
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.4' }}>{ev.explanation}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                  <span>Metric: <code>{ev.metric}</code> = {String(ev.current_value)}</span>
                  <span>Source: {ev.source}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Affected Files & Function Impact */}
      {data && (
        <div style={{ marginTop: '1.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {/* Affected Files Table */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', margin: '0 0 0.9rem 0' }}>📁 Affected Files Analysis</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                    <th style={{ padding: '0.5rem' }}>Path</th>
                    <th style={{ padding: '0.5rem' }}>Impact</th>
                    <th style={{ padding: '0.5rem' }}>Depth</th>
                    <th style={{ padding: '0.5rem' }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.affected_files.map((af: AffectedFileAnalysisItem, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #0f172a' }}>
                      <td style={{ padding: '0.5rem', fontFamily: 'monospace', color: '#38bdf8' }}>{af.path}</td>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>{af.impact_type}</td>
                      <td style={{ padding: '0.5rem' }}>{af.dependency_depth}</td>
                      <td style={{ padding: '0.5rem', color: '#cbd5e1' }}>{af.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Function-Level Analysis */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', margin: '0 0 0.9rem 0' }}>⚙️ Function-Level Impact Analysis</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                    <th style={{ padding: '0.5rem' }}>Function</th>
                    <th style={{ padding: '0.5rem' }}>Complexity</th>
                    <th style={{ padding: '0.5rem' }}>Nesting</th>
                    <th style={{ padding: '0.5rem' }}>Risk Level</th>
                  </tr>
                </thead>
                <tbody>
                  {data.affected_functions.map((fn: FunctionImpactAnalysisItem, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #0f172a' }}>
                      <td style={{ padding: '0.5rem', fontFamily: 'monospace', color: '#f8fafc' }}>def {fn.function}()</td>
                      <td style={{ padding: '0.5rem', fontWeight: 'bold', color: fn.complexity > 8 ? '#ef4444' : '#38bdf8' }}>{fn.complexity}</td>
                      <td style={{ padding: '0.5rem' }}>{fn.nesting_depth}</td>
                      <td style={{ padding: '0.5rem', color: getRiskColor(fn.risk_level), fontWeight: 'bold' }}>{fn.risk_level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Visual Dependency Path Trace */}
      {data && data.dependency_paths.length > 0 && (
        <div style={{ marginTop: '1.75rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', margin: '0 0 0.75rem 0' }}>🔗 Dependency Path Trace</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {data.dependency_paths.map((dp: DependencyPathAnalysisItem, idx: number) => (
              <div key={idx} style={{ background: '#0f172a', padding: '0.75rem 1rem', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.85rem', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>Path #{idx + 1}:</span> {dp.formatted_path}
                </div>
                <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: '#1e293b', color: '#a855f7', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  Depth {dp.depth}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Affected Tests Execution Order */}
      {data && data.affected_tests.length > 0 && (
        <div style={{ marginTop: '1.75rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', margin: '0 0 0.75rem 0' }}>🧪 Affected Tests &amp; Recommended Execution Order</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {data.affected_tests.map((t: InvestigatedTestItem, idx: number) => {
              const style = getPriorityBadgeStyle(t.priority);
              return (
                <div key={idx} style={{ background: '#0f172a', padding: '0.75rem 1rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', background: style.bg, color: style.text, fontSize: '0.7rem', fontWeight: 'bold', marginRight: '0.6rem' }}>
                      #{t.recommended_execution_order} {t.priority}
                    </span>
                    <strong style={{ fontFamily: 'monospace', color: '#f8fafc' }}>{t.test_file}</strong>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>{t.reason}</p>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontFamily: 'monospace' }}>{t.dependency_path}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid for Release, Governance & Next Actions */}
      {data && (
        <div style={{ marginTop: '1.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
          {/* Release & Governance Impact */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', margin: '0 0 0.9rem 0' }}>🚀 Release &amp; Governance Impact</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Release Gate Status:</span>
                <strong style={{ color: data.release_impact.release_status === 'APPROVED_FOR_RELEASE' ? '#22c55e' : '#ef4444' }}>
                  {data.release_impact.release_status}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Governance Score:</span>
                <strong style={{ color: '#38bdf8' }}>{data.governance_impact.governance_score} / 100</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px' }}>
                <span style={{ color: '#94a3b8' }}>Release Readiness Affected:</span>
                <strong style={{ color: data.release_impact.affects_release_readiness ? '#ef4444' : '#22c55e' }}>
                  {data.release_impact.affects_release_readiness ? 'YES' : 'NO'}
                </strong>
              </div>
            </div>
          </div>

          {/* Ordered Next Actions */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', margin: '0 0 0.9rem 0' }}>📋 Ordered Next Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
              {data.next_actions.map((act: string, idx: number) => (
                <div key={idx} style={{ background: '#0f172a', padding: '0.6rem 0.8rem', borderRadius: '6px', color: '#22c55e', fontWeight: 500 }}>
                  {act}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
