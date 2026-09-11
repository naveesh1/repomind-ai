import React, { useState, useEffect } from 'react';
import type { PythonFileInfo, SimulateChangeApiRequest, SimulateChangeApiResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface ChangeSimulationProps {
  repositoryUrl?: string;
  pythonFiles?: PythonFileInfo[];
  initialFile?: string;
  initialFunction?: string;
}

export const ChangeSimulation: React.FC<ChangeSimulationProps> = ({
  repositoryUrl: initialRepoUrl = '',
  pythonFiles = [],
  initialFile = '',
  initialFunction = '',
}) => {
  const [repoUrl, setRepoUrl] = useState(initialRepoUrl);
  const [changedFile, setChangedFile] = useState(initialFile);
  const [changedFunction, setChangedFunction] = useState(initialFunction);
  const [changeDescription, setChangeDescription] = useState('');
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulateChangeApiResponse | null>(null);
  
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'transitive' | 'tests'>('all');
  const [isFileListCollapsed, setIsFileListCollapsed] = useState(false);

  useEffect(() => {
    if (initialRepoUrl) {
      setRepoUrl(initialRepoUrl);
    }
  }, [initialRepoUrl]);

  useEffect(() => {
    if (initialFile) {
      setChangedFile(initialFile);
    }
  }, [initialFile]);

  useEffect(() => {
    if (initialFunction) {
      setChangedFunction(initialFunction);
    }
  }, [initialFunction]);

  // Find functions available for the selected file
  const selectedFileObj = pythonFiles.find(
    (f) => f.file === changedFile || f.file.toLowerCase() === changedFile.toLowerCase()
  );
  const availableFunctions = selectedFileObj ? selectedFileObj.functions : [];

  const handleSimulateChange = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = repoUrl.trim();
    const file = changedFile.trim();

    if (!url) {
      setError('Please provide a valid GitHub repository URL.');
      return;
    }

    if (!file) {
      setError('Please specify the target changed file.');
      return;
    }

    setIsSimulating(true);
    setError(null);
    setResult(null);

    try {
      const payload: SimulateChangeApiRequest = {
        repository_url: url,
        changed_file: file,
        changed_function: changedFunction.trim() || undefined,
        change_description: changeDescription.trim() || undefined,
      };

      const response = await fetch(`${API_BASE_URL}/api/simulate-change`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned status code ${response.status}`);
      }

      const data: SimulateChangeApiResponse = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to complete code change simulation.');
    } finally {
      setIsSimulating(false);
    }
  };

  const getRiskLevelBadgeClass = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'risk-level-critical';
      case 'HIGH':
        return 'risk-level-high';
      case 'MEDIUM':
        return 'risk-level-medium';
      default:
        return 'risk-level-low';
    }
  };

  return (
    <div className="change-simulation-container">
      {/* Input Card */}
      <div className="sim-form-card">
        <div className="sim-header">
          <div className="sim-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <div>
            <h3 className="sim-title">Code Change Simulation &amp; Impact Engine</h3>
            <p className="sim-subtitle">
              Simulate proposed modifications to evaluate regression risk, affected tests, and review recommendations without modifying code.
            </p>
          </div>
        </div>

        <form onSubmit={handleSimulateChange} className="sim-form">
          <div className="sim-grid">
            {/* Repository URL */}
            <div className="form-field full-width">
              <label className="field-label">
                <span>Repository URL</span>
                <span className="field-required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="https://github.com/owner/repository"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  setError(null);
                }}
              />
            </div>

            {/* Changed File */}
            <div className="form-field">
              <label className="field-label">
                <span>Changed File</span>
                <span className="field-required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. src/requests/models.py"
                value={changedFile}
                onChange={(e) => {
                  setChangedFile(e.target.value);
                  setChangedFunction('');
                  setError(null);
                }}
                list="sim-python-files"
              />
              <datalist id="sim-python-files">
                {pythonFiles.map((f) => (
                  <option key={f.file} value={f.file} />
                ))}
              </datalist>
            </div>

            {/* Changed Function */}
            <div className="form-field">
              <label className="field-label">
                <span>Changed Function</span>
                <span className="field-optional">(Optional)</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. prepare_url"
                value={changedFunction}
                onChange={(e) => {
                  setChangedFunction(e.target.value);
                  setError(null);
                }}
                list="sim-functions"
              />
              <datalist id="sim-functions">
                {availableFunctions.map((fn) => (
                  <option key={fn} value={fn} />
                ))}
              </datalist>
            </div>

            {/* Change Description */}
            <div className="form-field full-width">
              <label className="field-label">
                <span>Change Description</span>
                <span className="field-optional">(Optional)</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Refactor URL validation logic and default parameter handling"
                value={changeDescription}
                onChange={(e) => setChangeDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="sim-actions">
            <button type="submit" className="btn-sim-submit" disabled={isSimulating}>
              {isSimulating ? (
                <>
                  <span>Simulating Change...</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                  </svg>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                  <span>Simulate Change</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="form-feedback feedback-error sim-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Simulation Results Card */}
      {result && (
        <div className="sim-results-card">
          {/* Header & Risk Score Banner */}
          <div className="sim-banner">
            <div className="sim-banner-left">
              <div className={`score-badge ${getRiskLevelBadgeClass(result.risk_level)}`}>
                <span className="score-value">{result.risk_score}</span>
                <span className="score-denom">/100</span>
              </div>
              <div className="banner-risk-info">
                <div className="banner-tag-row">
                  <span className={`risk-level-tag ${getRiskLevelBadgeClass(result.risk_level)}`}>
                    {result.risk_level} RISK
                  </span>
                  <span className="target-file-tag">
                    Target: <strong>{result.changed_file}</strong>
                    {result.changed_function && (
                      <span> &rarr; <code>{result.changed_function}()</code></span>
                    )}
                  </span>
                </div>
                {result.change_description && (
                  <p className="sim-desc-text">
                    <em>Description:</em> &quot;{result.change_description}&quot;
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Change Summary Box */}
          <div className="sim-section sim-summary-section">
            <h4 className="sim-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Change Summary
            </h4>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="sum-label">Changed File</span>
                <span className="sum-value mono">{result.changed_file}</span>
              </div>
              <div className="summary-item">
                <span className="sum-label">Changed Function</span>
                <span className="sum-value mono">{result.changed_function || 'Whole File'}</span>
              </div>
              <div className="summary-item">
                <span className="sum-label">Risk Score</span>
                <span className="sum-value font-bold">{result.risk_score} / 100</span>
              </div>
              <div className="summary-item">
                <span className="sum-label">Risk Level</span>
                <span className={`sum-value ${getRiskLevelBadgeClass(result.risk_level)}`}>
                  {result.risk_level}
                </span>
              </div>
            </div>
          </div>

          {/* Overall Narrative Summary */}
          <div className="sim-narrative-box">
            <div className="narrative-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </div>
            <div className="narrative-content">
              <h5 className="narrative-title">Overall Summary</h5>
              <p className="narrative-text">{result.summary}</p>
            </div>
          </div>

          {/* Impact Quick Stats Grid */}
          <div className="impact-stats-grid">
            <div className="impact-stat-box">
              <span className="stat-number">{result.impacted_file_count}</span>
              <span className="stat-label">Total Impacted Files</span>
            </div>
            <div className="impact-stat-box">
              <span className="stat-number accent-source">{result.direct_dependents.length}</span>
              <span className="stat-label">Direct Dependents</span>
            </div>
            <div className="impact-stat-box">
              <span className="stat-number accent-test">{result.transitive_dependents.length}</span>
              <span className="stat-label">Transitive Dependents</span>
            </div>
            <div className="impact-stat-box">
              <span className="stat-number accent-dir">{result.affected_tests.length}</span>
              <span className="stat-label">Affected Test Files</span>
            </div>
          </div>

          {/* Tests to Review Section */}
          <div className="sim-section">
            <h4 className="sim-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <path d="M9 15l2 2 4-4"></path>
              </svg>
              Tests to Review ({result.affected_tests.length})
            </h4>
            {result.affected_tests.length > 0 ? (
              <div className="tests-list">
                {result.affected_tests.map((testFile, idx) => (
                  <div key={`${testFile}-${idx}`} className="test-row">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span className="test-file-path">{testFile}</span>
                    <span className="test-badge">May Need Review/Execution</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-files-msg">
                No test files detected in the impacted file set. Standard regression tests should still be run.
              </div>
            )}
          </div>

          {/* Review Recommendations Section */}
          <div className="sim-section">
            <h4 className="sim-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 11 12 14 22 4"></polyline>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
              </svg>
              Developer Review Recommendations
            </h4>
            <div className="recommendations-list">
              {result.review_recommendations.map((rec, idx) => (
                <div key={idx} className="recommendation-item">
                  <span className="rec-bullet">&bull;</span>
                  <span className="rec-text">{rec}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Impacted File List Details (Expandable & Tabbed) */}
          <div className="sim-section">
            <div className="collapsible-section-header">
              <h4 className="sim-section-title mb-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                Detailed Impacted Files Breakdown ({result.impacted_file_count})
              </h4>
              <button
                type="button"
                className="btn-toggle-collapse"
                onClick={() => setIsFileListCollapsed(!isFileListCollapsed)}
              >
                {isFileListCollapsed ? 'Expand List' : 'Collapse List'}
              </button>
            </div>

            {!isFileListCollapsed && (
              <div className="impact-file-lists-section">
                <div className="impact-tabs-row">
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    All Impacted Files ({result.impacted_file_count})
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'direct' ? 'active' : ''}`}
                    onClick={() => setActiveTab('direct')}
                  >
                    Direct Dependents ({result.direct_dependents.length})
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'transitive' ? 'active' : ''}`}
                    onClick={() => setActiveTab('transitive')}
                  >
                    Transitive Dependents ({result.transitive_dependents.length})
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'tests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tests')}
                  >
                    Affected Tests ({result.affected_tests.length})
                  </button>
                </div>

                <div className="impact-files-display">
                  {activeTab === 'all' && (
                    <div className="files-list">
                      {result.impacted_files.map((f, i) => {
                        const isDirect = result.direct_dependents.includes(f);
                        const isTransitive = result.transitive_dependents.includes(f);
                        const isTarget = f === result.changed_file;
                        const isTest = result.affected_tests.includes(f);

                        return (
                          <div key={`${f}-${i}`} className={`impact-file-row ${isTarget ? 'target-row' : ''}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <span className="file-name">{f}</span>
                            {isTarget && <span className="dep-type-badge target">Changed Source</span>}
                            {isDirect && <span className="dep-type-badge direct">Direct Dependent</span>}
                            {isTransitive && <span className="dep-type-badge transitive">Transitive Dependent</span>}
                            {isTest && <span className="dep-type-badge test-badge-small">Test File</span>}
                            {!isTarget && !isDirect && !isTransitive && !isTest && (
                              <span className="dep-type-badge forward">Dependency</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeTab === 'direct' && (
                    <div className="files-list">
                      {result.direct_dependents.length === 0 ? (
                        <span className="empty-files-msg">No direct dependent files found.</span>
                      ) : (
                        result.direct_dependents.map((f, i) => (
                          <div key={`${f}-${i}`} className="impact-file-row direct-row">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                            <span className="file-name">{f}</span>
                            <span className="dep-type-badge direct">Direct</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === 'transitive' && (
                    <div className="files-list">
                      {result.transitive_dependents.length === 0 ? (
                        <span className="empty-files-msg">No transitive dependent files found.</span>
                      ) : (
                        result.transitive_dependents.map((f, i) => (
                          <div key={`${f}-${i}`} className="impact-file-row transitive-row">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="13 17 18 12 13 7"></polyline>
                              <polyline points="6 17 11 12 6 7"></polyline>
                            </svg>
                            <span className="file-name">{f}</span>
                            <span className="dep-type-badge transitive">Transitive</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === 'tests' && (
                    <div className="files-list">
                      {result.affected_tests.length === 0 ? (
                        <span className="empty-files-msg">No affected test files found.</span>
                      ) : (
                        result.affected_tests.map((f, i) => (
                          <div key={`${f}-${i}`} className="impact-file-row">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                              <polyline points="22 4 12 14.01 9 11.01"></polyline>
                            </svg>
                            <span className="file-name">{f}</span>
                            <span className="dep-type-badge test-badge-small">Test</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
