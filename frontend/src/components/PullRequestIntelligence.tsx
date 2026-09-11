import React, { useState, useEffect } from 'react';
import type {
  PullRequestIntelligenceResponse,
} from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface PullRequestIntelligenceProps {
  repositoryUrl: string;
  onInvestigate?: (target: string, targetType: string) => void;
  onCreateAction?: (target: string, category: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const PullRequestIntelligence: React.FC<PullRequestIntelligenceProps> = ({
  repositoryUrl,
  onInvestigate,
  onCreateAction,
  onNavigateTab,
}) => {
  const [data, setData] = useState<PullRequestIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // Form Revision Inputs
  const [baseRev, setBaseRev] = useState<string>('main');
  const [headRev, setHeadRev] = useState<string>('HEAD');
  const [prIdInput, setPrIdInput] = useState<string>('');

  const fetchPRIntelligence = async (base: string = baseRev, head: string = headRev, prId: string = prIdInput) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/pull-request-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository_url: repositoryUrl,
          base_revision: base,
          head_revision: head,
          pr_id: prId || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned HTTP ${res.status}`);
      }

      const json: PullRequestIntelligenceResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze pull request intelligence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryUrl) {
      fetchPRIntelligence();
    }
  }, [repositoryUrl]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPRIntelligence(baseRev, headRev, prIdInput);
  };

  const handleExport = async (format: 'json' | 'markdown' | 'html') => {
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/pull-request-intelligence/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository_url: repositoryUrl,
          base_revision: baseRev,
          head_revision: headRev,
          pr_id: prIdInput || undefined,
          export_format: format,
        }),
      });

      if (!res.ok) {
        throw new Error(`Export failed with status ${res.status}`);
      }

      const exportRes = await res.json();

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(exportRes.data || exportRes, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportRes.filename || 'pr_review.json';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const textContent = exportRes.content || '';
        const mimeType = format === 'html' ? 'text/html' : 'text/markdown';
        const blob = new Blob([textContent], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportRes.filename || `pr_review.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="spinner" style={{ margin: '0 auto 16px auto' }}></div>
        <h3>Analyzing Pull Request &amp; Change Set...</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Comparing revisions, calculating AST diffs, and evaluating release readiness...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ borderLeft: '4px solid #ef4444', padding: '20px' }}>
        <h3 style={{ color: '#ef4444' }}>Pull Request Review Error</h3>
        <p>{error}</p>
        <button type="button" className="btn btn-secondary" onClick={() => fetchPRIntelligence()} style={{ marginTop: '12px' }}>
          Retry Analysis
        </button>
      </div>
    );
  }

  if (!data) return null;

  const decision = data.pr_decision || 'NEEDS_REVIEW';
  const diff = data.diff_summary || {};
  const revSummary = data.review_summary || {};
  const testImpact = data.test_impact || {};
  const govRel = data.governance_and_release || {};
  const integrations = data.integrations || {};

  const getDecisionBannerStyle = (dec: string) => {
    switch (dec) {
      case 'READY':
        return { background: '#065f46', borderColor: '#059669', color: '#34d399', icon: '✅' };
      case 'NEEDS_REVIEW':
        return { background: '#78350f', borderColor: '#d97706', color: '#fbbf24', icon: '⚠️' };
      case 'BLOCKED':
        return { background: '#881337', borderColor: '#e11d48', color: '#f43f5e', icon: '🚫' };
      default:
        return { background: '#1e293b', borderColor: '#38bdf8', color: '#38bdf8', icon: '🔀' };
    }
  };

  const bannerStyle = getDecisionBannerStyle(decision);

  return (
    <div className="pull-request-intelligence">
      {/* Header Card & Revision Input Controls */}
      <div className="card" style={{ borderLeft: '4px solid #a855f7', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🔀 Pull Request Intelligence &amp; Automated Code Review</span>
            </h2>
            <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Automated engineering review for repository <strong>{data.repository_name}</strong>.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!!exporting}
              onClick={() => handleExport('json')}
            >
              {exporting === 'json' ? 'Exporting...' : '📥 Export JSON'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!!exporting}
              onClick={() => handleExport('markdown')}
            >
              {exporting === 'markdown' ? 'Exporting...' : '📄 Export MD'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!!exporting}
              onClick={() => handleExport('html')}
            >
              {exporting === 'html' ? 'Exporting...' : '🌐 Export HTML (XSS-Safe)'}
            </button>
          </div>
        </div>

        {/* Revision Filter Controls Form */}
        <form onSubmit={handleFormSubmit} style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Base Revision
            </label>
            <input
              type="text"
              value={baseRev}
              onChange={(e) => setBaseRev(e.target.value)}
              placeholder="main or SHA"
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color, #334155)', background: 'var(--bg-main, #0f172a)', color: '#fff', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Head / Target Revision
            </label>
            <input
              type="text"
              value={headRev}
              onChange={(e) => setHeadRev(e.target.value)}
              placeholder="HEAD or branch"
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color, #334155)', background: 'var(--bg-main, #0f172a)', color: '#fff', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              PR Title / ID (Optional)
            </label>
            <input
              type="text"
              value={prIdInput}
              onChange={(e) => setPrIdInput(e.target.value)}
              placeholder="PR-101"
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color, #334155)', background: 'var(--bg-main, #0f172a)', color: '#fff', fontSize: '0.85rem' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.85rem' }}>
            🔄 Re-Run Review
          </button>
        </form>
      </div>

      {/* 2. Automated PR Decision Banner */}
      <div
        style={{
          background: bannerStyle.background,
          border: `1px solid ${bannerStyle.borderColor}`,
          color: bannerStyle.color,
          padding: '20px',
          borderRadius: '10px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>{bannerStyle.icon}</span>
            <span>AUTOMATED PR VERDICT: {decision}</span>
          </div>
          <p style={{ margin: '6px 0 0 0', fontSize: '0.95rem', opacity: 0.9 }}>
            {data.decision_reason}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <span className="badge" style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '0.85rem', padding: '6px 12px' }}>
            Change Intensity: {data.change_intensity}
          </span>
          <span className="badge" style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '0.85rem', padding: '6px 12px' }}>
            Release Gate: {data.release_status}
          </span>
        </div>
      </div>

      {/* 3. KPI Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: '24px' }}>
        <div className="stat-box">
          <span className="stat-number" style={{ color: data.regression_risk >= 70 ? '#ef4444' : '#f59e0b' }}>
            {data.regression_risk}/100
          </span>
          <span className="stat-label">Regression Risk (SSoT)</span>
        </div>
        <div className="stat-box">
          <span className="stat-number accent-source">{diff.total_files_changed || 0}</span>
          <span className="stat-label">Files Changed</span>
        </div>
        <div className="stat-box">
          <span className="stat-number accent-dir">+{diff.lines_added || 0} / -{diff.lines_removed || 0}</span>
          <span className="stat-label">Lines Modified</span>
        </div>
        <div className="stat-box">
          <span className="stat-number accent-test">{testImpact.total_affected_tests || 0}</span>
          <span className="stat-label">Affected Tests</span>
        </div>
        <div className="stat-box">
          <span className="stat-number" style={{ color: '#38bdf8' }}>{data.governance_score}/100</span>
          <span className="stat-label">Governance Score</span>
        </div>
        <div className="stat-box">
          <span className="stat-number" style={{ color: '#a855f7' }}>{data.engineering_score}/100</span>
          <span className="stat-label">Engineering Score</span>
        </div>
      </div>

      {/* 9. Review Summary Cards */}
      <div className="card" style={{ marginBottom: '24px', background: 'var(--bg-card-secondary, #1e293b)' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#38bdf8' }}>📝 Explainable Engineering Review Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'var(--bg-main, #0f172a)', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
            <strong style={{ color: '#a855f7', fontSize: '0.9rem' }}>📂 What Changed:</strong>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{revSummary.what_changed}</p>
          </div>
          <div style={{ background: 'var(--bg-main, #0f172a)', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
            <strong style={{ color: '#38bdf8', fontSize: '0.9rem' }}>🎯 Why It Matters:</strong>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{revSummary.why_it_matters}</p>
          </div>
          <div style={{ background: 'var(--bg-main, #0f172a)', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
            <strong style={{ color: '#ef4444', fontSize: '0.9rem' }}>⚠️ Highest Risks:</strong>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{revSummary.highest_risks}</p>
          </div>
          <div style={{ background: 'var(--bg-main, #0f172a)', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
            <strong style={{ color: '#10b981', fontSize: '0.9rem' }}>🧪 Test Recommendation:</strong>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{revSummary.affected_tests_summary}</p>
          </div>
        </div>
      </div>

      {/* 4. Changed Files Table */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0' }}>📄 Changed Files Breakdown ({data.changed_files?.length || 0})</h3>
        {(!data.changed_files || data.changed_files.length === 0) ? (
          <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No file changes detected between base and head revisions.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main, #0f172a)', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>File Path</th>
                  <th style={{ padding: '10px' }}>Change Type</th>
                  <th style={{ padding: '10px' }}>Lines (+/-)</th>
                  <th style={{ padding: '10px' }}>Impact Level</th>
                  <th style={{ padding: '10px' }}>Complexity Delta</th>
                  <th style={{ padding: '10px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.changed_files.map((fc, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #334155)' }}>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>
                      <code style={{ color: '#a855f7' }}>{fc.file}</code>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span
                        className="badge"
                        style={{
                          background: fc.change_type === 'ADDED' ? '#10b981' : fc.change_type === 'DELETED' ? '#ef4444' : '#0284c7',
                          color: '#fff',
                        }}
                      >
                        {fc.change_type}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontSize: '0.85rem' }}>
                      <span style={{ color: '#10b981' }}>+{fc.lines_added}</span> / <span style={{ color: '#ef4444' }}>-{fc.lines_removed}</span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span
                        className="badge"
                        style={{
                          background: fc.impact_level === 'HIGH' || fc.impact_level === 'CRITICAL' ? '#ef4444' : fc.impact_level === 'MEDIUM' ? '#f59e0b' : '#334155',
                          color: '#fff',
                        }}
                      >
                        {fc.impact_level}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontSize: '0.85rem' }}>
                      {fc.complexity_delta > 0 ? `+${fc.complexity_delta}` : '0'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {onInvestigate && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                          onClick={() => onInvestigate(fc.file, 'FILE')}
                        >
                          Investigate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. Test Impact & Recommended Order */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🧪 Recommended Test Execution Order (P0–P3)</span>
        </h3>
        {(!testImpact.affected_tests || testImpact.affected_tests.length === 0) ? (
          <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No affected test modules identified.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main, #0f172a)', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Priority</th>
                  <th style={{ padding: '10px' }}>Order</th>
                  <th style={{ padding: '10px' }}>Test File Module</th>
                  <th style={{ padding: '10px' }}>Impact Type</th>
                  <th style={{ padding: '10px' }}>Dependency Path</th>
                </tr>
              </thead>
              <tbody>
                {testImpact.affected_tests.map((t, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color, #334155)' }}>
                    <td style={{ padding: '10px' }}>
                      <span
                        className="badge"
                        style={{
                          background: t.priority === 'P0' ? '#ef4444' : t.priority === 'P1' ? '#f59e0b' : t.priority === 'P2' ? '#0284c7' : '#334155',
                          color: '#fff',
                          fontWeight: 'bold',
                        }}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>#{t.recommended_order}</td>
                    <td style={{ padding: '10px' }}>
                      <code style={{ color: '#38bdf8' }}>{t.test_file}</code>
                    </td>
                    <td style={{ padding: '10px', fontSize: '0.85rem' }}>{t.test_type}</td>
                    <td style={{ padding: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {t.dependency_path}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 7. Governance & Release Readiness */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#10b981' }}>🛡️ Governance &amp; Release Gate Compliance</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'var(--bg-main, #0f172a)', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
            <strong style={{ color: '#ef4444', fontSize: '0.9rem' }}>🚫 Policy Warnings &amp; Violations ({govRel.policy_violations?.length || 0}):</strong>
            {(!govRel.policy_violations || govRel.policy_violations.length === 0) ? (
              <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#10b981' }}>✓ No policy violations detected.</p>
            ) : (
              <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', fontSize: '0.85rem', color: '#f59e0b' }}>
                {govRel.policy_violations.map((v: string, i: number) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ background: 'var(--bg-main, #0f172a)', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
            <strong style={{ color: '#f59e0b', fontSize: '0.9rem' }}>🚨 Release Gate Blockers ({govRel.blockers?.length || 0}):</strong>
            {(!govRel.blockers || govRel.blockers.length === 0) ? (
              <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem', color: '#10b981' }}>✓ No release blockers identified.</p>
            ) : (
              <ul style={{ margin: '6px 0 0 0', paddingLeft: '20px', fontSize: '0.85rem', color: '#ef4444' }}>
                {govRel.blockers.map((b: string, i: number) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* 8 & 9. Recommended Actions & Audit Integration Links */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0' }}>⚡ Recommended Engineering Actions &amp; Workflows</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {onCreateAction && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onCreateAction(data.changed_files[0]?.file || 'PR-Changes', 'RISK')}
            >
              🛠️ Create Remediation Action in Action Center
            </button>
          )}

          {onInvestigate && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onInvestigate(integrations.investigation_target || 'src/main.py', 'FILE')}
            >
              🔎 Launch Deep Investigation in Investigation Center
            </button>
          )}

          {onNavigateTab && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigateTab('audit-history')}
            >
              📜 View Decision Ledger in Audit History
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
