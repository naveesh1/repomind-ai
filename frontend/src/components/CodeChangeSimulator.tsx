import React, { useState, useEffect } from 'react';
import type { PythonFileInfo, CodeChangeSimulationResponse } from '../types';
import { ChangeExplanation } from './ChangeExplanation';


const API_BASE_URL = 'http://127.0.0.1:8000';

interface CodeChangeSimulatorProps {
  repositoryUrl?: string;
  pythonFiles?: PythonFileInfo[];
  initialFile?: string;
  initialFunction?: string;
}

export const CodeChangeSimulator: React.FC<CodeChangeSimulatorProps> = ({
  repositoryUrl = '',
  pythonFiles = [],
  initialFile = '',
  initialFunction = '',
}) => {
  const [changedFile, setChangedFile] = useState(initialFile);
  const [changedFunction, setChangedFunction] = useState(initialFunction);
  const [proposedChange, setProposedChange] = useState('');
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CodeChangeSimulationResponse | null>(null);

  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'transitive'>('all');
  const [isImpactListExpanded, setIsImpactListExpanded] = useState(true);

  useEffect(() => {
    if (initialFile) setChangedFile(initialFile);
  }, [initialFile]);

  useEffect(() => {
    if (initialFunction) setChangedFunction(initialFunction);
  }, [initialFunction]);

  // Find functions available for the selected file
  const selectedFileObj = pythonFiles.find(
    (f) => f.file === changedFile || f.file.toLowerCase() === changedFile.toLowerCase()
  );
  const availableFunctions = selectedFileObj ? selectedFileObj.functions : [];

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = changedFile.trim();

    if (!file) {
      setError('Please enter or select a target Python file to simulate.');
      return;
    }

    setIsSimulating(true);
    setError(null);
    setResult(null);

    try {
      const payload = {
        repository_url: repositoryUrl || undefined,
        changed_file: file,
        changed_function: changedFunction.trim() || undefined,
        proposed_change: proposedChange.trim() || undefined,
        change_description: proposedChange.trim() || undefined,
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

      const data: CodeChangeSimulationResponse = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to execute code change simulation.');
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

  const getRiskScoreColor = (score: number) => {
    if (score >= 75) return '#f87171'; // Critical (red)
    if (score >= 50) return '#fb923c'; // High (orange)
    if (score >= 25) return '#facc15'; // Medium (yellow)
    return '#34d399'; // Low (green)
  };

  return (
    <div className="code-change-simulator-container">
      {/* Simulation Input Form */}
      <div className="simulator-form-card">
        <div className="simulator-header">
          <div className="simulator-header-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 18l6-6-6-6"></path>
              <path d="M8 6l-6 6 6 6"></path>
            </svg>
          </div>
          <div>
            <h3 className="simulator-title">Step 16: Code Change Simulator (Dry-Run Preview)</h3>
            <p className="simulator-subtitle">
              Preview the potential blast radius, risk score, and regression impact of proposed code changes before applying them.
            </p>
          </div>
        </div>

        <form onSubmit={handleSimulate} className="simulator-form">
          <div className="simulator-inputs-grid">
            {/* Changed File Input */}
            <div className="form-field">
              <label className="field-label">
                <span>Target Changed File</span>
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
                list="ccs-python-files"
              />
              <datalist id="ccs-python-files">
                {pythonFiles.map((f) => (
                  <option key={f.file} value={f.file} />
                ))}
              </datalist>
            </div>

            {/* Changed Function Input */}
            <div className="form-field">
              <label className="field-label">
                <span>Target Changed Function</span>
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
                list="ccs-functions"
              />
              <datalist id="ccs-functions">
                {availableFunctions.map((fn) => (
                  <option key={fn} value={fn} />
                ))}
              </datalist>
            </div>

            {/* Proposed Change Textarea */}
            <div className="form-field full-width">
              <label className="field-label">
                <span>Proposed Code Change / Description</span>
                <span className="field-optional">(Optional)</span>
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="e.g. Modify URL preparation validation logic to strictly handle null parameters and scheme checking."
                value={proposedChange}
                onChange={(e) => setProposedChange(e.target.value)}
              />
            </div>
          </div>

          <div className="simulator-actions">
            <button type="submit" className="btn-simulator-submit" disabled={isSimulating}>
              {isSimulating ? (
                <>
                  <span>Simulating Dry-Run...</span>
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
          <div className="form-feedback feedback-error simulator-error">
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
        <div className="simulator-results-card">
          {/* Header Banner & Visual Risk Indicator */}
          <div className="simulator-score-banner">
            <div className="score-indicator-gauge">
              <div
                className={`score-badge ${getRiskLevelBadgeClass(result.risk_level)}`}
                style={{ borderColor: getRiskScoreColor(result.risk_score) }}
              >
                <span className="score-value">{result.risk_score}</span>
                <span className="score-denom">/100</span>
              </div>
              <div className="gauge-bar-track">
                <div
                  className="gauge-bar-fill"
                  style={{
                    width: `${result.risk_score}%`,
                    backgroundColor: getRiskScoreColor(result.risk_score),
                  }}
                />
              </div>
            </div>

            <div className="score-meta-details">
              <div className="risk-level-row">
                <span className={`risk-level-tag ${getRiskLevelBadgeClass(result.risk_level)}`}>
                  {result.risk_level} RISK
                </span>
                <span className="risk-score-range-label">
                  ({result.risk_score < 25 ? '0-24 LOW' : result.risk_score < 50 ? '25-49 MEDIUM' : result.risk_score < 75 ? '50-74 HIGH' : '75-100 CRITICAL'})
                </span>
              </div>

              <div className="target-specs">
                <span className="spec-label">Target File:</span>
                <span className="spec-value mono">{result.changed_file}</span>
                {result.changed_function && (
                  <>
                    <span className="spec-label ml-2">Function:</span>
                    <span className="spec-value mono"><code>{result.changed_function}()</code></span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Proposed Change Box (If specified) */}
          {(result.proposed_change || result.change_description) && (
            <div className="simulator-section">
              <h4 className="simulator-section-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                Proposed Code Change Preview
              </h4>
              <div className="proposed-change-box">
                <code>{result.proposed_change || result.change_description}</code>
              </div>
            </div>
          )}

          {/* Reason / Explanation Box */}
          <div className="simulator-reason-box">
            <div className="reason-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </div>
            <div className="reason-text-content">
              <h5 className="reason-title">Impact Explanation &amp; Reason</h5>
              <p className="reason-text">{result.reason || result.summary}</p>
            </div>
          </div>

          {/* Quick Metrics Grid */}
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
          </div>

          {/* Expandable/Collapsible Impacted Files Section */}
          <div className="simulator-section">
            <div className="collapsible-section-header">
              <h4 className="simulator-section-title mb-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                Impacted Files ({result.impacted_file_count})
              </h4>
              <button
                type="button"
                className="btn-toggle-collapse"
                onClick={() => setIsImpactListExpanded(!isImpactListExpanded)}
              >
                {isImpactListExpanded ? 'Collapse Files' : 'Expand Files'}
              </button>
            </div>

            {isImpactListExpanded && (
              <div className="impact-file-lists-section">
                <div className="impact-tabs-row">
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    All Impacted ({result.impacted_file_count})
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
                </div>

                <div className="impact-files-display">
                  {activeTab === 'all' && (
                    <div className="files-list">
                      {result.impacted_files.map((f, i) => {
                        const isDirect = result.direct_dependents.includes(f);
                        const isTransitive = result.transitive_dependents.includes(f);
                        const isTarget = f === result.changed_file;

                        return (
                          <div key={`${f}-${i}`} className={`impact-file-row ${isTarget ? 'target-row' : ''}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <span className="file-name">{f}</span>
                            {isTarget && <span className="dep-type-badge target">Target File</span>}
                            {isDirect && <span className="dep-type-badge direct">Direct Dependent</span>}
                            {isTransitive && <span className="dep-type-badge transitive">Transitive Dependent</span>}
                            {!isTarget && !isDirect && !isTransitive && (
                              <span className="dep-type-badge forward">Forward Dependency</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeTab === 'direct' && (
                    <div className="files-list">
                      {result.direct_dependents.length === 0 ? (
                        <span className="empty-files-msg">No direct dependent files.</span>
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
                        <span className="empty-files-msg">No transitive dependent files.</span>
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
                </div>
              </div>
            )}
          </div>

          {/* Step 17 AI-Powered Change Explanation Section */}
          <ChangeExplanation
            repositoryUrl={repositoryUrl}
            changedFile={result.changed_file}
            changedFunction={result.changed_function}
            proposedChange={result.proposed_change || result.change_description}
          />
        </div>
      )}
    </div>
  );
};
