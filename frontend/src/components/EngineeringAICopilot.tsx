import React, { useState, useEffect } from 'react';
import type { CopilotQueryResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface EngineeringAICopilotProps {
  repositoryUrl: string;
  initialQuery?: string;
  initialPrId?: string;
  initialFilePath?: string;
  initialFunctionName?: string;
  onNavigateTab?: (tab: string) => void;
}

export const EngineeringAICopilot: React.FC<EngineeringAICopilotProps> = ({
  repositoryUrl,
  initialQuery = '',
  initialPrId = '',
  initialFilePath = '',
  initialFunctionName = '',
  onNavigateTab: _onNavigateTab,
}) => {
  const [query, setQuery] = useState<string>(initialQuery);
  const [prId, setPrId] = useState<string>(initialPrId);
  const [filePath, setFilePath] = useState<string>(initialFilePath);
  const [functionName, setFunctionName] = useState<string>(initialFunctionName);

  const [response, setResponse] = useState<CopilotQueryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // Sync props if passed from external tabs
  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
    if (initialPrId) setPrId(initialPrId);
    if (initialFilePath) setFilePath(initialFilePath);
    if (initialFunctionName) setFunctionName(initialFunctionName);
  }, [initialQuery, initialPrId, initialFilePath, initialFunctionName]);

  const handleQuery = async (customQuery?: string) => {
    const activeQuery = customQuery !== undefined ? customQuery : query;
    if (!activeQuery.trim()) {
      setError('Please enter a query for the Engineering AI Copilot.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/copilot/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'key_dev_secret_789',
        },
        body: JSON.stringify({
          query: activeQuery,
          repository_url: repositoryUrl,
          pr_id: prId || undefined,
          file_path: filePath || undefined,
          function_name: functionName || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `HTTP ${res.status}`);
      }

      const data: CopilotQueryResponse = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message || 'Failed to communicate with Engineering AI Copilot.');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetClick = (presetText: string) => {
    setQuery(presetText);
    handleQuery(presetText);
  };

  const handleFollowupClick = (followupText: string) => {
    setQuery(followupText);
    handleQuery(followupText);
  };

  const handleExport = async (format: 'json' | 'markdown') => {
    if (!response) return;
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/copilot/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'key_dev_secret_789',
        },
        body: JSON.stringify({
          copilot_result: response,
          export_format: format,
        }),
      });

      if (!res.ok) {
        throw new Error(`Export failed with status ${res.status}`);
      }

      const data = await res.json();

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data.data || response, null, 2)], {
          type: 'application/json',
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = data.filename || 'copilot_response.json';
        link.click();
      } else {
        const blob = new Blob([data.content || ''], { type: 'text/markdown' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = data.filename || 'copilot_response.md';
        link.click();
      }
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  const getIntentColor = (intent?: string) => {
    switch (intent) {
      case 'REPO_HEALTH':
        return '#00f2fe';
      case 'PR_RISK_AND_DECISION':
        return '#ff007f';
      case 'CODE_AND_IMPACT':
        return '#7928ca';
      case 'REMEDIATION_AND_ACTION':
        return '#ff4e50';
      default:
        return '#00c6ff';
    }
  };

  return (
    <div className="copilot-container" style={{ padding: '1.5rem', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)', color: '#f8fafc', margin: '1.5rem 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🤖</span>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Engineering AI Copilot
            </h2>
            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(79, 172, 254, 0.15)', color: '#4facfe', border: '1px solid rgba(79, 172, 254, 0.3)' }}>
              Step 45 SSoT Engine
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0 2.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>
            Repository-aware AI intelligence answering engineering queries, PR decisions, impact analysis, and audit trails.
          </p>
        </div>

        {/* User Context & Security Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Active Context:</span>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>
            usr_developer (DEVELOPER)
          </span>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', marginLeft: '0.25rem' }} title="RBAC Active & Enforced"></span>
        </div>
      </div>

      {/* Preset Query Chips */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          Sample Engineering Prompts
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            'What is the overall engineering health of this repository?',
            'Explain PR risk and release gate decision',
            'What is the downstream code & test impact of modifying file X?',
            'What active remediation actions exist?',
          ].map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handlePresetClick(preset)}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#e2e8f0',
                padding: '0.4rem 0.75rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#38bdf8';
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
              }}
            >
              💡 {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Context Parameters Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem', background: 'rgba(0, 0, 0, 0.2)', padding: '0.75rem', borderRadius: '8px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Target PR ID / Ref</label>
          <input
            type="text"
            value={prId}
            onChange={(e) => setPrId(e.target.value)}
            placeholder="e.g. pr-101 or HEAD"
            style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Target File Path</label>
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder="e.g. requests/api.py"
            style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Target Function Name</label>
          <input
            type="text"
            value={functionName}
            onChange={(e) => setFunctionName(e.target.value)}
            placeholder="e.g. get or request"
            style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Main Query Input */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask RepoMind Engineering AI Copilot anything about repo health, PR risk, AST changes, downstream impact, or remediation history..."
          rows={2}
          style={{ flex: 1, minWidth: '280px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(79, 172, 254, 0.3)', color: '#f8fafc', padding: '0.75rem', borderRadius: '8px', fontSize: '0.95rem', resize: 'vertical' }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            onClick={() => handleQuery()}
            disabled={loading}
            style={{
              background: loading ? '#475569' : 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              color: '#0f172a',
              border: 'none',
              fontWeight: 700,
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(79, 172, 254, 0.35)',
              fontSize: '0.9rem',
            }}
          >
            {loading ? 'Synthesizing...' : 'Ask Copilot 🚀'}
          </button>
          <button
            onClick={() => {
              setQuery('');
              setPrId('');
              setFilePath('');
              setFunctionName('');
              setResponse(null);
              setError(null);
            }}
            style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', padding: '0.35rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', color: '#fca5a5', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Response Panel */}
      {response && (
        <div style={{ background: 'rgba(15, 23, 42, 0.85)', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.12)', padding: '1.25rem' }}>
          {/* Response Metadata Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700, background: `${getIntentColor(response.intent)}20`, color: getIntentColor(response.intent), border: `1px solid ${getIntentColor(response.intent)}50` }}>
                INTENT: {response.intent}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Repo: {response.repository_url}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => handleExport('json')}
                disabled={exporting === 'json'}
                style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#e2e8f0', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                {exporting === 'json' ? 'Exporting...' : '📄 Export JSON'}
              </button>
              <button
                onClick={() => handleExport('markdown')}
                disabled={exporting === 'markdown'}
                style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#e2e8f0', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                {exporting === 'markdown' ? 'Exporting...' : '📝 Export Markdown'}
              </button>
            </div>
          </div>

          {/* Natural Language Answer Box */}
          <div style={{ marginBottom: '1.25rem', background: 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: '8px', borderLeft: `4px solid ${getIntentColor(response.intent)}` }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#f1f5f9' }}>Copilot Intelligence Answer</h3>
            <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.6', color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
              {response.answer}
            </p>
          </div>

          {/* Canonical Metrics Grid if present */}
          {response.canonical_metrics && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 600 }}>Canonical Intelligence Metrics</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Engineering Score</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>{response.canonical_metrics.overall_engineering_score}/100</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Regression Risk</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f43f5e' }}>{response.canonical_metrics.regression_risk}/100</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Governance Score</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#a855f7' }}>{response.canonical_metrics.governance_score}/100</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.6rem', borderRadius: '6px', textAlign: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Release Confidence</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#22c55e' }}>{response.canonical_metrics.release_confidence}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Supporting Evidence */}
          {response.evidence && response.evidence.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600 }}>Supporting Evidence & Facts</div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#cbd5e1', fontSize: '0.85rem' }}>
                {response.evidence.map((ev, idx) => (
                  <li key={idx} style={{ marginBottom: '0.25rem' }}>{ev}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Source Services */}
          {response.source_services && response.source_services.length > 0 && (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600 }}>Source Intelligence Engines (SSoT)</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {response.source_services.map((src, idx) => (
                  <span key={idx} style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#94a3b8', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    ⚙️ {src}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Follow-up Questions */}
          {response.suggested_followups && response.suggested_followups.length > 0 && (
            <div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 600 }}>Suggested Follow-up Questions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {response.suggested_followups.map((f, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleFollowupClick(f)}
                    style={{ textAlign: 'left', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.05)'; }}
                  >
                    ➡️ {f}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default EngineeringAICopilot;
