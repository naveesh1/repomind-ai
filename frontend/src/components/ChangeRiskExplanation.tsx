import React, { useEffect, useState } from 'react';
import type { AnalyzeApiResponse, ChangeRiskExplanationResponse, ChangeRiskFactorRecord } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface ChangeRiskExplanationProps {
  repositoryUrl?: string;
  repoData?: AnalyzeApiResponse;
  initialChangedFile?: string;
  initialChangedFunc?: string;
}

export const ChangeRiskExplanation: React.FC<ChangeRiskExplanationProps> = ({
  repositoryUrl = '',
  repoData,
  initialChangedFile = '',
  initialChangedFunc = '',
}) => {
  const [targetFile, setTargetFile] = useState(
    initialChangedFile || (repoData?.python_files?.[0]?.file ?? 'src/requests/models.py')
  );
  const [targetFunc, setTargetFunc] = useState(initialChangedFunc);
  const [proposedChange, setProposedChange] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanationResult, setExplanationResult] = useState<ChangeRiskExplanationResponse | null>(null);

  // State tracking expanded risk factor IDs
  const [expandedRiskFactors, setExpandedRiskFactors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialChangedFile) {
      setTargetFile(initialChangedFile);
    }
    if (initialChangedFunc !== undefined) {
      setTargetFunc(initialChangedFunc);
    }
  }, [initialChangedFile, initialChangedFunc]);

  const fetchRiskExplanation = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const url = repositoryUrl || repoData?.repository_url;
    if (!url) {
      setError('No repository analysis data available. Please analyze a repository first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/change-risk-explanation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository_url: url,
          changed_file: targetFile.trim() || undefined,
          changed_function: targetFunc.trim() || undefined,
          proposed_change: proposedChange.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to generate change risk explanation (HTTP ${response.status})`
        );
      }

      const data: ChangeRiskExplanationResponse = await response.json();
      setExplanationResult(data);

      // Expand all risk factors by default
      const initExpanded: Record<string, boolean> = {};
      data.top_risk_factors.forEach((rf) => {
        initExpanded[rf.id] = true;
      });
      setExpandedRiskFactors(initExpanded);
    } catch (err: any) {
      setError(err.message || 'Failed to generate change risk explanation.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskExplanation();
  }, []);

  const toggleRiskFactorExpand = (id: string) => {
    setExpandedRiskFactors((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getRiskLevelBadgeClass = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'risk-level-critical';
      case 'HIGH':
        return 'risk-level-high';
      case 'MEDIUM':
        return 'risk-level-medium';
      case 'LOW':
        return 'risk-level-low';
      default:
        return 'risk-level-medium';
    }
  };

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'badge-priority-p0';
      case 'HIGH':
        return 'badge-priority-p1';
      case 'MEDIUM':
        return 'badge-priority-p2';
      case 'LOW':
        return 'badge-priority-p3';
      default:
        return 'badge-priority-p2';
    }
  };

  return (
    <div className="change-risk-explanation-container">
      {/* Control Card */}
      <div className="sim-control-card">
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
            Change Risk Explanation Engine
          </h3>
          <p className="stats-subtext" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Intelligent risk narrative synthesizer combining AST analysis, dependency radius, test impact classification (P0-P3), and regression risk scoring.
          </p>
        </div>

        <form onSubmit={fetchRiskExplanation} className="sim-form">
          <div className="sim-form-grid">
            <div className="sim-form-group">
              <label className="sim-label">Target File</label>
              <input
                type="text"
                className="sim-input mono"
                placeholder="e.g., src/requests/models.py"
                value={targetFile}
                onChange={(e) => setTargetFile(e.target.value)}
              />
            </div>

            <div className="sim-form-group">
              <label className="sim-label">Target Function (optional)</label>
              <input
                type="text"
                className="sim-input mono"
                placeholder="e.g., Request or prepare_body"
                value={targetFunc}
                onChange={(e) => setTargetFunc(e.target.value)}
              />
            </div>
          </div>

          <div className="sim-form-group" style={{ marginTop: '1rem' }}>
            <label className="sim-label">Proposed Code Modification (optional)</label>
            <input
              type="text"
              className="sim-input mono"
              placeholder="e.g., Refactor header validation logic in prepare_headers"
              value={proposedChange}
              onChange={(e) => setProposedChange(e.target.value)}
            />
          </div>

          <div className="sim-submit-row">
            <button
              type="button"
              onClick={fetchRiskExplanation}
              className="btn-primary btn-sim-submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span>Synthesizing Risk Explanation...</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                  </svg>
                </>
              ) : (
                <>
                  <span>Explain Change Risk</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="form-feedback feedback-error exec-error-card">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Output Results */}
      {explanationResult && (
        <div
          className="change-results-wrapper"
          style={{
            opacity: isLoading ? 0.65 : 1,
            transition: 'opacity 0.2s ease',
            pointerEvents: isLoading ? 'none' : 'auto',
          }}
        >
          {/* Header Score & Executive Summary Banner */}
          <div className="quality-score-card">
            <div className="quality-banner-top">
              <div className="quality-gauge-group">
                <div className="score-badge">
                  <span className="score-value">{explanationResult.score}</span>
                  <span className="score-denom">/ 100</span>
                </div>
                <div className="gauge-track-wrapper">
                  <div className="health-gauge-bar">
                    <div
                      className="health-gauge-fill"
                      style={{
                        width: `${explanationResult.score}%`,
                        backgroundColor:
                          explanationResult.level === 'CRITICAL'
                            ? '#f87171'
                            : explanationResult.level === 'HIGH'
                            ? '#fb923c'
                            : explanationResult.level === 'MEDIUM'
                            ? '#facc15'
                            : '#34d399',
                      }}
                    ></div>
                  </div>
                  <div className="health-range-labels">
                    <span>0 (Low Risk)</span>
                    <span>50 (High Risk)</span>
                    <span>100 (Critical)</span>
                  </div>
                </div>
              </div>

              <div className="quality-repo-meta">
                <div className="meta-title-row">
                  <span className={`health-level-tag ${getRiskLevelBadgeClass(explanationResult.level)}`}>
                    {explanationResult.level} RISK
                  </span>
                  <span className="health-repo-name">{explanationResult.target_file}</span>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <span className="font-bold text-light" style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    Executive Narrative
                  </span>
                  <p className="health-score-desc" style={{ fontSize: '0.9rem', lineHeight: '1.45' }}>
                    {explanationResult.executive_summary}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Why This Change Is Risky (Technical Explanation) */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              Why This Change Is Risky (Technical Analysis)
            </h4>

            <div className="executive-card" style={{ padding: '1.25rem' }}>
              <pre className="expl-text-content" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0, fontSize: '0.9rem', lineHeight: '1.55' }}>
                {explanationResult.risk_explanation}
              </pre>
            </div>
          </div>

          {/* Expandable Top Risk Factors */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              Top Risk Factors ({explanationResult.top_risk_factors.length})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {explanationResult.top_risk_factors.map((factor: ChangeRiskFactorRecord) => {
                const isExpanded = !!expandedRiskFactors[factor.id];
                return (
                  <div
                    key={factor.id}
                    className="risk-factor-expandable-card"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      onClick={() => toggleRiskFactorExpand(factor.id)}
                      style={{
                        padding: '0.85rem 1.15rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={`badge ${getSeverityBadgeClass(factor.severity)}`}>
                          {factor.severity}
                        </span>
                        <span className="font-bold text-light" style={{ fontSize: '0.95rem' }}>
                          {factor.title}
                        </span>
                        <span className="badge badge-impact-possible" style={{ fontSize: '0.75rem' }}>
                          {factor.category}
                        </span>
                      </div>

                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        style={{
                          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s ease',
                        }}
                      >
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </div>

                    <div style={{ padding: '0 1.15rem 0.85rem 1.15rem' }}>
                      <p className="stats-subtext" style={{ margin: 0, fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.85)' }}>
                        {factor.summary}
                      </p>

                      {isExpanded && (
                        <div
                          style={{
                            marginTop: '0.65rem',
                            paddingTop: '0.65rem',
                            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                            fontSize: '0.85rem',
                            color: 'rgba(255, 255, 255, 0.7)',
                            lineHeight: '1.5',
                          }}
                        >
                          {factor.details}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Affected Scope */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
              </svg>
              Affected Scope (Radius: {explanationResult.affected_scope.impact_radius} files)
            </h4>

            <div className="affected-scope-box">
              <div style={{ marginBottom: '0.75rem' }}>
                <span className="sum-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                  Impacted Files ({explanationResult.affected_scope.affected_files.length}):
                </span>
                <div className="chips-list-row">
                  {explanationResult.affected_scope.affected_files.map((file, idx) => (
                    <span key={idx} className="mono dep-path-chip">{file}</span>
                  ))}
                </div>
              </div>

              {explanationResult.affected_scope.affected_functions.length > 0 && (
                <div>
                  <span className="sum-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                    Affected Functions ({explanationResult.affected_scope.affected_functions.length}):
                  </span>
                  <div className="chips-list-row">
                    {explanationResult.affected_scope.affected_functions.map((fn, idx) => (
                      <span key={idx} className="mono dep-path-chip target-chip">{fn}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recommended Test Execution Order (P0 -> P1 -> P2 -> P3) */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
              Recommended Test Execution Roadmap (P0 &rarr; P1 &rarr; P2 &rarr; P3)
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* P0 Tests */}
              <div className="risk-factor-card">
                <div className="rf-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-priority-p0">P0</span>
                    <span className="rf-title">Direct Unit Tests (Immediate Local Execution)</span>
                  </div>
                  <span className="rf-val accent-imp">{explanationResult.categorized_tests.p0_tests.length}</span>
                </div>
                <div className="chips-list-row" style={{ marginTop: '0.5rem' }}>
                  {explanationResult.categorized_tests.p0_tests.length > 0 ? (
                    explanationResult.categorized_tests.p0_tests.map((tf, i) => (
                      <span key={i} className="mono dep-path-chip target-chip">{tf}</span>
                    ))
                  ) : (
                    <span className="stats-subtext">No P0 direct unit tests found.</span>
                  )}
                </div>
              </div>

              {/* P1 Tests */}
              <div className="risk-factor-card">
                <div className="rf-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-priority-p1">P1</span>
                    <span className="rf-title">Indirect Integration Tests (Required in CI Merge Pipeline)</span>
                  </div>
                  <span className="rf-val accent-purple">{explanationResult.categorized_tests.p1_tests.length}</span>
                </div>
                <div className="chips-list-row" style={{ marginTop: '0.5rem' }}>
                  {explanationResult.categorized_tests.p1_tests.length > 0 ? (
                    explanationResult.categorized_tests.p1_tests.map((tf, i) => (
                      <span key={i} className="mono dep-path-chip">{tf}</span>
                    ))
                  ) : (
                    <span className="stats-subtext">No P1 indirect integration tests found.</span>
                  )}
                </div>
              </div>

              {/* P2 Tests */}
              <div className="risk-factor-card">
                <div className="rf-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-priority-p2">P2</span>
                    <span className="rf-title">Transitive & Ripple Tests (Nightly Pipeline)</span>
                  </div>
                  <span className="rf-val accent-cyan">{explanationResult.categorized_tests.p2_tests.length}</span>
                </div>
                <div className="chips-list-row" style={{ marginTop: '0.5rem' }}>
                  {explanationResult.categorized_tests.p2_tests.length > 0 ? (
                    explanationResult.categorized_tests.p2_tests.map((tf, i) => (
                      <span key={i} className="mono dep-path-chip">{tf}</span>
                    ))
                  ) : (
                    <span className="stats-subtext">No P2 transitive tests found.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Engineering Actions */}
          <div className="exec-section">
            <h4 className="exec-section-title font-source">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 11 12 14 22 4"></polyline>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              Recommended Engineering Actions
            </h4>

            <div className="health-list">
              {explanationResult.recommendations.map((rec, idx) => (
                <div key={idx} className="health-list-item rec-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
