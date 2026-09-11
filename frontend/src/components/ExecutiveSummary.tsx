import React, { useState, useEffect, useCallback } from 'react';
import type { AnalyzeApiResponse, ExecutiveSummaryResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface ExecutiveSummaryProps {
  repositoryUrl?: string;
  repoData?: AnalyzeApiResponse;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({
  repositoryUrl = '',
  repoData,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ExecutiveSummaryResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchExecutiveReport = useCallback(async () => {
    const url = repositoryUrl || repoData?.repository_url;
    if (!url) {
      setError('No repository analysis data available. Please perform repository analysis first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/executive-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repository_url: url }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to generate executive report (HTTP ${response.status})`
        );
      }

      const data: ExecutiveSummaryResponse = await response.json();
      setReportData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to synthesize executive summary audit report.');
    } finally {
      setIsLoading(false);
    }
  }, [repositoryUrl, repoData]);

  useEffect(() => {
    fetchExecutiveReport();
  }, [fetchExecutiveReport]);

  const getGradeBadgeClass = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'grade-a';
      case 'B':
        return 'grade-b';
      case 'C':
        return 'grade-c';
      case 'D':
        return 'grade-d';
      case 'F':
        return 'grade-f';
      default:
        return 'grade-c';
    }
  };

  const getRiskLevelClass = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'health-level-critical';
      case 'HIGH':
        return 'health-level-low';
      case 'MEDIUM':
        return 'health-level-medium';
      default:
        return 'health-level-critical';
    }
  };

  const handleCopyReport = () => {
    if (!reportData) return;
    const text = `=== REPOMIND AI EXECUTIVE AUDIT REPORT ===
Repository: ${reportData.repository_name} (${reportData.repository_url})
Overall Grade: ${reportData.overall_grade} (Score: ${reportData.overall_score}/100)
Risk Level: ${reportData.risk_level}
Health Score: ${reportData.health_score}/100 | Quality Score: ${reportData.quality_score}/100

NARRATIVE:
${reportData.summary_narrative}

CRITICAL AUDIT RISKS:
${reportData.critical_risks.map((r, i) => `${i + 1}. ${r}`).join('\n')}

EXECUTIVE RECOMMENDATIONS:
${reportData.executive_recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (isLoading) {
    return (
      <div className="exec-loading-card">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
        </svg>
        <span>Synthesizing repository metrics, risk indicators &amp; executive report...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="form-feedback feedback-error exec-error-card">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{error}</span>
        <button type="button" className="btn-retry-exec" onClick={fetchExecutiveReport}>
          Generate Executive Audit Report
        </button>
      </div>
    );
  }

  if (!reportData) return null;

  const km = reportData.key_metrics;

  return (
    <div className="executive-summary-container">
      {/* 1. Header Banner with Grade & Sub-Scores */}
      <div className="exec-score-card">
        <div className="exec-banner-top">
          <div className="grade-box-group">
            <div className={`grade-circle ${getGradeBadgeClass(reportData.overall_grade)}`}>
              <span className="grade-letter">{reportData.overall_grade}</span>
              <span className="grade-lbl">GRADE</span>
            </div>
            <div className="exec-score-metrics">
              <div className="score-denom-group">
                <span className="exec-score-val">{reportData.overall_score}</span>
                <span className="exec-score-max">/100 Index</span>
              </div>
              <span className={`health-level-tag ${getRiskLevelClass(reportData.risk_level)}`}>
                {reportData.risk_level} RISK
              </span>
            </div>
          </div>

          <div className="exec-repo-meta">
            <div className="meta-title-row">
              <h3 className="health-repo-name">{reportData.repository_name} Executive Report</h3>
              <div className="exec-actions-row">
                <button
                  type="button"
                  className="btn-copy-report"
                  onClick={handleCopyReport}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                  </svg>
                  {copied ? 'Copied to Clipboard!' : 'Copy Summary Report'}
                </button>
                <button
                  type="button"
                  className="btn-trigger-exec"
                  onClick={fetchExecutiveReport}
                  disabled={isLoading}
                >
                  Generate Audit Report
                </button>
              </div>
            </div>

            {/* Sub-Score Pills */}
            <div className="exec-subscore-strip">
              <div className="subscore-pill">
                <span className="subscore-lbl">Repository Health</span>
                <span className="subscore-val accent-cyan">{reportData.health_score}/100</span>
              </div>
              <div className="subscore-pill">
                <span className="subscore-lbl">Code Quality</span>
                <span className="subscore-val accent-source">{reportData.quality_score}/100</span>
              </div>
              <div className="subscore-pill">
                <span className="subscore-lbl">Generated</span>
                <span className="subscore-val">{new Date(reportData.generated_at).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Executive Narrative Summary */}
      <div className="exec-section">
        <h4 className="exec-section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          Executive Summary Narrative
        </h4>
        <div className="exec-narrative-box">
          <p>{reportData.summary_narrative}</p>
        </div>
      </div>

      {/* 3. Consolidated Key Metrics Grid */}
      <div className="exec-section">
        <h4 className="exec-section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          Key Repository &amp; Code Quality Metrics
        </h4>
        <div className="health-stats-grid">
          <div className="health-stat-box">
            <span className="stat-num">{km.total_files}</span>
            <span className="stat-lbl">Total Files</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-source">{km.source_files}</span>
            <span className="stat-lbl">Source Files</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-test">{km.test_files}</span>
            <span className="stat-lbl">Test Files</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-cyan">{km.total_functions}</span>
            <span className="stat-lbl">Functions</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-purple">{km.dependency_connections}</span>
            <span className="stat-lbl">Dependencies</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-imp">{km.complex_functions}</span>
            <span className="stat-lbl">Complex Funcs</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-dir">{km.large_files}</span>
            <span className="stat-lbl">Large Files</span>
          </div>
        </div>
      </div>

      {/* 4. Critical Audit Risks */}
      <div className="exec-section">
        <h4 className="exec-section-title font-risk">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          Critical Audit Risks &amp; Bottlenecks ({reportData.critical_risks.length})
        </h4>
        <div className="health-list">
          {reportData.critical_risks.map((risk, idx) => (
            <div key={idx} className="health-list-item risk-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{risk}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Top Bottleneck Files */}
      {reportData.top_bottleneck_files.length > 0 && (
        <div className="exec-section">
          <h4 className="exec-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            Top Central Bottleneck Files
          </h4>
          <div className="high-impact-table-card">
            <div className="impact-table-header">
              <span>File Path</span>
              <span>Direct Callers</span>
              <span>Imports</span>
            </div>
            <div className="impact-table-body">
              {reportData.top_bottleneck_files.slice(0, 5).map((f, i) => (
                <div key={i} className="impact-table-row">
                  <span className="file-name mono">{f.file}</span>
                  <span className="badge badge-fn">{f.direct_dependents} callers</span>
                  <span className="badge badge-imp">{f.imports} imports</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. Strategic Recommendations */}
      <div className="exec-section">
        <h4 className="exec-section-title font-cyan">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Executive Action Plan &amp; Recommendations ({reportData.executive_recommendations.length})
        </h4>
        <div className="health-list">
          {reportData.executive_recommendations.map((rec, idx) => (
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
