import React, { useEffect, useState } from 'react';
import type { ActionItemRecord, AnalyzeApiResponse, ChangeDecisionResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface ChangeDecisionProps {
  repositoryUrl?: string;
  repoData?: AnalyzeApiResponse;
  initialChangedFile?: string;
  initialChangedFunc?: string;
}

export const ChangeDecision: React.FC<ChangeDecisionProps> = ({
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
  const [decisionResult, setDecisionResult] = useState<ChangeDecisionResponse | null>(null);

  useEffect(() => {
    if (initialChangedFile) {
      setTargetFile(initialChangedFile);
    }
    if (initialChangedFunc !== undefined) {
      setTargetFunc(initialChangedFunc);
    }
  }, [initialChangedFile, initialChangedFunc]);

  const fetchChangeDecision = async (e?: React.SyntheticEvent) => {
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
      const response = await fetch(`${API_BASE_URL}/api/change-decision`, {
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
          errorData.detail || `Failed to generate change decision (HTTP ${response.status})`
        );
      }

      const data: ChangeDecisionResponse = await response.json();
      setDecisionResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate change decision.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChangeDecision();
  }, []);

  const getDecisionBadgeClass = (decision: string) => {
    switch (decision) {
      case 'READY':
        return 'decision-ready';
      case 'READY WITH CAUTION':
        return 'decision-caution';
      case 'REVIEW REQUIRED':
        return 'decision-review';
      case 'BLOCKED':
        return 'decision-blocked';
      default:
        return 'decision-caution';
    }
  };

  const getPriorityBadgeClass = (prio: string) => {
    switch (prio) {
      case 'P0':
        return 'badge-priority-p0';
      case 'P1':
        return 'badge-priority-p1';
      case 'P2':
        return 'badge-priority-p2';
      case 'P3':
        return 'badge-priority-p3';
      default:
        return 'badge-priority-p2';
    }
  };

  return (
    <div className="change-decision-container">
      {/* Input Form Card */}
      <div className="sim-control-card">
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
            Intelligent Change Decision Engine (Step 27)
          </h3>
          <p className="stats-subtext" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Final decision synthesis layer combining risk scores, test execution roadmaps (P0–P3), impact radius, and blocker/warning rules to render a definitive merge decision.
          </p>
        </div>

        <form onSubmit={fetchChangeDecision} className="sim-form">
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
            <label className="sim-label">Proposed Modification Context (optional)</label>
            <input
              type="text"
              className="sim-input mono"
              placeholder="e.g., Refactor session connection pooling and header validation"
              value={proposedChange}
              onChange={(e) => setProposedChange(e.target.value)}
            />
          </div>

          <div className="sim-submit-row">
            <button
              type="button"
              onClick={fetchChangeDecision}
              className="btn-primary btn-sim-submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span>Evaluating Merge Decision...</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                  </svg>
                </>
              ) : (
                <>
                  <span>Evaluate Change Decision</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 11 12 14 22 4"></polyline>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
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

      {/* Decision Results Container */}
      {decisionResult && (
        <div
          className="change-results-wrapper"
          style={{
            opacity: isLoading ? 0.65 : 1,
            transition: 'opacity 0.2s ease',
            pointerEvents: isLoading ? 'none' : 'auto',
          }}
        >
          {/* Top Decision Header Banner */}
          <div className="quality-score-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span className={`decision-banner-tag ${getDecisionBadgeClass(decisionResult.decision)}`}>
                    MERGE DECISION: {decisionResult.decision}
                  </span>
                  <span
                    className={`readiness-tag ${
                      decisionResult.merge_readiness === 'READY' ? 'readiness-ok' : 'readiness-not-ok'
                    }`}
                  >
                    MERGE READINESS: {decisionResult.merge_readiness}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div className="score-badge" style={{ padding: '0.4rem 0.85rem' }}>
                    <span className="score-value" style={{ fontSize: '1.4rem' }}>{decisionResult.confidence_score}%</span>
                    <span className="score-denom" style={{ fontSize: '0.75rem' }}>Confidence</span>
                  </div>
                  <div className="score-badge" style={{ padding: '0.4rem 0.85rem' }}>
                    <span className="score-value" style={{ fontSize: '1.4rem' }}>{decisionResult.score}</span>
                    <span className="score-denom" style={{ fontSize: '0.75rem' }}>Risk Score ({decisionResult.level})</span>
                  </div>
                </div>
              </div>

              <div>
                <span className="font-bold text-light" style={{ display: 'block', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                  Decision Rationale for {decisionResult.target_file} {decisionResult.changed_function ? `(${decisionResult.changed_function})` : ''}
                </span>
                <p className="health-score-desc" style={{ fontSize: '0.92rem', lineHeight: '1.5', margin: 0 }}>
                  {decisionResult.decision_explanation}
                </p>
              </div>
            </div>
          </div>

          {/* Blockers Section (High Priority Alert) */}
          {decisionResult.blockers.length > 0 && (
            <div className="exec-section">
              <h4 className="exec-section-title" style={{ color: '#f87171' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                Merge Blockers ({decisionResult.blockers.length})
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {decisionResult.blockers.map((blocker, idx) => (
                  <div key={idx} className="blocker-card-item">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{blocker}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings Section */}
          {decisionResult.warnings.length > 0 && (
            <div className="exec-section">
              <h4 className="exec-section-title" style={{ color: '#facc15' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                Architectural &amp; Risk Warnings ({decisionResult.warnings.length})
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {decisionResult.warnings.map((warn, idx) => (
                  <div key={idx} className="warning-card-item">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Required Engineering Action Plan (Ordered by priority P0 -> P1 -> P2) */}
          <div className="exec-section">
            <h4 className="exec-section-title font-source">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 11 12 14 22 4"></polyline>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              Prioritized Required Actions ({decisionResult.required_actions.length})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {decisionResult.required_actions.map((act: ActionItemRecord, idx: number) => (
                <div key={idx} className="risk-factor-card" style={{ padding: '0.9rem 1.15rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span className={`badge ${getPriorityBadgeClass(act.priority)}`}>{act.priority}</span>
                      <span className="font-bold text-light" style={{ fontSize: '0.95rem' }}>{act.action}</span>
                    </div>
                  </div>
                  <p className="stats-subtext" style={{ margin: 0, fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                    {act.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Test Execution Roadmap (P0 -> P1 -> P2 -> P3) */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
              Recommended Test Execution Roadmap ({decisionResult.recommended_tests.length} tests)
            </h4>

            <div className="affected-scope-box" style={{ gap: '1rem' }}>
              <div>
                <span className="sum-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                  P0 Direct Unit Tests ({decisionResult.categorized_tests.p0_tests.length}):
                </span>
                <div className="chips-list-row">
                  {decisionResult.categorized_tests.p0_tests.length > 0 ? (
                    decisionResult.categorized_tests.p0_tests.map((t, i) => (
                      <span key={i} className="mono dep-path-chip target-chip">{t}</span>
                    ))
                  ) : (
                    <span className="stats-subtext">No P0 direct unit tests found.</span>
                  )}
                </div>
              </div>

              <div>
                <span className="sum-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                  P1 Indirect Integration Tests ({decisionResult.categorized_tests.p1_tests.length}):
                </span>
                <div className="chips-list-row">
                  {decisionResult.categorized_tests.p1_tests.length > 0 ? (
                    decisionResult.categorized_tests.p1_tests.map((t, i) => (
                      <span key={i} className="mono dep-path-chip">{t}</span>
                    ))
                  ) : (
                    <span className="stats-subtext">No P1 indirect integration tests found.</span>
                  )}
                </div>
              </div>

              {decisionResult.categorized_tests.p2_tests.length > 0 && (
                <div>
                  <span className="sum-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                    P2 Transitive Tests ({decisionResult.categorized_tests.p2_tests.length}):
                  </span>
                  <div className="chips-list-row">
                    {decisionResult.categorized_tests.p2_tests.map((t, i) => (
                      <span key={i} className="mono dep-path-chip">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Affected Scope Summary */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
              </svg>
              Affected Architectural Scope ({decisionResult.affected_scope.impact_radius} files)
            </h4>

            <div className="affected-scope-box">
              <span className="sum-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                Impacted Files:
              </span>
              <div className="chips-list-row">
                {decisionResult.affected_scope.affected_files.map((file, idx) => (
                  <span key={idx} className="mono dep-path-chip">{file}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
