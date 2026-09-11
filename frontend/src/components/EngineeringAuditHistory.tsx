import React, { useState, useEffect } from 'react';
import type {
  EngineeringAuditHistoryResponse,
  AuditEventItem,
} from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface EngineeringAuditHistoryProps {
  repositoryUrl: string;
  onNavigateTab?: (tab: string) => void;
}

export const EngineeringAuditHistory: React.FC<EngineeringAuditHistoryProps> = ({
  repositoryUrl,
  onNavigateTab: _onNavigateTab,
}) => {
  const [data, setData] = useState<EngineeringAuditHistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // Filters & Inspector State
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [decisionFilter, setDecisionFilter] = useState<string>('ALL');
  const [riskLevelFilter, setRiskLevelFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<AuditEventItem | null>(null);

  const fetchAuditHistory = async (url?: string) => {
    setLoading(true);
    setError(null);
    try {
      const activeUrl = url !== undefined ? url : repositoryUrl;
      const queryParams = new URLSearchParams({ repository_url: activeUrl });
      const res = await fetch(`${API_BASE_URL}/api/engineering-audit-history?${queryParams.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned HTTP ${res.status}`);
      }
      const json: EngineeringAuditHistoryResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to load engineering audit history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryUrl) {
      fetchAuditHistory();
    }
  }, [repositoryUrl]);

  const handleExport = async (format: 'json' | 'markdown' | 'html') => {
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/engineering-audit-history/export`, {
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

      const exportRes = await res.json();

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(exportRes.data || exportRes, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportRes.filename || 'engineering_audit_history.json';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const textContent = exportRes.content || '';
        const mimeType = format === 'html' ? 'text/html' : 'text/markdown';
        const blob = new Blob([textContent], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportRes.filename || `engineering_audit_history.${format}`;
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
        <h3>Loading Engineering Audit History &amp; Decision Ledger...</h3>
        <p style={{ color: 'var(--text-secondary)' }}>Synthesizing deterministic audit chain across Steps 11–40...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ borderLeft: '4px solid #ef4444', padding: '20px' }}>
        <h3 style={{ color: '#ef4444' }}>Audit History Load Failure</h3>
        <p>{error}</p>
        <button type="button" className="btn btn-secondary" onClick={() => fetchAuditHistory()} style={{ marginTop: '12px' }}>
          Retry Load
        </button>
      </div>
    );
  }

  if (!data) return null;

  const overview = data.audit_overview || {};
  const metrics = data.metric_comparison || {};
  const events = data.audit_events || [];
  const decisions = data.decisions || [];

  // Filter events
  let filteredEvents = events.filter((e) => {
    if (eventTypeFilter !== 'ALL' && e.event_type !== eventTypeFilter) return false;
    if (riskLevelFilter === 'HIGH' && e.risk_score < 70) return false;
    if (riskLevelFilter === 'MEDIUM' && (e.risk_score < 40 || e.risk_score >= 70)) return false;
    if (riskLevelFilter === 'LOW' && e.risk_score >= 40) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        e.event_id.toLowerCase().includes(term) ||
        e.event_type.toLowerCase().includes(term) ||
        e.target.toLowerCase().includes(term) ||
        e.explanation.toLowerCase().includes(term) ||
        e.source_step.toLowerCase().includes(term)
      );
    }
    return true;
  });

  if (sortOrder === 'oldest') {
    filteredEvents = [...filteredEvents].reverse();
  }

  // Filter decisions
  const filteredDecisions = decisions.filter((d) => {
    if (decisionFilter !== 'ALL' && d.decision !== decisionFilter) return false;
    return true;
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'REPOSITORY_ANALYZED': return '🟢';
      case 'RISK_DETECTED': return '🟠';
      case 'INVESTIGATION_STARTED': return '🔍';
      case 'INVESTIGATION_COMPLETED': return '🔎';
      case 'ACTION_CREATED': return '🛠️';
      case 'ACTION_STARTED': return '🔵';
      case 'ACTION_RESOLVED': return '⚡';
      case 'ACTION_VERIFIED': return '✅';
      case 'ACTION_CLOSED': return '🔒';
      case 'RELEASE_APPROVED': return '🚀';
      case 'RELEASE_CONDITIONAL': return '⚠️';
      case 'RELEASE_BLOCKED': return '🚫';
      case 'GOVERNANCE_EVALUATED': return '📜';
      default: return '📊';
    }
  };

  const getOutcomeBadgeClass = (outcome: string) => {
    switch (outcome) {
      case 'SUCCESSFUL_REMEDIATION':
      case 'IMPROVED': return 'badge-success';
      case 'PARTIAL_REMEDIATION':
      case 'UNCHANGED': return 'badge-warning';
      case 'FAILED_REMEDIATION':
      case 'DETERIORATED': return 'badge-danger';
      default: return 'badge-info';
    }
  };

  return (
    <div className="engineering-audit-history">
      {/* Header & Export Actions */}
      <div className="card" style={{ borderLeft: '4px solid #38bdf8', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>📜 Engineering Decision &amp; Audit History Center</span>
            </h2>
            <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Deterministic audit ledger tracing engineering risk, investigation, action, verification, and release outcome.
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
      </div>

      {/* A. Audit Overview Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: '24px' }}>
        <div className="stat-box">
          <span className="stat-number">{overview.total_audit_events || 0}</span>
          <span className="stat-label">Audit Events</span>
        </div>
        <div className="stat-box">
          <span className="stat-number accent-source">{overview.open_decisions || 0}</span>
          <span className="stat-label">Open Decisions</span>
        </div>
        <div className="stat-box">
          <span className="stat-number accent-dir">{overview.completed_investigations || 0}</span>
          <span className="stat-label">Investigations</span>
        </div>
        <div className="stat-box">
          <span className="stat-number" style={{ color: '#f59e0b' }}>{overview.active_actions || 0}</span>
          <span className="stat-label">Active Actions</span>
        </div>
        <div className="stat-box">
          <span className="stat-number accent-test">{overview.verified_actions || 0}</span>
          <span className="stat-label">Verified Actions</span>
        </div>
        <div className="stat-box">
          <span className="stat-number" style={{ color: '#a855f7' }}>{overview.release_decisions || 0}</span>
          <span className="stat-label">Release Decisions</span>
        </div>
        <div className="stat-box">
          <span className="stat-number" style={{ color: '#10b981' }}>{overview.successful_remediations || 0}</span>
          <span className="stat-label">Successful Remediations</span>
        </div>
      </div>

      {/* D. Remediation Outcome & Metric Comparison */}
      <div className="card" style={{ marginBottom: '24px', background: 'var(--bg-card-secondary, #1e293b)' }}>
        <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📈 Metric Progression &amp; Outcome Classification</span>
          <span className={`badge ${getOutcomeBadgeClass(data.engineering_outcome)}`} style={{ fontSize: '0.8rem' }}>
            {data.engineering_outcome}
          </span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'var(--bg-main, #0f172a)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Regression Risk (Step 40 SSoT)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '4px 0', color: '#ef4444' }}>
              {metrics.current_risk_score !== undefined ? `${metrics.current_risk_score}/100` : 'N/A'}
            </div>
            <div style={{ fontSize: '0.75rem', color: metrics.risk_delta && metrics.risk_delta < 0 ? '#10b981' : '#f59e0b' }}>
              {metrics.previous_risk_score !== null ? (
                <>Previous: {metrics.previous_risk_score} | Delta: {metrics.risk_delta && metrics.risk_delta > 0 ? `+${metrics.risk_delta}` : metrics.risk_delta}</>
              ) : (
                'Status: NO_PREVIOUS_SNAPSHOT'
              )}
            </div>
          </div>

          <div style={{ background: 'var(--bg-main, #0f172a)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Governance Score</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '4px 0', color: '#38bdf8' }}>
              {metrics.current_governance_score !== undefined ? `${metrics.current_governance_score}/100` : 'N/A'}
            </div>
            <div style={{ fontSize: '0.75rem', color: metrics.governance_delta && metrics.governance_delta > 0 ? '#10b981' : 'var(--text-secondary)' }}>
              {metrics.previous_governance_score !== null ? (
                <>Previous: {metrics.previous_governance_score} | Delta: {metrics.governance_delta && metrics.governance_delta > 0 ? `+${metrics.governance_delta}` : metrics.governance_delta}</>
              ) : (
                'Status: NO_PREVIOUS_SNAPSHOT'
              )}
            </div>
          </div>

          <div style={{ background: 'var(--bg-main, #0f172a)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Overall Engineering Score</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: '4px 0', color: '#a855f7' }}>
              {metrics.current_engineering_score !== undefined ? `${metrics.current_engineering_score}/100` : 'N/A'}
            </div>
            <div style={{ fontSize: '0.75rem', color: metrics.engineering_delta && metrics.engineering_delta > 0 ? '#10b981' : 'var(--text-secondary)' }}>
              {metrics.previous_engineering_score !== null ? (
                <>Previous: {metrics.previous_engineering_score} | Delta: {metrics.engineering_delta && metrics.engineering_delta > 0 ? `+${metrics.engineering_delta}` : metrics.engineering_delta}</>
              ) : (
                'Status: NO_PREVIOUS_SNAPSHOT'
              )}
            </div>
          </div>

          <div style={{ background: 'var(--bg-main, #0f172a)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color, #334155)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Release Gate Status</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '4px 0', color: data.release_status === 'APPROVED_FOR_RELEASE' ? '#10b981' : '#f59e0b' }}>
              {data.release_status}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Outcome: <span className={`badge ${getOutcomeBadgeClass(metrics.outcome || 'NO_PREVIOUS_SNAPSHOT')}`}>{metrics.outcome || 'NO_PREVIOUS_SNAPSHOT'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* F. Filters & Controls Bar */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Search Audit Events
            </label>
            <input
              type="text"
              placeholder="Search by ID, target, step, text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #334155)',
                background: 'var(--bg-main, #0f172a)',
                color: '#fff',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Event Type
            </label>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #334155)',
                background: 'var(--bg-main, #0f172a)',
                color: '#fff',
              }}
            >
              <option value="ALL">All Event Types ({events.length})</option>
              <option value="REPOSITORY_ANALYZED">REPOSITORY_ANALYZED</option>
              <option value="RISK_DETECTED">RISK_DETECTED</option>
              <option value="INVESTIGATION_STARTED">INVESTIGATION_STARTED</option>
              <option value="INVESTIGATION_COMPLETED">INVESTIGATION_COMPLETED</option>
              <option value="ACTION_CREATED">ACTION_CREATED</option>
              <option value="ACTION_STARTED">ACTION_STARTED</option>
              <option value="ACTION_RESOLVED">ACTION_RESOLVED</option>
              <option value="ACTION_VERIFIED">ACTION_VERIFIED</option>
              <option value="ACTION_CLOSED">ACTION_CLOSED</option>
              <option value="RELEASE_EVALUATED">RELEASE_EVALUATED</option>
              <option value="RELEASE_APPROVED">RELEASE_APPROVED</option>
              <option value="GOVERNANCE_EVALUATED">GOVERNANCE_EVALUATED</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Risk Level
            </label>
            <select
              value={riskLevelFilter}
              onChange={(e) => setRiskLevelFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #334155)',
                background: 'var(--bg-main, #0f172a)',
                color: '#fff',
              }}
            >
              <option value="ALL">All Risk Levels</option>
              <option value="HIGH">High Risk (&gt;= 70)</option>
              <option value="MEDIUM">Medium Risk (40–69)</option>
              <option value="LOW">Low Risk (&lt; 40)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Order
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #334155)',
                background: 'var(--bg-main, #0f172a)',
                color: '#fff',
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* B. Engineering Decision Timeline */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⏳ Engineering Audit Timeline ({filteredEvents.length})</span>
        </h3>

        {filteredEvents.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No audit events match selected filter criteria.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredEvents.map((evt) => (
              <div
                key={evt.event_id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 16px',
                  background: 'var(--bg-main, #0f172a)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color, #334155)',
                }}
              >
                <div style={{ fontSize: '1.4rem', lineHeight: '1.2' }}>{getEventIcon(evt.event_type)}</div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontWeight: 'bold', color: '#f8fafc', fontSize: '0.95rem' }}>
                      {evt.event_type}
                    </span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span className="badge" style={{ background: '#334155', color: '#94a3b8', fontSize: '0.75rem' }}>
                        {evt.source_step}
                      </span>
                      <span className="badge" style={{ background: evt.risk_score >= 70 ? '#ef4444' : evt.risk_score >= 40 ? '#f59e0b' : '#10b981', color: '#fff', fontSize: '0.75rem' }}>
                        Risk: {evt.risk_score}
                      </span>
                    </div>
                  </div>

                  <p style={{ margin: '4px 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {evt.explanation}
                  </p>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span>Target: <code style={{ color: '#a855f7' }}>{evt.target}</code></span>
                    <span>Event ID: <code style={{ color: '#38bdf8' }}>{evt.event_id}</code></span>
                    {evt.action_id && <span>Action ID: <code>{evt.action_id}</code></span>}
                    {evt.investigation_id && <span>Inv ID: <code>{evt.investigation_id}</code></span>}
                    <span>Timestamp: {evt.timestamp}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  onClick={() => setSelectedEvent(evt)}
                >
                  Inspect
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* C. Decision History Table */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0 }}>📋 Engineering Decision Ledger ({filteredDecisions.length})</h3>

          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #334155)',
                background: 'var(--bg-main, #0f172a)',
                color: '#fff',
                fontSize: '0.8rem',
              }}
            >
              <option value="ALL">All Decisions ({decisions.length})</option>
              <option value="INVESTIGATE">INVESTIGATE</option>
              <option value="START_REMEDIATION">START_REMEDIATION</option>
              <option value="CONTINUE_REMEDIATION">CONTINUE_REMEDIATION</option>
              <option value="VERIFY">VERIFY</option>
              <option value="APPROVE_RELEASE">APPROVE_RELEASE</option>
              <option value="CONDITIONAL_RELEASE">CONDITIONAL_RELEASE</option>
              <option value="BLOCK_RELEASE">BLOCK_RELEASE</option>
              <option value="CLOSE_ACTION">CLOSE_ACTION</option>
            </select>
          </div>
        </div>

        {filteredDecisions.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No engineering decisions recorded.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main, #0f172a)', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>Decision</th>
                  <th style={{ padding: '10px' }}>Reason / Rationale</th>
                  <th style={{ padding: '10px' }}>Risk</th>
                  <th style={{ padding: '10px' }}>Related Action / Inv</th>
                  <th style={{ padding: '10px' }}>Release Status</th>
                  <th style={{ padding: '10px' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredDecisions.map((dec) => (
                  <tr key={dec.decision_id} style={{ borderBottom: '1px solid var(--border-color, #334155)' }}>
                    <td style={{ padding: '10px' }}>
                      <span className="badge" style={{ background: '#10b981', color: '#fff', fontWeight: 'bold' }}>
                        {dec.decision}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontSize: '0.85rem' }}>{dec.reason}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: dec.risk_score >= 70 ? '#ef4444' : '#10b981' }}>
                      {dec.risk_score}
                    </td>
                    <td style={{ padding: '10px', fontSize: '0.8rem' }}>
                      {dec.related_action ? (
                        <code style={{ color: '#38bdf8' }}>{dec.related_action}</code>
                      ) : dec.related_investigation ? (
                        <code style={{ color: '#a855f7' }}>{dec.related_investigation}</code>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td style={{ padding: '10px', fontSize: '0.8rem' }}>{dec.release_status}</td>
                    <td style={{ padding: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{dec.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* E. Audit Event Inspector Modal */}
      {selectedEvent && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '650px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#1e293b',
              border: '1px solid #38bdf8',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#38bdf8' }}>🔎 Audit Event Inspector</h3>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px 8px' }}
                onClick={() => setSelectedEvent(null)}
              >
                ✕ Close
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
              <div><strong>Event ID:</strong> <code style={{ color: '#38bdf8' }}>{selectedEvent.event_id}</code></div>
              <div><strong>Event Type:</strong> <code>{selectedEvent.event_type}</code></div>
              <div><strong>Repository:</strong> {selectedEvent.repository_name}</div>
              <div><strong>Source Step:</strong> {selectedEvent.source_step}</div>
              <div><strong>Target:</strong> <code>{selectedEvent.target}</code></div>
              <div><strong>Target Type:</strong> {selectedEvent.target_type}</div>
              <div><strong>Risk Score:</strong> {selectedEvent.risk_score}</div>
              <div><strong>Governance Score:</strong> {selectedEvent.governance_score}</div>
              <div><strong>Engineering Score:</strong> {selectedEvent.engineering_score}</div>
              <div><strong>Release Status:</strong> {selectedEvent.release_status}</div>
              <div><strong>Related Action ID:</strong> {selectedEvent.action_id || 'N/A'}</div>
              <div><strong>Related Inv ID:</strong> {selectedEvent.investigation_id || 'N/A'}</div>
              <div><strong>Previous State:</strong> {selectedEvent.previous_state || 'N/A'}</div>
              <div><strong>New State:</strong> {selectedEvent.new_state || 'N/A'}</div>
              <div><strong>Verification Status:</strong> {selectedEvent.verification_status}</div>
              <div><strong>Timestamp:</strong> {selectedEvent.timestamp}</div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <strong>Explanation:</strong>
              <p style={{ background: '#0f172a', padding: '10px', borderRadius: '6px', marginTop: '4px', fontSize: '0.85rem' }}>
                {selectedEvent.explanation}
              </p>
            </div>

            {selectedEvent.evidence && (
              <div style={{ marginTop: '16px' }}>
                <strong>Evidence &amp; Artifact References:</strong>
                <pre style={{ background: '#0f172a', padding: '10px', borderRadius: '6px', fontSize: '0.8rem', overflowX: 'auto', marginTop: '4px' }}>
                  {JSON.stringify(selectedEvent.evidence, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
