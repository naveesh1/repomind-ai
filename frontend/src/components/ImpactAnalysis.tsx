import React, { useState, useEffect } from 'react';
import type { PythonFileInfo, ImpactAnalysisApiRequest, ImpactAnalysisApiResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface ImpactAnalysisProps {
  repositoryUrl: string;
  pythonFiles?: PythonFileInfo[];
  initialFile?: string;
  initialFunction?: string;
  onTriggerTestImpact?: (file: string, func?: string) => void;
}

export const ImpactAnalysis: React.FC<ImpactAnalysisProps> = ({
  repositoryUrl,
  pythonFiles = [],
  initialFile = '',
  initialFunction = '',
  onTriggerTestImpact,
}) => {
  const [changedFile, setChangedFile] = useState(initialFile);
  const [changedFunction, setChangedFunction] = useState(initialFunction);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImpactAnalysisApiResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'direct' | 'transitive'>('direct');

  // Update selection if initialFile changes
  useEffect(() => {
    if (initialFile) {
      setChangedFile(initialFile);
    }
    if (initialFunction !== undefined) {
      setChangedFunction(initialFunction);
    }
  }, [initialFile, initialFunction]);

  // Find functions available for the selected file
  const selectedFileObj = pythonFiles.find(
    (f) => f.file === changedFile || f.file.toLowerCase() === changedFile.toLowerCase()
  );
  const availableFunctions = selectedFileObj ? selectedFileObj.functions : [];

  const handleAnalyzeImpact = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = changedFile.trim();
    if (!file) {
      setError('Please select or enter a Python file to analyze impact.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const payload: ImpactAnalysisApiRequest = {
        repository_url: repositoryUrl,
        changed_file: file,
        changed_function: changedFunction.trim() || undefined,
      };

      const response = await fetch(`${API_BASE_URL}/api/impact-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned error status ${response.status}`);
      }

      const data: ImpactAnalysisApiResponse = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to execute impact analysis.');
    } finally {
      setIsAnalyzing(false);
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
    <div className="impact-analysis-container">
      <div className="impact-form-card">
        <div className="impact-header">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          <div>
            <h3 className="impact-title">Change Impact Analysis &amp; Risk Engine</h3>
            <p className="impact-subtitle">Simulate code modifications to predict regression blast radius &amp; risk score.</p>
          </div>
        </div>

        <form onSubmit={handleAnalyzeImpact} className="impact-inputs-grid">
          {/* Changed File Select / Input */}
          <div className="form-field">
            <label className="field-label">
              <span>Target Changed File</span>
              <span className="field-required">*</span>
            </label>
            <div className="field-input-wrapper">
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
                list="python-files-options"
              />
              <datalist id="python-files-options">
                {pythonFiles.map((f) => (
                  <option key={f.file} value={f.file} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Changed Function Select / Input */}
          <div className="form-field">
            <label className="field-label">
              <span>Target Changed Function</span>
              <span className="field-optional">(Optional)</span>
            </label>
            <div className="field-input-wrapper">
              <input
                type="text"
                className="form-input"
                placeholder="e.g. prepare_url"
                value={changedFunction}
                onChange={(e) => {
                  setChangedFunction(e.target.value);
                  setError(null);
                }}
                list="functions-options"
              />
              <datalist id="functions-options">
                {availableFunctions.map((fn) => (
                  <option key={fn} value={fn} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Submit Button */}
          <div className="impact-btn-wrapper" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="submit" className="btn-impact-submit" disabled={isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <span>Calculating Risk...</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                  </svg>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                  <span>Analyze Impact</span>
                </>
              )}
            </button>

            {onTriggerTestImpact && changedFile && (
              <button
                type="button"
                className="btn-impact-action"
                style={{ padding: '0.65rem 1.25rem', fontSize: '0.85rem' }}
                onClick={() => onTriggerTestImpact(changedFile, changedFunction || undefined)}
              >
                Analyze Test Impact
              </button>
            )}
          </div>

        </form>

        {error && (
          <div className="form-feedback feedback-error impact-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Impact Analysis Results */}
      {result && (
        <div className="impact-results-card">
          {/* Header Score Strip */}
          <div className="risk-score-header">
            <div className="score-circle-wrapper">
              <div className={`score-badge ${getRiskLevelBadgeClass(result.risk_level)}`}>
                <span className="score-value">{result.risk_score}</span>
                <span className="score-denom">/100</span>
              </div>
            </div>

            <div className="risk-level-meta">
              <div className="level-badge-row">
                <span className={`risk-level-tag ${getRiskLevelBadgeClass(result.risk_level)}`}>
                  {result.risk_level} RISK
                </span>
                <span className="target-file-tag">
                  Target: <strong>{result.changed_file}</strong>
                  {result.changed_function && <span> &rarr; <code>{result.changed_function}()</code></span>}
                </span>
              </div>
              <p className="risk-reason-text">{result.reason}</p>
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

          {/* Impacted File Lists Tabs */}
          <div className="impact-file-lists-section">
            <div className="impact-tabs-row">
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
                className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All Impacted Files ({result.impacted_file_count})
              </button>
            </div>

            <div className="impact-files-display">
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
                        {isTarget && <span className="dep-type-badge target">Changed Source</span>}
                        {isDirect && <span className="dep-type-badge direct">Direct</span>}
                        {isTransitive && <span className="dep-type-badge transitive">Transitive</span>}
                        {!isTarget && !isDirect && !isTransitive && (
                          <span className="dep-type-badge forward">Dependency</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
