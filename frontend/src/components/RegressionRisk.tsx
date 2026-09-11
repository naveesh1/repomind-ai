import React, { useEffect, useState } from 'react';
import type { AnalyzeApiResponse, RegressionRiskResponse, TestImpactRecord } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface RegressionRiskProps {
  repositoryUrl?: string;
  repoData?: AnalyzeApiResponse;
  initialChangedFile?: string;
  initialChangedFunc?: string;
}

export const RegressionRisk: React.FC<RegressionRiskProps> = ({
  repositoryUrl = '',
  repoData,
  initialChangedFile = '',
  initialChangedFunc = '',
}) => {
  const [targetFile, setTargetFile] = useState(
    initialChangedFile || (repoData?.python_files?.[0]?.file ?? 'src/requests/models.py')
  );
  const [targetFunc, setTargetFunc] = useState(initialChangedFunc);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [riskResult, setRiskResult] = useState<RegressionRiskResponse | null>(null);

  useEffect(() => {
    if (initialChangedFile) {
      setTargetFile(initialChangedFile);
    }
    if (initialChangedFunc !== undefined) {
      setTargetFunc(initialChangedFunc);
    }
  }, [initialChangedFile, initialChangedFunc]);

  const fetchRegressionRisk = async (e?: React.SyntheticEvent) => {
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
      const response = await fetch(`${API_BASE_URL}/api/regression-risk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository_url: url,
          changed_file: targetFile.trim() || undefined,
          changed_function: targetFunc.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to analyze regression risk (HTTP ${response.status})`
        );
      }

      const data: RegressionRiskResponse = await response.json();
      setRiskResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate regression risk analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRegressionRisk();
  }, []);

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

  const getPriorityBadgeClass = (priority?: string) => {
    switch (priority) {
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

  const getImpactBadgeClass = (impactType: string) => {
    switch (impactType) {
      case 'DIRECT':
        return 'badge-impact-direct';
      case 'INDIRECT':
        return 'badge-impact-indirect';
      case 'POSSIBLE':
        return 'badge-impact-possible';
      default:
        return 'badge-impact-possible';
    }
  };

  const getConfidenceBadgeClass = (confidence: number = 0) => {
    if (confidence >= 85) return 'confidence-high';
    if (confidence >= 60) return 'confidence-medium';
    return 'confidence-low';
  };

  return (
    <div className="regression-risk-container">
      {/* Input Control Card */}
      <div className="sim-control-card">
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
            Deterministic Regression Risk Analysis
          </h3>
          <p className="stats-subtext" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Multi-factor static analysis engine combining impact radius, AST complexity, dependency graph, and test execution priority.
          </p>
        </div>

        <form onSubmit={fetchRegressionRisk} className="sim-form">
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

          <div className="sim-submit-row">
            <button
              type="button"
              onClick={fetchRegressionRisk}
              className="btn-primary btn-sim-submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span>Calculating Risk...</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                  </svg>
                </>
              ) : (
                <>
                  <span>Analyze Regression Risk</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
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

      {/* Risk Results Display */}
      {riskResult && (
        <div
          className="change-results-wrapper"
          style={{
            opacity: isLoading ? 0.65 : 1,
            transition: 'opacity 0.2s ease',
            pointerEvents: isLoading ? 'none' : 'auto',
          }}
        >
          {/* Score Header Card */}
          <div className="quality-score-card">
            <div className="quality-banner-top">
              <div className="quality-gauge-group">
                <div className="score-badge">
                  <span className="score-value">{riskResult.score}</span>
                  <span className="score-denom">/ 100</span>
                </div>
                <div className="gauge-track-wrapper">
                  <div className="health-gauge-bar">
                    <div
                      className="health-gauge-fill"
                      style={{
                        width: `${riskResult.score}%`,
                        backgroundColor:
                          riskResult.level === 'CRITICAL'
                            ? '#f87171'
                            : riskResult.level === 'HIGH'
                            ? '#fb923c'
                            : riskResult.level === 'MEDIUM'
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
                  <span className={`health-level-tag ${getRiskLevelBadgeClass(riskResult.level)}`}>
                    {riskResult.level} RISK
                  </span>
                  <span className="health-repo-name">{riskResult.target_file}</span>
                </div>
                <p className="health-score-desc">{riskResult.explanation}</p>
              </div>
            </div>
          </div>

          {/* Risk Factor Cards */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                <line x1="6" y1="6" x2="6.01" y2="6"></line>
                <line x1="6" y1="18" x2="6.01" y2="18"></line>
              </svg>
              Quantitative Risk Factors
            </h4>

            <div className="risk-factors-grid">
              <div className="risk-factor-card">
                <div className="rf-header">
                  <span className="rf-title">Impact Radius</span>
                  <span className="rf-val accent-cyan">{riskResult.risk_factors.impact_radius}</span>
                </div>
                <p className="rf-desc">Affected files in reverse dependency path.</p>
              </div>

              <div className="risk-factor-card">
                <div className="rf-header">
                  <span className="rf-title">Direct Unit Tests</span>
                  <span className="rf-val accent-imp">{riskResult.direct_tests}</span>
                </div>
                <p className="rf-desc">Unit tests directly calling target AST symbols.</p>
              </div>

              <div className="risk-factor-card">
                <div className="rf-header">
                  <span className="rf-title">Indirect Unit Tests</span>
                  <span className="rf-val accent-purple">{riskResult.indirect_tests}</span>
                </div>
                <p className="rf-desc">Unit tests with transitive dependency path.</p>
              </div>

              <div className="risk-factor-card">
                <div className="rf-header">
                  <span className="rf-title">Complex Functions</span>
                  <span className="rf-val font-gold">{riskResult.risk_factors.complex_functions_count}</span>
                </div>
                <p className="rf-desc">Functions with cyclomatic complexity &ge; 5.</p>
              </div>
            </div>
          </div>

          {/* Affected Files & Affected Functions */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
              </svg>
              Affected Scope & Functions
            </h4>

            <div className="affected-scope-box">
              <div style={{ marginBottom: '0.75rem' }}>
                <span className="sum-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Affected Files ({riskResult.affected_files.length}):</span>
                <div className="chips-list-row">
                  {riskResult.affected_files.map((file, idx) => (
                    <span key={idx} className="mono dep-path-chip">{file}</span>
                  ))}
                </div>
              </div>

              {riskResult.affected_functions.length > 0 && (
                <div>
                  <span className="sum-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Affected Target Functions ({riskResult.affected_functions.length}):</span>
                  <div className="chips-list-row">
                    {riskResult.affected_functions.map((fn, idx) => (
                      <span key={idx} className="mono dep-path-chip target-chip">{fn}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Affected Tests Table with P0/P1/P2/P3 Priorities */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
              Affected Tests & Execution Priorities ({riskResult.affected_tests.length})
            </h4>

            {riskResult.affected_tests.length > 0 ? (
              <div className="high-impact-table-card">
                <div className="impact-table-header risk-table-grid">
                  <span>Test File</span>
                  <span>Priority</span>
                  <span>Impact</span>
                  <span>Confidence</span>
                  <span>Reason</span>
                </div>
                <div className="impact-table-body">
                  {riskResult.affected_tests.map((testRec: TestImpactRecord, idx: number) => (
                    <div key={idx} className="impact-table-row risk-table-grid">
                      <span className="file-name mono font-bold">{testRec.test_file}</span>
                      <span>
                        <span className={`badge ${getPriorityBadgeClass(testRec.priority)}`}>
                          {testRec.priority || 'P2'}
                        </span>
                      </span>
                      <span>
                        <span className={`badge ${getImpactBadgeClass(testRec.impact_type)}`}>
                          {testRec.impact_type}
                        </span>
                      </span>
                      <span>
                        <span className={`confidence-pill ${getConfidenceBadgeClass(testRec.confidence)}`}>
                          {testRec.confidence ?? 70}%
                        </span>
                      </span>
                      <span className="text-muted font-sm">{testRec.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="exec-loading-card">
                <span>No unit test files affected for this target.</span>
              </div>
            )}
          </div>

          {/* Recommended Actions */}
          <div className="exec-section">
            <h4 className="exec-section-title font-source">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 11 12 14 22 4"></polyline>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              Recommended Risk Mitigation Actions
            </h4>

            <div className="health-list">
              {riskResult.recommendations.map((rec, idx) => (
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
