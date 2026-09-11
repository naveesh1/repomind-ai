import React, { useState, useEffect } from 'react';
import type { SmartTestSelectionResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface SmartTestSelectionProps {
  repositoryUrl: string;
  initialPrId?: string;
  initialTargetFile?: string;
  initialTargetFunction?: string;
  onNavigateTab?: (tab: string) => void;
}

export const SmartTestSelection: React.FC<SmartTestSelectionProps> = ({
  repositoryUrl,
  initialPrId = '',
  initialTargetFile = '',
  initialTargetFunction = '',
  onNavigateTab: _onNavigateTab,
}) => {
  const [prId, setPrId] = useState<string>(initialPrId);
  const [targetFile, setTargetFile] = useState<string>(initialTargetFile);
  const [targetFunction, _setTargetFunction] = useState<string>(initialTargetFunction);

  const [data, setData] = useState<SmartTestSelectionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [showOmitted, setShowOmitted] = useState<boolean>(false);

  const fetchSelection = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/smart-test-selection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'key_dev_secret_789',
        },
        body: JSON.stringify({
          repository_url: repositoryUrl,
          pr_id: prId || undefined,
          changed_file: targetFile || undefined,
          changed_function: targetFunction || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `Server error HTTP ${res.status}`);
      }

      const json: SmartTestSelectionResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate smart test selection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryUrl) {
      fetchSelection();
    }
  }, [repositoryUrl]);

  const handleCopyCommand = () => {
    if (!data?.pytest_command) return;
    navigator.clipboard.writeText(data.pytest_command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async (format: 'json' | 'markdown' | 'shell') => {
    if (!data) return;
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/smart-test-selection/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'key_dev_secret_789',
        },
        body: JSON.stringify({
          selection_data: data,
          export_format: format,
        }),
      });

      if (!res.ok) throw new Error(`Export HTTP ${res.status}`);

      const exportRes = await res.json();

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(exportRes.data || data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = exportRes.filename || 'smart_test_selection.json';
        link.click();
      } else {
        const mime = format === 'shell' ? 'text/x-shellscript' : 'text/markdown';
        const blob = new Blob([exportRes.content || ''], { type: mime });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = exportRes.filename || (format === 'shell' ? 'pytest_selection.sh' : 'smart_test_selection.md');
        link.click();
      }
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  const getTierColor = (tierOrder: number) => {
    switch (tierOrder) {
      case 1:
        return '#f43f5e'; // Critical Red
      case 2:
        return '#f59e0b'; // High Amber
      default:
        return '#38bdf8'; // Secondary Blue
    }
  };

  return (
    <div style={{ padding: '1.5rem', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)', color: '#f8fafc', margin: '1.5rem 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🎯</span>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Smart Test Selection Engine
            </h2>
            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
              Step 46 Minimal Suite
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0 2.5rem', fontSize: '0.875rem', color: '#94a3b8' }}>
            Intelligent change-impact test selection identifying the smallest high-confidence unit test suite to run.
          </p>
        </div>

        {/* Change Context Bar */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={prId}
            onChange={(e) => setPrId(e.target.value)}
            placeholder="PR ID (e.g. pr-101)"
            style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem', width: '130px' }}
          />
          <input
            type="text"
            value={targetFile}
            onChange={(e) => setTargetFile(e.target.value)}
            placeholder="File (e.g. requests/api.py)"
            style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem', width: '180px' }}
          />
          <button
            onClick={() => fetchSelection()}
            disabled={loading}
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)', color: '#0f172a', border: 'none', fontWeight: 700, padding: '0.45rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            {loading ? 'Analyzing...' : 'Recalculate 🎯'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', color: '#fca5a5', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          ⚠️ {error}
        </div>
      )}

      {data && data.summary && (
        <>
          {/* Executive Reduction Metrics Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '1rem', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Test Suite Reduction</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', margin: '0.2rem 0' }}>
                {data.summary.test_reduction_percentage}%
              </div>
              <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                {data.summary.selected_test_count} selected of {data.summary.total_repository_tests} total tests
              </div>
            </div>

            <div style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', padding: '1rem', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Execution Time Saved</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#06b6d4', margin: '0.2rem 0' }}>
                ~{data.summary.estimated_time_saved_seconds}s
              </div>
              <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                Skipped {data.summary.omitted_test_count} unaffected test file(s)
              </div>
            </div>

            <div style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '1rem', borderRadius: '10px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Execution Tiers</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', background: '#f43f5e20', color: '#f43f5e', border: '1px solid #f43f5e40', fontWeight: 700 }}>
                  P0: {data.summary.tier_breakdown.tier_1_critical_p0}
                </span>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40', fontWeight: 700 }}>
                  P1: {data.summary.tier_breakdown.tier_2_high_p1}
                </span>
                <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', background: '#38bdf820', color: '#38bdf8', border: '1px solid #38bdf840', fontWeight: 700 }}>
                  P2: {data.summary.tier_breakdown.tier_3_secondary_p2}
                </span>
              </div>
            </div>
          </div>

          {/* Executable Pytest Command Box */}
          <div style={{ marginBottom: '1.5rem', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                ⚡ Executable Pytest Minimal Suite Command
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleCopyCommand}
                  style={{ background: copied ? '#22c55e' : 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                >
                  {copied ? '✓ Copied!' : '📋 Copy Command'}
                </button>
                <button
                  onClick={() => handleExport('shell')}
                  disabled={exporting === 'shell'}
                  style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  {exporting === 'shell' ? 'Exporting...' : '🐚 Export Script'}
                </button>
                <button
                  onClick={() => handleExport('markdown')}
                  disabled={exporting === 'markdown'}
                  style={{ background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  {exporting === 'markdown' ? 'Exporting...' : '📝 Export MD'}
                </button>
              </div>
            </div>
            <code style={{ display: 'block', background: 'rgba(15, 23, 42, 0.9)', color: '#38bdf8', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.9rem', fontFamily: 'monospace', overflowX: 'auto' }}>
              {data.pytest_command}
            </code>
          </div>

          {/* Ranked Minimal Test Suite */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#f1f5f9' }}>
              Ranked Test Execution Suite ({data.selected_tests.length} Selected Tests)
            </h3>

            {data.selected_tests.length === 0 ? (
              <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', color: '#94a3b8' }}>
                No unit tests required selection for the target changes.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {data.selected_tests.map((testItem, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: `1px solid ${getTierColor(testItem.tier_order)}40`,
                      borderLeft: `5px solid ${getTierColor(testItem.tier_order)}`,
                      borderRadius: '8px',
                      padding: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, background: `${getTierColor(testItem.tier_order)}20`, color: getTierColor(testItem.tier_order), border: `1px solid ${getTierColor(testItem.tier_order)}50` }}>
                          {testItem.execution_tier}
                        </span>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                          {testItem.test_file}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Confidence: <strong style={{ color: '#38bdf8' }}>{testItem.confidence}%</strong>
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          Impact: <strong style={{ color: '#e2e8f0' }}>{testItem.impact_type}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Dependency Trace Chain */}
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.4rem', background: 'rgba(0, 0, 0, 0.2)', padding: '0.4rem 0.6rem', borderRadius: '4px', fontFamily: 'monospace' }}>
                      🔗 <strong>Trace:</strong> {testItem.dependency_trace}
                    </div>

                    {/* Why Selected Justification */}
                    <div style={{ fontSize: '0.825rem', color: '#94a3b8' }}>
                      💡 <strong>Why Selected:</strong> {testItem.why_selected}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Omitted / Unaffected Tests Collapsible */}
          {data.omitted_tests && data.omitted_tests.length > 0 && (
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
              <button
                onClick={() => setShowOmitted(!showOmitted)}
                style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#94a3b8', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                {showOmitted ? '▼ Hide Omitted Tests' : `► View Omitted / Unaffected Tests (${data.omitted_tests.length})`}
              </button>

              {showOmitted && (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {data.omitted_tests.map((om, idx) => (
                    <div key={idx} style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <span style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{om.test_file}</span>
                      <span style={{ color: '#64748b' }}>{om.exclusion_reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
export default SmartTestSelection;
