import React, { useState, useEffect } from 'react';
import type {
  EngineeringAction,
  EngineeringActionSummary,
  EngineeringActionExportResponse,
  ActionHistoryItem,
} from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface EngineeringActionCenterProps {
  repositoryUrl: string;
  onInvestigate?: (target: string, targetType: string) => void;
  selectedActionId?: string;
}

export const EngineeringActionCenter: React.FC<EngineeringActionCenterProps> = ({
  repositoryUrl,
  onInvestigate,
  selectedActionId,
}) => {
  const [summary, setSummary] = useState<EngineeringActionSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<EngineeringAction | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchActions = async () => {
    setLoading(true);
    setError(null);
    try {
      // Auto-generate / fetch actions
      const genRes = await fetch(`${API_BASE_URL}/api/engineering-actions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repository_url: repositoryUrl }),
      });

      if (!genRes.ok) {
        throw new Error(`Server returned HTTP ${genRes.status}`);
      }

      const data: EngineeringActionSummary = await genRes.json();
      setSummary(data);

      if (data.actions && data.actions.length > 0) {
        if (selectedActionId) {
          const matched = data.actions.find((a) => a.action_id === selectedActionId);
          setSelectedAction(matched || data.actions[0]);
        } else if (!selectedAction) {
          setSelectedAction(data.actions[0]);
        } else {
          const refreshed = data.actions.find((a) => a.action_id === selectedAction.action_id);
          setSelectedAction(refreshed || data.actions[0]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Engineering Action Center.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryUrl) {
      fetchActions();
    }
  }, [repositoryUrl, selectedActionId]);

  const handleTransition = async (actionId: string, newStatus: string) => {
    setActionMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/engineering-actions/${actionId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_status: newStatus, reason: `User transitioned action to ${newStatus}` }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Transition failed with HTTP ${res.status}`);
      }

      setActionMessage(`Action transitioned to ${newStatus}`);
      fetchActions();
    } catch (err: any) {
      alert(`Transition Error: ${err.message}`);
    }
  };

  const handleVerify = async (actionId: string) => {
    setActionMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/engineering-actions/${actionId}/verify`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || `Verification failed with HTTP ${res.status}`);
      }

      const resJson = await res.json();
      setActionMessage(resJson.action?.verification_message || 'Static verification re-evaluated.');
      fetchActions();
    } catch (err: any) {
      alert(`Verification Error: ${err.message}`);
    }
  };

  const handleExport = async (format: 'json' | 'markdown' | 'html') => {
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/engineering-actions/export`, {
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

      const result: EngineeringActionExportResponse = await res.json();
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
      a.download = result.filename || `engineering_actions.${format}`;
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

  const getPriorityStyle = (priority: string) => {
    if (priority === 'P0') return { bg: '#7f1d1d', text: '#fca5a5' };
    if (priority === 'P1') return { bg: '#431407', text: '#fdba74' };
    if (priority === 'P2') return { bg: '#365314', text: '#bef264' };
    return { bg: '#0f172a', text: '#94a3b8' };
  };

  const getStatusStyle = (status: string) => {
    if (status === 'OPEN') return { bg: '#450a0a', text: '#fca5a5' };
    if (status === 'IN_PROGRESS') return { bg: '#1e3a8a', text: '#93c5fd' };
    if (status === 'RESOLVED') return { bg: '#365314', text: '#bef264' };
    if (status === 'VERIFIED') return { bg: '#064e3b', text: '#6ee7b7' };
    return { bg: '#0f172a', text: '#94a3b8' };
  };

  const workflowSteps = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'CLOSED'];

  return (
    <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: '#0f172a', borderRadius: '12px', color: '#f8fafc' }}>
      {/* SECTION A: HERO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>🛠️ Engineering Action Center</span>
          </h2>
          <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Step 39: Turn engineering risks and investigation findings into trackable remediation workflows.
          </p>
        </div>

        {/* Export & Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading}
            onClick={fetchActions}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh Actions'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !summary}
            onClick={() => handleExport('json')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'json' ? 'Exporting...' : '📄 Export JSON'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !summary}
            onClick={() => handleExport('markdown')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'markdown' ? 'Exporting...' : '📝 Export MD'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !summary}
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

      {actionMessage && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#064e3b', border: '1px solid #10b981', borderRadius: '6px', color: '#a7f3d0', fontSize: '0.85rem' }}>
          ✅ {actionMessage}
        </div>
      )}

      {/* Hero KPI Summary */}
      {summary && (
        <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', textAlign: 'center' }}>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Tracked Actions</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.2rem' }}>{summary.total_actions}</div>
            </div>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Open Actions</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: summary.open_actions > 0 ? '#ef4444' : '#22c55e', marginTop: '0.2rem' }}>{summary.open_actions}</div>
            </div>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>P0 Critical Actions</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: summary.p0_count > 0 ? '#ef4444' : '#22c55e', marginTop: '0.2rem' }}>{summary.p0_count}</div>
            </div>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Resolution Rate</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#22c55e', marginTop: '0.2rem' }}>{summary.resolution_rate}%</div>
            </div>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Verification Rate</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#a855f7', marginTop: '0.2rem' }}>{summary.verification_rate}%</div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION B & C: STATUS & PRIORITY SUMMARY CARDS */}
      {summary && (
        <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {/* Status Breakdown */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase' }}>Action Status Breakdown</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ background: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px', textAlign: 'center', flex: 1 }}>
                <span style={{ fontSize: '0.7rem', color: '#fca5a5' }}>OPEN</span>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#ef4444' }}>{summary.open_actions}</div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px', textAlign: 'center', flex: 1 }}>
                <span style={{ fontSize: '0.7rem', color: '#93c5fd' }}>IN_PROGRESS</span>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#3b82f6' }}>{summary.in_progress_actions}</div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px', textAlign: 'center', flex: 1 }}>
                <span style={{ fontSize: '0.7rem', color: '#bef264' }}>RESOLVED</span>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#84cc16' }}>{summary.resolved_actions}</div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px', textAlign: 'center', flex: 1 }}>
                <span style={{ fontSize: '0.7rem', color: '#6ee7b7' }}>VERIFIED</span>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#10b981' }}>{summary.verified_actions}</div>
              </div>
            </div>
          </div>

          {/* Priority Breakdown */}
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase' }}>Priority Breakdown</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ background: '#7f1d1d', padding: '0.5rem 0.8rem', borderRadius: '6px', textAlign: 'center', flex: 1, color: '#fca5a5' }}>
                <span style={{ fontSize: '0.7rem' }}>P0 Critical</span>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{summary.p0_count}</div>
              </div>
              <div style={{ background: '#431407', padding: '0.5rem 0.8rem', borderRadius: '6px', textAlign: 'center', flex: 1, color: '#fdba74' }}>
                <span style={{ fontSize: '0.7rem' }}>P1 High</span>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{summary.p1_count}</div>
              </div>
              <div style={{ background: '#365314', padding: '0.5rem 0.8rem', borderRadius: '6px', textAlign: 'center', flex: 1, color: '#bef264' }}>
                <span style={{ fontSize: '0.7rem' }}>P2 Medium</span>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{summary.p2_count}</div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.5rem 0.8rem', borderRadius: '6px', textAlign: 'center', flex: 1, color: '#94a3b8' }}>
                <span style={{ fontSize: '0.7rem' }}>P3 Low</span>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{summary.p3_count}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION D: ACTION TABLE */}
      {summary && summary.actions.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.75rem' }}>📋 Remediation Action Queue</h3>
          <div style={{ overflowX: 'auto', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', background: '#0f172a' }}>
                  <th style={{ padding: '0.75rem' }}>Priority</th>
                  <th style={{ padding: '0.75rem' }}>Action Title</th>
                  <th style={{ padding: '0.75rem' }}>Category</th>
                  <th style={{ padding: '0.75rem' }}>Risk Score</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>Verification</th>
                  <th style={{ padding: '0.75rem' }}>Workflow Actions</th>
                </tr>
              </thead>
              <tbody>
                {summary.actions.map((act: EngineeringAction) => {
                  const prioStyle = getPriorityStyle(act.priority);
                  const statStyle = getStatusStyle(act.status);
                  const isSelected = selectedAction?.action_id === act.action_id;

                  return (
                    <tr
                      key={act.action_id}
                      onClick={() => setSelectedAction(act)}
                      style={{
                        borderBottom: '1px solid #0f172a',
                        background: isSelected ? '#1e293b' : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', background: prioStyle.bg, color: prioStyle.text, fontWeight: 'bold', fontSize: '0.75rem' }}>
                          {act.priority}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#f8fafc' }}>
                        {act.title}
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'normal' }}>
                          ID: <code style={{ color: '#38bdf8' }}>{act.action_id}</code> | Source: {act.source}
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>{act.category}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>{act.risk_score}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '4px', background: statStyle.bg, color: statStyle.text, fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {act.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.75rem', color: act.verification_status === 'VERIFIED' ? '#22c55e' : '#eab308' }}>
                        {act.verification_status}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
                          {onInvestigate && (
                            <button
                              type="button"
                              onClick={() => onInvestigate(act.source_reference || act.title, 'RISK_ITEM')}
                              style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Investigate
                            </button>
                          )}
                          {act.status === 'OPEN' && (
                            <button
                              type="button"
                              onClick={() => handleTransition(act.action_id, 'IN_PROGRESS')}
                              style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#1d4ed8', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Start
                            </button>
                          )}
                          {act.status === 'IN_PROGRESS' && (
                            <button
                              type="button"
                              onClick={() => handleTransition(act.action_id, 'RESOLVED')}
                              style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#15803d', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Resolve
                            </button>
                          )}
                          {act.status === 'RESOLVED' && (
                            <button
                              type="button"
                              onClick={() => handleVerify(act.action_id)}
                              style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#7c3aed', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Verify
                            </button>
                          )}
                          {act.status === 'VERIFIED' && (
                            <button
                              type="button"
                              onClick={() => handleTransition(act.action_id, 'CLOSED')}
                              style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem', background: '#334155', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Close
                            </button>
                          )}
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

      {/* SECTION E & F: ACTION DETAILS & VISUAL REMEDIATION WORKFLOW STEPPER */}
      {selectedAction && (
        <div style={{ marginTop: '1.75rem', background: '#1e293b', border: '1px solid #38bdf8', borderRadius: '10px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                Action Inspector [{selectedAction.action_id}]
              </span>
              <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.3rem', color: '#38bdf8' }}>
                {selectedAction.title}
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', background: getPriorityStyle(selectedAction.priority).bg, color: getPriorityStyle(selectedAction.priority).text, fontWeight: 'bold', fontSize: '0.8rem' }}>
                {selectedAction.priority}
              </span>
              <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', background: getStatusStyle(selectedAction.status).bg, color: getStatusStyle(selectedAction.status).text, fontWeight: 'bold', fontSize: '0.8rem' }}>
                {selectedAction.status}
              </span>
            </div>
          </div>

          {/* SECTION F: VISUAL REMEDIATION WORKFLOW STEPPER */}
          <div style={{ marginBottom: '1.25rem', background: '#0f172a', padding: '0.85rem 1rem', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.5rem' }}>Remediation Workflow Progress</span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', overflowX: 'auto' }}>
              {workflowSteps.map((step, idx) => {
                const isCurrent = selectedAction.status === step;
                const isPassed = workflowSteps.indexOf(selectedAction.status) > idx;

                let stepBg = '#1e293b';
                let stepColor = '#64748b';
                if (isCurrent) {
                  stepBg = '#0284c7';
                  stepColor = '#ffffff';
                } else if (isPassed) {
                  stepBg = '#064e3b';
                  stepColor = '#a7f3d0';
                }

                return (
                  <React.Fragment key={step}>
                    <div style={{ background: stepBg, color: stepColor, padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                      {idx + 1}. {step}
                    </div>
                    {idx < workflowSteps.length - 1 && (
                      <div style={{ flex: 1, height: '2px', background: isPassed ? '#10b981' : '#334155', minWidth: '15px' }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Remediation Details */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
              <strong style={{ color: '#ef4444', display: 'block', marginBottom: '0.3rem' }}>❗ Problem:</strong>
              <p style={{ margin: 0, color: '#e2e8f0' }}>{selectedAction.remediation_details?.problem}</p>
            </div>
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
              <strong style={{ color: '#eab308', display: 'block', marginBottom: '0.3rem' }}>⚠️ Why It Matters:</strong>
              <p style={{ margin: 0, color: '#e2e8f0' }}>{selectedAction.remediation_details?.why_it_matters}</p>
            </div>
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
              <strong style={{ color: '#22c55e', display: 'block', marginBottom: '0.3rem' }}>👉 Recommended Remediation:</strong>
              <p style={{ margin: 0, color: '#e2e8f0' }}>{selectedAction.remediation_details?.recommended_remediation}</p>
            </div>
            <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px' }}>
              <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '0.3rem' }}>🔍 Verification Criteria:</strong>
              <p style={{ margin: 0, color: '#e2e8f0' }}>{selectedAction.remediation_details?.verification_criteria}</p>
            </div>
          </div>

          {/* Affected Files & History */}
          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', fontSize: '0.8rem' }}>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>Affected Files:</span>
              <ul style={{ margin: '0.3rem 0 0 1.2rem', padding: 0, color: '#38bdf8', fontFamily: 'monospace' }}>
                {selectedAction.affected_files.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>Action Audit History:</span>
              <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {selectedAction.history.map((h: ActionHistoryItem, i: number) => (
                  <div key={i} style={{ color: '#cbd5e1' }}>
                    <code>{h.from_status} → {h.to_status}</code>: {h.reason}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION G: TOP REMEDIATION HIGHLIGHTS */}
      {summary && (
        <div style={{ marginTop: '1.75rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#f8fafc', margin: '0 0 0.9rem 0' }}>💡 Remediation Governance Highlights</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>Highest Priority Unresolved</span>
              <strong style={{ color: '#ef4444', fontSize: '1rem' }}>{summary.highest_priority_action}</strong>
            </div>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>Most Common Category</span>
              <strong style={{ color: '#38bdf8', fontSize: '1rem' }}>{summary.most_common_category}</strong>
            </div>
            <div style={{ background: '#0f172a', padding: '0.8rem', borderRadius: '6px' }}>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>Most Common Risk Issue</span>
              <strong style={{ color: '#eab308', fontSize: '0.85rem' }}>{summary.most_common_issue}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
