import React, { useState, useEffect } from 'react';
import type { ArchitectureIntelligenceResponse, PRArchitectureImpactResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface ArchitectureIntelligenceProps {
  repositoryUrl: string;
  onNavigateTab?: (tab: string) => void;
}

export const ArchitectureIntelligence: React.FC<ArchitectureIntelligenceProps> = ({
  repositoryUrl,
  onNavigateTab: _onNavigateTab,
}) => {
  const [data, setData] = useState<ArchitectureIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // PR Architecture Impact Evaluator state
  const [prId, setPrId] = useState<string>('');
  const [prImpactData, setPrImpactData] = useState<PRArchitectureImpactResponse | null>(null);
  const [evaluatingPr, setEvaluatingPr] = useState<boolean>(false);

  const fetchArchitectureData = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({ repository_url: repositoryUrl });
      const res = await fetch(`${API_BASE_URL}/api/architecture-intelligence?${queryParams.toString()}`, {
        headers: { 'X-API-Key': 'key_dev_secret_789' },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `Server error HTTP ${res.status}`);
      }

      const json: ArchitectureIntelligenceResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze repository architecture.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryUrl) {
      fetchArchitectureData();
    }
  }, [repositoryUrl]);

  const handleEvaluatePrImpact = async () => {
    if (!prId.trim()) return;
    setEvaluatingPr(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/architecture-intelligence/pr-impact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'key_dev_secret_789',
        },
        body: JSON.stringify({
          repository_url: repositoryUrl,
          pr_id: prId.trim(),
        }),
      });

      if (!res.ok) throw new Error(`PR impact HTTP ${res.status}`);
      const prRes: PRArchitectureImpactResponse = await res.json();
      setPrImpactData(prRes);
    } catch (err: any) {
      alert(`PR Architecture Impact evaluation error: ${err.message}`);
    } finally {
      setEvaluatingPr(false);
    }
  };

  const handleExport = async (format: 'json' | 'markdown') => {
    if (!data) return;
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/architecture-intelligence/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'key_dev_secret_789',
        },
        body: JSON.stringify({
          architecture_data: data,
          export_format: format,
        }),
      });

      if (!res.ok) throw new Error(`Export HTTP ${res.status}`);
      const exportRes = await res.json();

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(exportRes.data || data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = exportRes.filename || 'architecture_intelligence.json';
        link.click();
      } else {
        const blob = new Blob([exportRes.content || ''], { type: 'text/markdown' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = exportRes.filename || 'architecture_intelligence.md';
        link.click();
      }
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'CRITICAL':
      case 'CRITICAL_RISK':
        return '#f43f5e';
      case 'HIGH':
      case 'HIGH_RISK':
        return '#f59e0b';
      case 'MODERATE_RISK':
      case 'MEDIUM':
        return '#eab308';
      default:
        return '#10b981';
    }
  };

  return (
    <div style={{ padding: '1.5rem', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)', color: '#f8fafc', margin: '1.5rem 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🏛️</span>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, background: 'linear-gradient(135deg, #a855f7 0%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Architecture Intelligence Engine
            </h2>
            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
              Step 47 Topology
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0 2.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>
            Repository code structure, architectural layers, coupling instability metrics, cyclic import detection, and decoupling insights.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => handleExport('json')}
            disabled={exporting === 'json'}
            style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#e2e8f0', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            {exporting === 'json' ? 'Exporting...' : '📄 Export JSON'}
          </button>
          <button
            onClick={() => handleExport('markdown')}
            disabled={exporting === 'markdown'}
            style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#e2e8f0', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            {exporting === 'markdown' ? 'Exporting...' : '📝 Export MD'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', color: '#fca5a5', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      {loading && !data && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
          Analyzing repository architectural topology and module coupling...
        </div>
      )}

      {data && (
        <>
          {/* Architecture Overview Banner */}
          <div style={{ background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(56, 189, 248, 0.1) 100%)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#a855f7', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Architectural Pattern
                </span>
                <h3 style={{ margin: '0.2rem 0', fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc' }}>
                  {data.architecture_pattern}
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1' }}>
                  {data.pattern_description}
                </p>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: `2px solid ${getRiskColor(data.architectural_risk_level)}`, borderRadius: '10px', padding: '0.75rem 1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Architectural Health</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: getRiskColor(data.architectural_risk_level) }}>
                  {data.architectural_health_score}/100
                </div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: getRiskColor(data.architectural_risk_level) }}>
                  {data.architectural_risk_level}
                </div>
              </div>
            </div>

            {/* Metrics Counter Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Total Modules</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>{data.metrics.total_modules}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Dependency Edges</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#cbd5e1' }}>{data.metrics.total_dependency_edges}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Cyclic Dependencies</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: data.metrics.cyclic_dependencies_count > 0 ? '#f43f5e' : '#10b981' }}>
                  {data.metrics.cyclic_dependencies_count}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Coupling Hotspots</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: data.metrics.coupling_hotspots_count > 0 ? '#f59e0b' : '#10b981' }}>
                  {data.metrics.coupling_hotspots_count}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Layer Violations</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: data.metrics.layer_violations_count > 0 ? '#ef4444' : '#10b981' }}>
                  {data.metrics.layer_violations_count}
                </div>
              </div>
            </div>
          </div>

          {/* Architectural Layers Breakdown Grid */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#f1f5f9' }}>
              Architectural Layers Breakdown
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              {Object.entries(data.layer_breakdown || {}).map(([lName, lInfo], idx) => (
                <div key={idx} style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.25rem' }}>
                    {lName}
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>
                    {lInfo.file_count} module(s)
                  </div>
                  {lInfo.files && lInfo.files.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {lInfo.files.map((f, fIdx) => (
                        <div key={fIdx} style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          • {f}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Coupling & Instability Hotspots Table */}
          <div style={{ marginBottom: '1.5rem', background: 'rgba(15, 23, 42, 0.85)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#f1f5f9' }}>
              Module Coupling &amp; Instability Hotspots
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                    <th style={{ padding: '0.6rem' }}>Module File</th>
                    <th style={{ padding: '0.6rem' }}>Layer</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>Fan-In (Ca)</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>Fan-Out (Ce)</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>Instability (I)</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>Coupling Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.module_coupling_metrics || []).slice(0, 8).map((m, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '0.6rem', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>{m.file}</td>
                      <td style={{ padding: '0.6rem', color: '#94a3b8' }}>{m.layer}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'center', color: '#e2e8f0' }}>{m.afferent_coupling_ca}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'center', color: '#e2e8f0' }}>{m.efferent_coupling_ce}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'center', color: '#a855f7', fontWeight: 700 }}>{m.instability_index}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'center' }}>
                        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, background: `${getRiskColor(m.coupling_risk)}20`, color: getRiskColor(m.coupling_risk), border: `1px solid ${getRiskColor(m.coupling_risk)}40` }}>
                          {m.coupling_risk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cyclic Dependency Violations & Layer Breach Alerts */}
          {(data.cyclic_dependencies.length > 0 || data.layer_violations.length > 0) && (
            <div style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {/* Cycles Card */}
              {data.cyclic_dependencies.length > 0 && (
                <div style={{ background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '10px', padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#f43f5e', fontSize: '0.95rem' }}>
                    🔄 Cyclic Dependency Loops ({data.cyclic_dependencies.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {data.cyclic_dependencies.map((c, idx) => (
                      <div key={idx} style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'monospace', color: '#fca5a5' }}>
                        {c.formatted_cycle}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Layer Violations Card */}
              {data.layer_violations.length > 0 && (
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#ef4444', fontSize: '0.95rem' }}>
                    ⚠️ Layer Boundary Breaches ({data.layer_violations.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {data.layer_violations.map((v, idx) => (
                      <div key={idx} style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', color: '#fca5a5' }}>
                        {v.explanation}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PR Architectural Impact Evaluator */}
          <div style={{ marginBottom: '1.5rem', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: '#f1f5f9' }}>
              PR Architectural Impact Evaluator
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={prId}
                onChange={(e) => setPrId(e.target.value)}
                placeholder="Enter PR ID (e.g. pr-101 or 42)"
                style={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', width: '220px' }}
              />
              <button
                onClick={handleEvaluatePrImpact}
                disabled={evaluatingPr}
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #38bdf8 100%)', color: '#0f172a', border: 'none', fontWeight: 700, padding: '0.45rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                {evaluatingPr ? 'Evaluating...' : 'Evaluate PR Architecture Risk 🔍'}
              </button>
            </div>

            {prImpactData && (
              <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '0.75rem 1rem', borderRadius: '8px', border: `1px solid ${getRiskColor(prImpactData.pr_architectural_risk)}40` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                    PR #{prImpactData.pr_id} Architectural Risk:
                  </span>
                  <span style={{ padding: '0.15rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800, background: `${getRiskColor(prImpactData.pr_architectural_risk)}20`, color: getRiskColor(prImpactData.pr_architectural_risk), border: `1px solid ${getRiskColor(prImpactData.pr_architectural_risk)}50` }}>
                    {prImpactData.pr_architectural_risk}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.825rem', color: '#cbd5e1' }}>
                  {prImpactData.recommendation}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
export default ArchitectureIntelligence;
