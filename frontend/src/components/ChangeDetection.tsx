import React, { useState } from 'react';
import type { AnalyzeApiResponse, ChangeDetectionResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface ChangeDetectionProps {
  repositoryUrl?: string;
  repoData?: AnalyzeApiResponse;
}

export const ChangeDetection: React.FC<ChangeDetectionProps> = ({
  repositoryUrl = '',
  repoData,
}) => {
  const [baseRevision, setBaseRevision] = useState('v2.28.0');
  const [targetRevision, setTargetRevision] = useState('v2.31.0');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<ChangeDetectionResponse | null>(null);

  const handleDetectChanges = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    const url = repositoryUrl || repoData?.repository_url;
    if (!url) {
      setError('No repository analysis data available. Please perform repository analysis first.');
      return;
    }

    if (!baseRevision.trim() || !targetRevision.trim()) {
      setError('Please enter both Base and Target commits/revisions.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDiffResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/change-detection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repository_url: url,
          base_revision: baseRevision.trim(),
          target_revision: targetRevision.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to detect changes (HTTP ${response.status})`
        );
      }

      const data: ChangeDetectionResponse = await response.json();
      setDiffResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to execute repository change detection.');
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

  return (
    <div className="change-detection-container">
      {/* 1. Revision Comparison Input Form */}
      <div className="sim-control-card">
        <form onSubmit={handleDetectChanges} className="sim-form">
          <div className="sim-form-grid">
            <div className="sim-form-group">
              <label className="sim-label">Base Commit / Tag / Revision</label>
              <input
                type="text"
                className="sim-input mono"
                placeholder="e.g., v2.28.0 or main~5"
                value={baseRevision}
                onChange={(e) => setBaseRevision(e.target.value)}
              />
            </div>

            <div className="sim-form-group">
              <label className="sim-label">Target Commit / Tag / Revision</label>
              <input
                type="text"
                className="sim-input mono"
                placeholder="e.g., v2.31.0 or main"
                value={targetRevision}
                onChange={(e) => setTargetRevision(e.target.value)}
              />
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
                  <span>Comparing Revisions...</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                  </svg>
                </>
              ) : (
                <>
                  <span>Detect Version Changes</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"></path>
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

      {/* 2. Change Detection Results */}
      {diffResult && (
        <div className="change-results-wrapper">
          {/* Summary Cards */}
          <div className="health-stats-grid">
            <div className="health-stat-box">
              <span className="stat-num">{diffResult.summary.total_files_changed}</span>
              <span className="stat-lbl">Files Changed</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num accent-source">+{diffResult.summary.lines_added}</span>
              <span className="stat-lbl">Lines Added</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num accent-imp">-{diffResult.summary.lines_removed}</span>
              <span className="stat-lbl">Lines Removed</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num accent-cyan">{diffResult.summary.functions_changed}</span>
              <span className="stat-lbl">Function Changes</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num accent-purple">{diffResult.summary.classes_changed}</span>
              <span className="stat-lbl">Class Changes</span>
            </div>
            <div className="health-stat-box">
              <span className="stat-num accent-test">{diffResult.summary.dependency_changes}</span>
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
              File Changes ({diffResult.file_changes.length})
            </h4>
            <div className="high-impact-table-card">
              <div className="impact-table-header">
                <span>File Path</span>
                <span>Change Type</span>
                <span>Line Delta</span>
              </div>
              <div className="impact-table-body">
                {diffResult.file_changes.map((fc, i) => (
                  <div key={i} className="impact-table-row">
                    <span className="file-name mono">
                      {fc.file}
                      {fc.old_path ? ` (from ${fc.old_path})` : ''}
                    </span>
                    <span className={`badge ${getBadgeClass(fc.change_type)}`}>
                      {fc.change_type}
                    </span>
                    <span className="mono">
                      <span className="accent-source">+{fc.lines_added}</span> /{' '}
                      <span className="accent-imp">-{fc.lines_removed}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Python Function Changes */}
          {diffResult.function_changes.length > 0 && (
            <div className="exec-section">
              <h4 className="exec-section-title font-cyan">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 18 22 12 16 6"></polyline>
                  <polyline points="8 6 2 12 8 18"></polyline>
                </svg>
                Python Function AST Changes ({diffResult.function_changes.length})
              </h4>
              <div className="health-list">
                {diffResult.function_changes.map((fn, idx) => (
                  <div key={idx} className="health-list-item">
                    <span className={`badge ${getBadgeClass(fn.change_type)}`}>
                      {fn.change_type}
                    </span>
                    <span className="mono">{fn.function_name}()</span>
                    <span className="text-muted font-sm">in {fn.file}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Python Class Changes */}
          {diffResult.class_changes.length > 0 && (
            <div className="exec-section">
              <h4 className="exec-section-title font-purple">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                  <line x1="4" y1="22" x2="4" y2="15"></line>
                </svg>
                Python Class Changes ({diffResult.class_changes.length})
              </h4>
              <div className="health-list">
                {diffResult.class_changes.map((cls, idx) => (
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
          {diffResult.dependency_changes.length > 0 && (
            <div className="exec-section">
              <h4 className="exec-section-title font-source">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                </svg>
                Dependency &amp; Import Changes ({diffResult.dependency_changes.length})
              </h4>
              <div className="health-list">
                {diffResult.dependency_changes.map((dep, idx) => (
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
