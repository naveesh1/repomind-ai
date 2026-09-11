import React, { useState } from 'react';
import type { AnalyzeApiResponse, CommitAnalysisResponse, FileChangeRecord } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface CommitAnalysisProps {
  repositoryUrl?: string;
  repoData?: AnalyzeApiResponse;
  onTriggerImpactAnalysis?: (file: string, func?: string) => void;
}

export const CommitAnalysis: React.FC<CommitAnalysisProps> = ({
  repositoryUrl = '',
  repoData,
  onTriggerImpactAnalysis,
}) => {
  const [commitRevision, setCommitRevision] = useState('HEAD');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitData, setCommitData] = useState<CommitAnalysisResponse | null>(null);

  const handleAnalyzeCommit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    const url = repositoryUrl || repoData?.repository_url;
    if (!url) {
      setError('No repository analysis data available. Please perform repository analysis first.');
      return;
    }

    if (!commitRevision.trim()) {
      setError('Please enter a valid Commit SHA or Revision.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setCommitData(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/commit-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository_url: url,
          commit_sha: commitRevision.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to analyze commit (HTTP ${response.status})`
        );
      }

      const data: CommitAnalysisResponse = await response.json();
      setCommitData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to inspect Git commit.');
    } finally {
      setIsLoading(false);
    }
  };

  const getBadgeClass = (changeType: string) => {
    switch (changeType) {
      case 'ADDED':
        return 'badge-change-added';
      case 'MODIFIED':
        return 'badge-change-modified';
      case 'DELETED':
        return 'badge-change-deleted';
      case 'RENAMED':
        return 'badge-change-renamed';
      default:
        return 'badge-change-modified';
    }
  };

  const handleImpactClick = (file: string, func?: string) => {
    if (onTriggerImpactAnalysis) {
      onTriggerImpactAnalysis(file, func);
    }
  };

  const allFiles: FileChangeRecord[] = commitData
    ? [
        ...commitData.added_files,
        ...commitData.modified_files,
        ...commitData.deleted_files,
        ...commitData.renamed_files,
      ]
    : [];

  return (
    <div className="commit-analysis-container">
      {/* 1. Commit Input Control */}
      <div className="sim-control-card">
        <form onSubmit={handleAnalyzeCommit} className="sim-form">
          <div className="sim-form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="sim-form-group">
              <label className="sim-label">Git Commit SHA / Tag / Revision</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  className="sim-input mono"
                  placeholder="e.g., HEAD, HEAD~1, v2.31.0, or full 40-char SHA"
                  value={commitRevision}
                  onChange={(e) => setCommitRevision(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="sim-submit-row">
            <button
              type="submit"
              className="btn-primary btn-sim-submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span>Inspecting Commit...</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                  </svg>
                </>
              ) : (
                <>
                  <span>Analyze Git Commit</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="4"></circle>
                    <line x1="1.05" y1="12" x2="7" y2="12"></line>
                    <line x1="17" y1="12" x2="22.95" y2="12"></line>
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

      {/* 2. Commit Metadata & Analysis Results */}
      {commitData && (
        <div className="change-results-wrapper">
          {/* Commit Header & Information */}
          <div className="exec-score-card">
            <div className="commit-header-meta">
              <div className="commit-sha-badge-row">
                <span className="mono commit-sha-pill">SHA: {commitData.commit_sha.substring(0, 12)}</span>
                {commitData.parent_sha && (
                  <span className="mono commit-parent-pill">
                    Parent: {commitData.parent_sha.substring(0, 12)}
                  </span>
                )}
                <span className="badge badge-fn">{commitData.files_changed} file(s) changed</span>
              </div>

              <div className="commit-author-date">
                <span className="author-name">{commitData.author}</span>
                {commitData.date && (
                  <span className="commit-date">
                    • {new Date(commitData.date).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="exec-narrative-box commit-msg-box">
                <pre className="commit-msg-text">{commitData.commit_message}</pre>
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="health-stats-grid">
            <div className="health-stat-box">
              <span className="stat-num">{commitData.files_changed}</span>
              <span className="stat-lbl">Files Changed</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num accent-source">+{commitData.lines_added}</span>
              <span className="stat-lbl">Lines Added</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num accent-imp">-{commitData.lines_removed}</span>
              <span className="stat-lbl">Lines Removed</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num accent-cyan">{commitData.function_changes.length}</span>
              <span className="stat-lbl">Function Changes</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num accent-purple">{commitData.class_changes.length}</span>
              <span className="stat-lbl">Class Changes</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num accent-test">{commitData.dependency_changes.length}</span>
              <span className="stat-lbl">Dependency Changes</span>
            </div>
          </div>

          {/* Categorized File Changes */}
          <div className="exec-section">
            <h4 className="exec-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13 2 13 9 20 9"></polyline>
              </svg>
              Changed Files ({allFiles.length})
            </h4>
            <div className="high-impact-table-card">
              <div className="impact-table-header">
                <span>File Path</span>
                <span>Type</span>
                <span>Delta</span>
                <span>Action</span>
              </div>
              <div className="impact-table-body">
                {allFiles.map((fc, i) => (
                  <div key={i} className="impact-table-row">
                    <span className="file-name mono">
                      {fc.file}
                      {fc.old_path ? ` (renamed from ${fc.old_path})` : ''}
                    </span>
                    <span className={`badge ${getBadgeClass(fc.change_type)}`}>
                      {fc.change_type}
                    </span>
                    <span className="mono">
                      <span className="accent-source">+{fc.lines_added}</span> /{' '}
                      <span className="accent-imp">-{fc.lines_removed}</span>
                    </span>
                    <span>
                      {fc.change_type !== 'DELETED' && (
                        <button
                          type="button"
                          className="btn-impact-action"
                          onClick={() => handleImpactClick(fc.file)}
                        >
                          Analyze Commit Impact
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Python Function Changes */}
          {commitData.function_changes.length > 0 && (
            <div className="exec-section">
              <h4 className="exec-section-title font-cyan">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6"></polyline>
                  <polyline points="8 6 2 12 8 18"></polyline>
                </svg>
                Python Function AST Changes ({commitData.function_changes.length})
              </h4>
              <div className="health-list">
                {commitData.function_changes.map((fn, idx) => (
                  <div key={idx} className="health-list-item" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span className={`badge ${getBadgeClass(fn.change_type)}`}>
                        {fn.change_type}
                      </span>
                      <span className="mono">{fn.function_name}()</span>
                      <span className="text-muted font-sm">in {fn.file}</span>
                    </div>
                    {fn.change_type !== 'DELETED' && (
                      <button
                        type="button"
                        className="btn-impact-action"
                        onClick={() => handleImpactClick(fn.file, fn.function_name)}
                      >
                        Analyze Function Impact
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Python Class Changes */}
          {commitData.class_changes.length > 0 && (
            <div className="exec-section">
              <h4 className="exec-section-title font-purple">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                  <line x1="4" y1="22" x2="4" y2="15"></line>
                </svg>
                Python Class Changes ({commitData.class_changes.length})
              </h4>
              <div className="health-list">
                {commitData.class_changes.map((cls, idx) => (
                  <div key={idx} className="health-list-item">
                    <span className={`badge ${getBadgeClass(cls.change_type)}`}>
                      {cls.change_type}
                    </span>
                    <span className="mono">{cls.class_name}</span>
                    <span className="text-muted font-sm">in {cls.file}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dependency & Import Changes */}
          {commitData.dependency_changes.length > 0 && (
            <div className="exec-section">
              <h4 className="exec-section-title font-source">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                </svg>
                Dependency &amp; Import Changes ({commitData.dependency_changes.length})
              </h4>
              <div className="health-list">
                {commitData.dependency_changes.map((dep, idx) => (
                  <div key={idx} className="health-list-item">
                    <span className={`badge ${getBadgeClass(dep.change_type)}`}>
                      {dep.change_type}
                    </span>
                    <span className="mono">import {dep.import_name}</span>
                    <span className="text-muted font-sm">in {dep.file}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
