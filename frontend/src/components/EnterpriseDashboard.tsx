import React, { useState, useEffect } from 'react';
import { EnterpriseHeader } from './EnterpriseHeader';
import { EnterpriseSidebar } from './EnterpriseSidebar';
import { DashboardHome } from './DashboardHome';
import { AnalysisResults } from './AnalysisResults';
import type { AnalyzeApiResponse, EngineeringCommandCenterResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

export const EnterpriseDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const [repoUrl, setRepoUrl] = useState<string>('https://github.com/owner/repository');
  const [repoData, setRepoData] = useState<AnalyzeApiResponse | null>(null);
  const [commandCenterData, setCommandCenterData] = useState<EngineeringCommandCenterResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Command Center SSoT metrics
  const fetchCommandCenterMetrics = async (targetUrl: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/engineering-command-center?repository_url=${encodeURIComponent(targetUrl)}`);
      if (res.ok) {
        const data: EngineeringCommandCenterResponse = await res.json();
        setCommandCenterData(data);
      }
    } catch {
      // Ignore background fetch errors if main analysis succeeds
    }
  };

  // Main Analyze Repository trigger
  const handleAnalyzeRepository = async (targetUrl: string, token?: string) => {
    if (!targetUrl) return;
    setIsLoading(true);
    setError(null);
    setRepoUrl(targetUrl);

    try {
      const payload: { repository_url: string; github_token?: string } = {
        repository_url: targetUrl,
      };
      if (token) payload.github_token = token;

      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let displayMsg = `Server error ${response.status}`;
        try {
          const errJson = await response.json();
          displayMsg = errJson.detail || errJson.message || displayMsg;
        } catch {}
        throw new Error(displayMsg);
      }

      const data: AnalyzeApiResponse = await response.json();
      setRepoData(data);

      // Fetch Command Center metrics in parallel for real SSoT KPIs
      await fetchCommandCenterMetrics(targetUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze repository. Ensure FastAPI backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load - fetch default command center metrics if backend is live
  useEffect(() => {
    if (repoUrl && !repoData) {
      fetchCommandCenterMetrics(repoUrl);
    }
  }, []);

  return (
    <div className="ent-dashboard-shell">
      <EnterpriseHeader
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeRepoUrl={repoData?.repository_url || repoUrl}
        apiOnline={true}
        onSearchSelect={(key) => setActiveTab(key)}
      />

      <div className="ent-dashboard-body">
        <EnterpriseSidebar
          activeTab={activeTab}
          onSelectTab={(key) => setActiveTab(key)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        <main className={`ent-main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          {activeTab === 'dashboard' ? (
            <DashboardHome
              repoData={repoData}
              commandCenterData={commandCenterData}
              isLoading={isLoading}
              onAnalyzeRepo={handleAnalyzeRepository}
              onNavigateTab={(key) => setActiveTab(key)}
              error={error}
            />
          ) : repoData ? (
            <div className="ent-module-view-wrapper">
              <div className="ent-module-top-bar">
                <button
                  type="button"
                  className="ent-back-btn"
                  onClick={() => setActiveTab('dashboard')}
                >
                  &larr; Back to Main Dashboard
                </button>
                <span className="ent-module-repo-title">
                  Analyzing: <strong>{repoData.repository_name}</strong>
                </span>
              </div>
              <AnalysisResults data={repoData} initialTab={activeTab} />
            </div>
          ) : (
            <div className="ent-no-repo-selected-card">
              <div className="ent-no-repo-icon">📂</div>
              <h3>No Repository Analyzed Yet</h3>
              <p>Please enter a GitHub repository URL on the Main Dashboard to view feature intelligence.</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setActiveTab('dashboard')}
              >
                Go to Main Dashboard &rarr;
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
