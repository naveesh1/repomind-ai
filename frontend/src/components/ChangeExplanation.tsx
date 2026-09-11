import React, { useState } from 'react';
import type { ChangeExplanationApiRequest, ChangeExplanationResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface ChangeExplanationProps {
  repositoryUrl?: string;
  changedFile: string;
  changedFunction?: string;
  proposedChange?: string;
}

export const ChangeExplanation: React.FC<ChangeExplanationProps> = ({
  repositoryUrl = '',
  changedFile,
  changedFunction = '',
  proposedChange = '',
}) => {
  const [isExplaining, setIsExplaining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<ChangeExplanationResponse | null>(null);

  const handleFetchExplanation = async () => {
    if (!changedFile) {
      setError('A changed file must be specified to generate an explanation.');
      return;
    }

    setIsExplaining(true);
    setError(null);

    try {
      const payload: ChangeExplanationApiRequest = {
        repository_url: repositoryUrl || undefined,
        changed_file: changedFile,
        changed_function: changedFunction || undefined,
        proposed_change: proposedChange || undefined,
        change_description: proposedChange || undefined,
      };

      const response = await fetch(`${API_BASE_URL}/api/change-explanation`, {
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

      const data: ChangeExplanationResponse = await response.json();
      setExplanation(data);
    } catch (err: any) {
      setError(err.message || 'Failed to generate change explanation.');
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="change-explanation-wrapper">
      {!explanation && !isExplaining && (
        <div className="explain-trigger-card">
          <div className="explain-trigger-info">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z"></path>
              <path d="M12 12L2.5 7.5"></path>
              <path d="M12 12v10"></path>
            </svg>
            <div>
              <h5 className="trigger-title">Step 17: AI-Powered Code Change Explanation</h5>
              <p className="trigger-subtitle">
                Generate a comprehensive technical narrative explaining change blast radius, dependency risks, and recommended test suites.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-explain-change"
            onClick={handleFetchExplanation}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span>Explain Change</span>
          </button>
        </div>
      )}

      {isExplaining && (
        <div className="explain-loading-card">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
          </svg>
          <span>Analyzing AST graph &amp; generating AI-powered explanation...</span>
        </div>
      )}

      {error && (
        <div className="form-feedback feedback-error explain-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{error}</span>
          <button type="button" className="btn-retry-explain" onClick={handleFetchExplanation}>
            Retry
          </button>
        </div>
      )}

      {explanation && !isExplaining && (
        <div className="explanation-results-card">
          <div className="explanation-card-header">
            <div className="explanation-title-group">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <div>
                <h4 className="explanation-card-title">AI-Powered Change Explanation Report</h4>
                <span className="explanation-card-sub">{explanation.summary}</span>
              </div>
            </div>
            <button type="button" className="btn-reexplain" onClick={handleFetchExplanation}>
              Refresh Explanation
            </button>
          </div>

          <div className="explanation-sections-grid">
            {/* 1. Change Summary & Description */}
            <div className="explain-block">
              <h5 className="block-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
                Change Summary &amp; Description
              </h5>
              <div className="block-body">
                <p className="block-text font-bold">{explanation.summary}</p>
                <p className="block-subtext">
                  <em>Simulated Modification:</em> {explanation.change_description}
                </p>
              </div>
            </div>

            {/* 2. Potential Regression Risk Explanation */}
            <div className="explain-block risk-block">
              <h5 className="block-title font-risk">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                Potential Regression Risk Explanation
              </h5>
              <div className="block-body">
                <p className="block-text">{explanation.risk_explanation}</p>
              </div>
            </div>

            {/* 3. Important Affected Files */}
            <div className="explain-block">
              <h5 className="block-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
                Important Affected Files ({explanation.important_files.length})
              </h5>
              <div className="block-body">
                {explanation.important_files.length > 0 ? (
                  <div className="important-files-chips">
                    {explanation.important_files.map((file, idx) => (
                      <div key={`${file}-${idx}`} className="important-file-chip">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                        </svg>
                        <span className="mono">{file}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="empty-files-msg">No important dependent files identified.</span>
                )}
              </div>
            </div>

            {/* 4. Direct Dependency Breakdown */}
            <div className="explain-block">
              <h5 className="block-title font-direct">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                Direct Dependents Breakdown
              </h5>
              <div className="block-body">
                <p className="block-text">{explanation.direct_dependency_explanation}</p>
              </div>
            </div>

            {/* 5. Transitive Dependency Breakdown */}
            <div className="explain-block">
              <h5 className="block-title font-transitive">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="13 17 18 12 13 7"></polyline>
                  <polyline points="6 17 11 12 6 7"></polyline>
                </svg>
                Transitive Dependents Breakdown
              </h5>
              <div className="block-body">
                <p className="block-text">{explanation.transitive_dependency_explanation}</p>
              </div>
            </div>

            {/* 6. Recommended Tests to Execute */}
            <div className="explain-block">
              <h5 className="block-title font-test">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                Recommended Test Suites ({explanation.recommended_tests.length})
              </h5>
              <div className="block-body">
                {explanation.recommended_tests.length > 0 ? (
                  <div className="rec-tests-grid">
                    {explanation.recommended_tests.map((testFile, idx) => (
                      <div key={`${testFile}-${idx}`} className="rec-test-item">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="22 4 12 14.01 9 11.01"></polyline>
                        </svg>
                        <span className="mono">{testFile}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="empty-files-msg">No affected test files detected. Run default package unit tests.</span>
                )}
              </div>
            </div>

            {/* 7. Developer Recommendation */}
            <div className="explain-block recommendation-card-block full-width">
              <h5 className="block-title font-cyan">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 11 12 14 22 4"></polyline>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                </svg>
                Final Developer Recommendation
              </h5>
              <div className="block-body">
                <p className="recommendation-highlight-text">{explanation.recommendation}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
