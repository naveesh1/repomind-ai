import React, { useEffect, useState } from 'react';
import type { AnalyzeApiResponse, TestImpactRecord, TestImpactResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface TestImpactProps {
  repositoryUrl?: string;
  repoData?: AnalyzeApiResponse;
  initialChangedFile?: string;
  initialChangedFunc?: string;
}

export const TestImpact: React.FC<TestImpactProps> = ({
  repositoryUrl = '',
  repoData,
  initialChangedFile = '',
  initialChangedFunc = '',
}) => {
  const [changedFile, setChangedFile] = useState(
    initialChangedFile || (repoData?.python_files?.[0]?.file ?? 'src/requests/models.py')
  );
  const [changedFunc, setChangedFunc] = useState(initialChangedFunc);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [impactResult, setImpactResult] = useState<TestImpactResponse | null>(null);

  // Track expanded dependency paths by test row index
  const [expandedPaths, setExpandedPaths] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (initialChangedFile) {
      setChangedFile(initialChangedFile);
    }
    if (initialChangedFunc !== undefined) {
      setChangedFunc(initialChangedFunc);
    }
  }, [initialChangedFile, initialChangedFunc]);

  const handleAnalyzeTestImpact = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const url = repositoryUrl || repoData?.repository_url;
    if (!url) {
      setError('No repository analysis data available. Please analyze a repository first.');
      return;
    }

    if (!changedFile.trim()) {
      setError('Please enter a valid Changed File path.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/test-impact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository_url: url,
          changed_file: changedFile.trim(),
          changed_function: changedFunc.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to analyze test impact (HTTP ${response.status})`
        );
      }

      const data: TestImpactResponse = await response.json();
      setImpactResult(data);
      setExpandedPaths({});
    } catch (err: any) {
      setError(err.message || 'Failed to calculate test impact analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpandPath = (idx: number) => {
    setExpandedPaths((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
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

  const getConfidenceBadgeClass = (confidence: number = 0) => {
    if (confidence >= 85) return 'confidence-high';
    if (confidence >= 60) return 'confidence-medium';
    return 'confidence-low';
  };

  // Get full details for recommended tests ordered by priority & confidence
  const getRecommendedTestObjects = (): TestImpactRecord[] => {
    if (!impactResult) return [];
    return impactResult.affected_tests.filter(
      (t) => t.priority === 'P0' || t.priority === 'P1' || t.priority === 'P2' || t.priority === 'P3'
    );
  };

  return (
    <div className="test-impact-container">
      {/* Form Header */}
      <div className="sim-control-card">
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 className="section-title" style={{ fontSize: '1.2rem', margin: 0 }}>
            Test Impact & Execution Prioritization
          </h3>
          <p className="stats-subtext" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Static AST reference & dependency path analysis for intelligent test execution prioritization.
          </p>
        </div>

        <form onSubmit={handleAnalyzeTestImpact} className="sim-form">
          <div className="sim-form-grid">
            <div className="sim-form-group">
              <label className="sim-label">Changed File</label>
              <input
                type="text"
                className="sim-input mono"
                placeholder="e.g., src/requests/models.py"
                value={changedFile}
                onChange={(e) => setChangedFile(e.target.value)}
              />
            </div>

            <div className="sim-form-group">
              <label className="sim-label">Changed Function (optional)</label>
              <input
                type="text"
                className="sim-input mono"
                placeholder="e.g., Request or prepare_body"
                value={changedFunc}
                onChange={(e) => setChangedFunc(e.target.value)}
              />
            </div>
          </div>

          <div className="sim-submit-row">
            <button
              type="button"
              onClick={handleAnalyzeTestImpact}
              className="btn-primary btn-sim-submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span>Analyzing Test Impact...</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                  </svg>
                </>
              ) : (
                <>
                  <span>Analyze Test Impact</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
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

      {/* Analysis Results Display */}
      {impactResult && (
        <div
          className="change-results-wrapper"
          style={{
            opacity: isLoading ? 0.65 : 1,
            transition: 'opacity 0.2s ease',
            pointerEvents: isLoading ? 'none' : 'auto',
          }}
        >
          {/* Summary Metrics Grid (6 metrics) */}
          <div className="test-impact-summary-grid">
            <div className="health-stat-box">
              <span className="stat-num">{impactResult.total_tests}</span>
              <span className="stat-lbl">Total Tests</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num accent-imp">{impactResult.direct_tests}</span>
              <span className="stat-lbl">Direct</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num accent-purple">{impactResult.indirect_tests}</span>
              <span className="stat-lbl">Indirect</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num accent-cyan">{impactResult.possible_tests}</span>
              <span className="stat-lbl">Possible</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num font-emerald">
                {impactResult.recommended_count ?? impactResult.recommended_tests.length}
              </span>
              <span className="stat-lbl">Recommended</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num font-gold">
                {impactResult.high_confidence_count ??
                  impactResult.affected_tests.filter((t) => (t.confidence ?? 0) >= 70).length}
              </span>
              <span className="stat-lbl">High Confidence</span>
            </div>
          </div>

          {/* Potentially Affected Tests Table */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
              Potentially Affected Tests ({impactResult.affected_tests.length})
            </h4>

            {impactResult.affected_tests.length > 0 ? (
              <div className="high-impact-table-card">
                <div className="impact-table-header test-impact-table-grid">
                  <span>Test File</span>
                  <span>Priority</span>
                  <span>Impact</span>
                  <span>Confidence</span>
                  <span>Dependency Path</span>
                  <span>Reason</span>
                </div>
                <div className="impact-table-body">
                  {impactResult.affected_tests.map((testRec, idx) => {
                    const isExpanded = !!expandedPaths[idx];
                    const pathNodes = testRec.dependency_path || [testRec.test_file, impactResult.changed_file];

                    return (
                      <React.Fragment key={idx}>
                        <div className="impact-table-row test-impact-table-grid">
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

                          <span>
                            <button
                              type="button"
                              onClick={() => toggleExpandPath(idx)}
                              className="dep-path-toggle-btn"
                            >
                              <span>{pathNodes.length} nodes</span>
                              <svg
                                width="14"
                                height="14"
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
                            </button>
                          </span>

                          <span className="text-muted font-sm">{testRec.reason}</span>
                        </div>

                        {/* Collapsible Dependency Path Row */}
                        {isExpanded && (
                          <div className="dep-path-expanded-drawer">
                            <div className="dep-path-flow-title">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="16 18 22 12 16 6"></polyline>
                                <polyline points="8 6 2 12 8 18"></polyline>
                              </svg>
                              Full Dependency Path:
                            </div>
                            <div className="dep-path-chips-row">
                              {pathNodes.map((node, nIdx) => (
                                <React.Fragment key={nIdx}>
                                  <span className={`dep-path-chip ${nIdx === pathNodes.length - 1 ? 'target-chip' : ''}`}>
                                    {node}
                                  </span>
                                  {nIdx < pathNodes.length - 1 && (
                                    <span className="dep-path-arrow">→</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="exec-loading-card">
                <span>No unit test files found or affected in this repository.</span>
              </div>
            )}
          </div>

          {/* Recommended Tests to Run (Ordered by priority and confidence) */}
          {impactResult.recommended_tests.length > 0 && (
            <div className="exec-section">
              <h4 className="exec-section-title font-source">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 11 12 14 22 4"></polyline>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                Recommended Tests to Run (Ordered by Priority & Confidence)
              </h4>

              <div className="recommended-tests-grid">
                {getRecommendedTestObjects().map((testRec, index) => (
                  <div key={index} className="recommended-test-card">
                    <div className="rec-card-header">
                      <div className="rec-card-left">
                        <span className="rec-index-badge">{index + 1}</span>
                        <span className="mono rec-test-name">{testRec.test_file}</span>
                      </div>
                      <div className="rec-card-badges">
                        <span className={`badge ${getPriorityBadgeClass(testRec.priority)}`}>
                          {testRec.priority || 'P2'}
                        </span>
                        <span className={`confidence-pill ${getConfidenceBadgeClass(testRec.confidence)}`}>
                          {testRec.confidence ?? 70}%
                        </span>
                        <span className={`badge ${getImpactBadgeClass(testRec.impact_type)}`}>
                          {testRec.impact_type}
                        </span>
                      </div>
                    </div>
                    <div className="rec-card-body">
                      <p className="rec-reason-text">{testRec.reason}</p>
                      {testRec.dependency_path && testRec.dependency_path.length > 0 && (
                        <div className="rec-path-flow">
                          <span className="rec-path-lbl">Path:</span>
                          <span className="mono rec-path-str">
                            {testRec.dependency_path.join(' → ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <p className="stats-subtext" style={{ marginTop: '0.85rem', fontStyle: 'italic' }}>
                Note: Recommended test execution priorities (P0–P3) and confidence scores are computed via static AST reference and dependency graph analysis.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
