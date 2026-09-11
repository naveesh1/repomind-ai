import React, { useState, useEffect, useCallback } from 'react';
import type { AnalyzeApiResponse, CodeQualityResponse, FileMetricRecord } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface CodeQualityProps {
  repositoryUrl?: string;
  repoData?: AnalyzeApiResponse;
}

export const CodeQuality: React.FC<CodeQualityProps> = ({
  repositoryUrl = '',
  repoData,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qualityData, setQualityData] = useState<CodeQualityResponse | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [filterTerm, setFilterTerm] = useState('');

  const fetchCodeQuality = useCallback(async () => {
    const url = repositoryUrl || repoData?.repository_url;
    if (!url) {
      setError('No repository analysis data available. Please perform repository analysis first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/code-quality`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repository_url: url }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to fetch code quality metrics (HTTP ${response.status})`
        );
      }

      const data: CodeQualityResponse = await response.json();
      setQualityData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze code quality and complexity.');
    } finally {
      setIsLoading(false);
    }
  }, [repositoryUrl, repoData]);

  useEffect(() => {
    fetchCodeQuality();
  }, [fetchCodeQuality]);

  const getQualityBadgeClass = (level: string) => {
    switch (level) {
      case 'HIGH':
        return 'quality-level-high';
      case 'MEDIUM':
        return 'quality-level-medium';
      case 'LOW':
        return 'quality-level-low';
      case 'CRITICAL':
        return 'quality-level-critical';
      default:
        return 'quality-level-medium';
    }
  };

  const getQualityColor = (score: number) => {
    if (score >= 75) return '#34d399'; // High quality
    if (score >= 50) return '#facc15'; // Medium quality
    if (score >= 25) return '#fb923c'; // Low quality
    return '#f87171'; // Critical quality
  };

  const toggleExpand = (filePath: string) => {
    setExpandedFile((prev) => (prev === filePath ? null : filePath));
  };

  const filteredMetrics = (qualityData?.file_metrics || []).filter((fm: FileMetricRecord) => {
    if (!filterTerm) return true;
    return fm.file.toLowerCase().includes(filterTerm.toLowerCase());
  });

  if (isLoading) {
    return (
      <div className="quality-loading-card">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
        </svg>
        <span>Performing AST static analysis for cyclomatic complexity, nesting depth &amp; file metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="form-feedback feedback-error quality-error-card">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{error}</span>
        <button type="button" className="btn-retry-quality" onClick={fetchCodeQuality}>
          Analyze Code Quality
        </button>
      </div>
    );
  }

  if (!qualityData) {
    return (
      <div className="empty-state">
        <p>No code quality data calculated yet.</p>
        <button type="button" className="btn-primary" onClick={fetchCodeQuality} style={{ marginTop: '1rem' }}>
          Analyze Code Quality
        </button>
      </div>
    );
  }

  return (
    <div className="code-quality-container">
      {/* 1. Header Banner & Quality Score */}
      <div className="quality-score-card">
        <div className="quality-banner-top">
          <div className="quality-gauge-group">
            <div
              className={`score-badge ${getQualityBadgeClass(qualityData.quality_level)}`}
              style={{ borderColor: getQualityColor(qualityData.quality_score) }}
            >
              <span className="score-value">{qualityData.quality_score}</span>
              <span className="score-denom">/100</span>
            </div>

            <div className="gauge-track-wrapper">
              <div className="health-gauge-bar">
                <div
                  className="health-gauge-fill"
                  style={{
                    width: `${qualityData.quality_score}%`,
                    backgroundColor: getQualityColor(qualityData.quality_score),
                  }}
                />
              </div>
              <div className="health-range-labels">
                <span>0-24 CRITICAL</span>
                <span>25-49 LOW</span>
                <span>50-74 MEDIUM</span>
                <span>75-100 HIGH</span>
              </div>
            </div>
          </div>

          <div className="quality-repo-meta">
            <div className="meta-title-row">
              <span className={`health-level-tag ${getQualityBadgeClass(qualityData.quality_level)}`}>
                {qualityData.quality_level} QUALITY
              </span>
              <h3 className="health-repo-name">Code Quality &amp; Complexity Analysis</h3>
              <button
                type="button"
                className="btn-trigger-quality"
                onClick={fetchCodeQuality}
                disabled={isLoading}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 4v6h-6"></path>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                Analyze Code Quality
              </button>
            </div>
            <p className="health-score-desc">
              Deterministic AST static analysis measuring function cyclomatic complexity, control-flow nesting depth, source line thresholds, and maintainability concerns.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Primary Metrics Summary Grid */}
      <div className="quality-section">
        <h4 className="quality-section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
          </svg>
          Repository Quality Overview
        </h4>
        <div className="health-stats-grid">
          <div className="health-stat-box">
            <span className="stat-num">{qualityData.total_files_analyzed}</span>
            <span className="stat-lbl">Files Analyzed</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-cyan">{qualityData.total_functions}</span>
            <span className="stat-lbl">Total Functions</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-imp">{qualityData.complex_functions}</span>
            <span className="stat-lbl">Complex Functions (&gt;10)</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-dir">{qualityData.large_files}</span>
            <span className="stat-lbl">Large Files (&gt;250 L)</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-test">{qualityData.deeply_nested_functions}</span>
            <span className="stat-lbl">Deeply Nested (&gt;=4)</span>
          </div>
        </div>
      </div>

      {/* 3. Quality Issues List */}
      <div className="quality-section">
        <h4 className="quality-section-title font-risk">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          Maintainability &amp; Quality Issues ({qualityData.issues.length})
        </h4>
        <div className="health-list">
          {qualityData.issues.map((issue, idx) => (
            <div key={idx} className="health-list-item risk-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              <span>{issue}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Per-File Metrics Table with Filtering and Expand/Collapse */}
      <div className="quality-section">
        <div className="section-header-row">
          <h4 className="quality-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            Per-File Quality Metrics ({filteredMetrics.length})
          </h4>
          <div className="tab-search-wrapper" style={{ maxWidth: '280px' }}>
            <svg className="tab-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="tab-search-input"
              placeholder="Filter file metrics..."
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
            />
          </div>
        </div>

        {filteredMetrics.length > 0 ? (
          <div className="high-impact-table-card">
            <div className="quality-table-header">
              <span>File Path</span>
              <span>Lines</span>
              <span>Functions</span>
              <span>Max Complexity</span>
              <span>Max Nesting</span>
              <span>Quality Level</span>
            </div>
            <div className="impact-table-body">
              {filteredMetrics.map((fm, idx) => {
                const isExpanded = expandedFile === fm.file;
                return (
                  <React.Fragment key={`${fm.file}-${idx}`}>
                    <div
                      className={`quality-table-row ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => toggleExpand(fm.file)}
                    >
                      <span className="file-name mono">
                        <svg className={`chevron-icon ${isExpanded ? 'rotated' : ''}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.4rem' }}>
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                        {fm.file}
                      </span>
                      <span className="badge badge-imp">{fm.lines} L</span>
                      <span className="badge badge-fn">{fm.functions} funcs</span>
                      <span className={`badge ${fm.max_complexity > 10 ? 'badge-fn-complex' : 'badge-cls'}`}>
                        Complexity: {fm.max_complexity}
                      </span>
                      <span className={`badge ${fm.max_nesting_depth >= 4 ? 'badge-fn-nested' : 'badge-imp'}`}>
                        Nesting: {fm.max_nesting_depth}
                      </span>
                      <span className={`health-level-tag ${getQualityBadgeClass(fm.quality_level)}`}>
                        {fm.quality_level}
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="quality-detail-expanded">
                        <div className="expanded-detail-grid">
                          <div>
                            <strong>Total Source Lines:</strong> {fm.lines} lines
                          </div>
                          <div>
                            <strong>Function Count:</strong> {fm.functions} functions
                          </div>
                          <div>
                            <strong>Class Count:</strong> {fm.classes} classes
                          </div>
                          <div>
                            <strong>Max AST Cyclomatic Complexity:</strong> {fm.max_complexity}
                          </div>
                          <div>
                            <strong>Max Control Nesting Depth:</strong> {fm.max_nesting_depth} levels
                          </div>
                          <div>
                            <strong>File Status:</strong> File classified as <strong>{fm.quality_level}</strong> quality based on AST metrics.
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="empty-files-msg">No per-file metrics matching &quot;{filterTerm}&quot;.</div>
        )}
      </div>

      {/* 5. Actionable Recommendations */}
      <div className="quality-section">
        <h4 className="quality-section-title font-cyan">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          Refactoring &amp; Quality Recommendations
        </h4>
        <div className="health-list">
          {qualityData.recommendations.map((rec, idx) => (
            <div key={idx} className="health-list-item rec-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{rec}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
