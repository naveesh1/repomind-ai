import React, { useState, useEffect, useCallback } from 'react';
import type { AnalyzeApiResponse, RepositoryHealthResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface RepositoryHealthProps {
  repositoryUrl?: string;
  repoData?: AnalyzeApiResponse;
}

export const RepositoryHealth: React.FC<RepositoryHealthProps> = ({
  repositoryUrl = '',
  repoData,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [healthData, setHealthData] = useState<RepositoryHealthResponse | null>(null);

  const fetchHealthData = useCallback(async () => {
    const url = repositoryUrl || repoData?.repository_url;
    if (!url) {
      setError('No repository analysis data available. Please perform repository analysis first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fetchUrl = url
        ? `${API_BASE_URL}/api/repository-health?repository_url=${encodeURIComponent(url)}`
        : `${API_BASE_URL}/api/repository-health`;

      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });


      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || `Failed to fetch repository health (HTTP ${response.status})`
        );
      }

      const data: RepositoryHealthResponse = await response.json();
      setHealthData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate repository health.');
    } finally {
      setIsLoading(false);
    }
  }, [repositoryUrl, repoData]);

  useEffect(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  const getHealthBadgeClass = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'health-level-critical';
      case 'HIGH':
        return 'health-level-high';
      case 'MEDIUM':
        return 'health-level-medium';
      default:
        return 'health-level-low';
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 75) return '#34d399'; // Optimal / Critical high health
    if (score >= 50) return '#facc15'; // Medium-high
    if (score >= 25) return '#fb923c'; // Medium-low
    return '#f87171'; // Low health / Risk
  };

  if (isLoading) {
    return (
      <div className="health-loading-card">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
        </svg>
        <span>Calculating repository health, risk indicators &amp; architecture bottlenecks...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="form-feedback feedback-error health-error-card">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{error}</span>
        <button type="button" className="btn-retry-health" onClick={fetchHealthData}>
          Retry Calculation
        </button>
      </div>
    );
  }

  if (!healthData) return null;

  return (
    <div className="repository-health-container">
      {/* 1. Overall Health Score Banner */}
      <div className="health-score-card">
        <div className="health-banner-top">
          <div className="health-gauge-group">
            <div
              className={`score-badge ${getHealthBadgeClass(healthData.health_level)}`}
              style={{ borderColor: getHealthColor(healthData.health_score) }}
            >
              <span className="score-value">{healthData.health_score}</span>
              <span className="score-denom">/100</span>
            </div>
            <div className="gauge-track-wrapper">
              <div className="health-gauge-bar">
                <div
                  className="health-gauge-fill"
                  style={{
                    width: `${healthData.health_score}%`,
                    backgroundColor: getHealthColor(healthData.health_score),
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

          <div className="health-repo-meta">
            <div className="meta-title-row">
              <span className={`health-level-tag ${getHealthBadgeClass(healthData.health_level)}`}>
                {healthData.health_level} HEALTH
              </span>
              <h3 className="health-repo-name">{healthData.repository_name}</h3>
            </div>
            <p className="health-score-desc">
              Deterministic health score computed from repository file balance, dependency coupling density, caller centralization, and test coverage indicators.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Repository Statistics Grid */}
      <div className="health-section">
        <h4 className="health-section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
          Repository Statistics
        </h4>
        <div className="health-stats-grid">
          <div className="health-stat-box">
            <span className="stat-num">{healthData.total_files}</span>
            <span className="stat-lbl">Total Files</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-source">{healthData.source_files}</span>
            <span className="stat-lbl">Source Files</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-test">{healthData.test_files}</span>
            <span className="stat-lbl">Test Files</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-dir">{healthData.directories}</span>
            <span className="stat-lbl">Directories</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-cyan">{healthData.python_files}</span>
            <span className="stat-lbl">Python Files</span>
          </div>
        </div>
      </div>

      {/* 3. Code Statistics Grid */}
      <div className="health-section">
        <h4 className="health-section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          Code &amp; AST Statistics
        </h4>
        <div className="health-stats-grid">
          <div className="health-stat-box">
            <span className="stat-num accent-cyan">{healthData.total_functions}</span>
            <span className="stat-lbl">Functions</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-purple">{healthData.total_classes}</span>
            <span className="stat-lbl">Classes</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-imp">{healthData.total_imports}</span>
            <span className="stat-lbl">Imports</span>
          </div>
          <div className="health-stat-box">
            <span className="stat-num accent-source">{healthData.dependency_connections}</span>
            <span className="stat-lbl">Dependency Connections</span>
          </div>
        </div>
      </div>

      {/* 4. Risk Indicators */}
      <div className="health-section">
        <h4 className="health-section-title font-risk">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          Risk Indicators ({healthData.risk_indicators.length})
        </h4>
        <div className="health-list">
          {healthData.risk_indicators.map((indicator, idx) => (
            <div key={idx} className="health-list-item risk-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <span>{indicator}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. High-Impact Files */}
      <div className="health-section">
        <h4 className="health-section-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          High-Impact Bottleneck Files ({healthData.high_impact_files.length})
        </h4>
        {healthData.high_impact_files.length > 0 ? (
          <div className="high-impact-table-card">
            <div className="impact-table-header">
              <span>File Path</span>
              <span>Direct Dependents</span>
              <span>Internal Imports</span>
            </div>
            <div className="impact-table-body">
              {healthData.high_impact_files.map((rec, idx) => (
                <div key={`${rec.file}-${idx}`} className="impact-table-row">
                  <span className="file-name mono">{rec.file}</span>
                  <span className="badge badge-fn">{rec.direct_dependents} callers</span>
                  <span className="badge badge-imp">{rec.imports} imports</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="empty-files-msg">No high-impact bottleneck files detected.</div>
        )}
      </div>

      {/* 6. Actionable Recommendations */}
      <div className="health-section">
        <h4 className="health-section-title font-cyan">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          Actionable Health Recommendations
        </h4>
        <div className="health-list">
          {healthData.recommendations.map((rec, idx) => (
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
