import React, { useState, useEffect } from 'react';
import type { AnalyzeApiResponse } from '../types';
import { ImpactAnalysis } from './ImpactAnalysis';
import { ChangeSimulation } from './ChangeSimulation';
import { CodeChangeSimulator } from './CodeChangeSimulator';
import { RepositoryHealth } from './RepositoryHealth';
import { CodeQuality } from './CodeQuality';
import { ExecutiveSummary } from './ExecutiveSummary';
import { ChangeDetection } from './ChangeDetection';
import { CommitAnalysis } from './CommitAnalysis';
import { TestImpact } from './TestImpact';
import { RegressionRisk } from './RegressionRisk';
import { ChangeRiskExplanation } from './ChangeRiskExplanation';
import { ChangeDecision } from './ChangeDecision';
import { HistoricalRisk } from './HistoricalRisk';
import { RepoRefreshTracking } from './RepoRefreshTracking';
import { RepoMonitoring } from './RepoMonitoring';
import { MultiRepoDashboard } from './MultiRepoDashboard';
import { ReleaseGatingEngine } from './ReleaseGatingEngine';
import { EngineeringGovernance } from './EngineeringGovernance';
import { HistoricalIntelligence } from './HistoricalIntelligence';
import { RepositoryComparison } from './RepositoryComparison';
import { EngineeringCommandCenter } from './EngineeringCommandCenter';
import { EngineeringInvestigation } from './EngineeringInvestigation';
import { EngineeringActionCenter } from './EngineeringActionCenter';
import { UnifiedEngineeringIntelligence } from './UnifiedEngineeringIntelligence';
import { EngineeringAuditHistory } from './EngineeringAuditHistory';
import { PullRequestIntelligence } from './PullRequestIntelligence';
import { EngineeringAICopilot } from './EngineeringAICopilot';
import { SmartTestSelection } from './SmartTestSelection';
import { ArchitectureIntelligence } from './ArchitectureIntelligence';
import { AdvancedEngineeringAnalytics } from './AdvancedEngineeringAnalytics';
import { NotificationsIntegrationsHub } from './NotificationsIntegrationsHub';
import { DependencyGraph } from './DependencyGraph';



interface AnalysisResultsProps {
  data: AnalyzeApiResponse;
  initialTab?: string;
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ data, initialTab }) => {
  const [activeTab, setActiveTab] = useState<
    | 'command-center'
    | 'unified-intelligence'
    | 'copilot'
    | 'advanced-analytics'
    | 'architecture-intelligence'
    | 'smart-test-selection'
    | 'notifications-integrations'

    | 'pull-request'
    | 'audit-history'
    | 'action-center'
    | 'investigation'
    | 'health'
    | 'quality'
    | 'executive'
    | 'diff'
    | 'commit'
    | 'test-impact'
    | 'regression-risk'
    | 'change-risk-explanation'
    | 'change-decision'
    | 'historical-risk'
    | 'repo-tracking'
    | 'repo-monitoring'
    | 'multi-repo'
    | 'release-gating'
    | 'engineering-governance'
    | 'historical-intelligence'
    | 'repo-comparison'
    | 'ast'
    | 'graph'
    | 'impact'
    | 'simulate'
    | 'simulator'
  >((initialTab as any) || 'command-center');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab as any);
    }
  }, [initialTab]);

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  // Preselected file and function for impact analysis / simulation
  const [targetImpactFile, setTargetImpactFile] = useState<string>('');
  const [targetImpactFunc, setTargetImpactFunc] = useState<string>('');

  // Investigation preselected target
  const [targetInvestigationTarget, setTargetInvestigationTarget] = useState<string>('');
  const [targetInvestigationType, setTargetInvestigationType] = useState<string>('FILE');

  // Action Center preselected action ID
  const [selectedActionId, setSelectedActionId] = useState<string | undefined>(undefined);

  const handleTriggerImpactFromCommit = (file: string, func?: string) => {
    setTargetImpactFile(file);
    setTargetImpactFunc(func || '');
    setActiveTab('impact');
  };

  const handleTriggerInvestigation = (target: string, targetType: string) => {
    setTargetInvestigationTarget(target);
    setTargetInvestigationType(targetType);
    setActiveTab('investigation');
  };

  const handleCreateAction = (_target: string, _category: string) => {
    setSelectedActionId(undefined);
    setActiveTab('action-center');
  };

  const pythonFiles = data.python_files || [];
  const dependencyGraph = data.dependency_graph || {};

  // Aggregated totals
  const totalFunctions = pythonFiles.reduce((acc, f) => acc + (f.functions?.length || 0), 0);
  const totalClasses = pythonFiles.reduce((acc, f) => acc + (f.classes?.length || 0), 0);
  const totalImports = pythonFiles.reduce((acc, f) => acc + (f.imports?.length || 0), 0);
  const totalGraphEdges = Object.values(dependencyGraph).reduce((acc, deps) => acc + deps.length, 0);

  // Search filtering
  const filteredPythonFiles = pythonFiles.filter((f) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      f.file.toLowerCase().includes(term) ||
      f.functions.some((func) => func.toLowerCase().includes(term)) ||
      f.classes.some((cls) => cls.toLowerCase().includes(term)) ||
      f.imports.some((imp) => imp.toLowerCase().includes(term))
    );
  });

  const toggleExpand = (filePath: string) => {
    setExpandedFile((prev) => (prev === filePath ? null : filePath));
  };

  const handleTriggerImpact = (filePath: string, funcName: string = '') => {
    setTargetImpactFile(filePath);
    setTargetImpactFunc(funcName);
    setActiveTab('impact');
  };

  return (
    <div className="analysis-results-container">
      {/* Header Summary Card */}
      <div className="stats-card">
        <div className="stats-header">
          <div className="stats-title-group">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            <div>
              <h3 className="stats-repo-name">{data.repository_name}</h3>
              <span className="stats-subtext">Repository Analysis Complete</span>
            </div>
          </div>
          <span className="stats-status-badge">Status: {data.status}</span>
        </div>

        <div className="stats-url-link">
          <a href={data.repository_url} target="_blank" rel="noopener noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
              <path d="M9 18c-4.51 2-5-2-7-2"></path>
            </svg>
            {data.repository_url}
          </a>
        </div>

        {/* Primary Repository Metrics */}
        <div className="stats-grid">
          <div className="stat-box">
            <span className="stat-number">{data.total_files}</span>
            <span className="stat-label">Total Files</span>
          </div>
          <div className="stat-box">
            <span className="stat-number accent-source">{data.source_files}</span>
            <span className="stat-label">Source Files</span>
          </div>
          <div className="stat-box">
            <span className="stat-number accent-test">{data.test_files}</span>
            <span className="stat-label">Test Files</span>
          </div>
          <div className="stat-box">
            <span className="stat-number accent-dir">{data.directories}</span>
            <span className="stat-label">Directories</span>
          </div>
        </div>

        {/* Secondary Extracted Insights Pills */}
        <div className="insights-summary-strip">
          <div className="insight-pill">
            <span className="insight-val">{pythonFiles.length}</span>
            <span className="insight-lbl">Python Files</span>
          </div>
          <div className="insight-pill">
            <span className="insight-val">{totalFunctions}</span>
            <span className="insight-lbl">Functions</span>
          </div>
          <div className="insight-pill">
            <span className="insight-val">{totalClasses}</span>
            <span className="insight-lbl">Classes</span>
          </div>
          <div className="insight-pill">
            <span className="insight-val">{totalImports}</span>
            <span className="insight-lbl">Imports</span>
          </div>
          <div className="insight-pill">
            <span className="insight-val">{totalGraphEdges}</span>
            <span className="insight-lbl">Dependency Connections</span>
          </div>
        </div>
      </div>

      {/* Module Header Bar */}
      <div className="results-detail-card">
        <div className="module-view-header">
          <div className="module-view-title-group">
            <span className="module-view-category">
              {activeTab === 'command-center' ? 'Overview' :
               activeTab === 'unified-intelligence' ? 'Overview' :
               activeTab === 'copilot' ? 'Engineering Intelligence' :
               activeTab === 'advanced-analytics' ? 'Analytics' :
               activeTab === 'notifications-integrations' ? 'Notifications' :
               activeTab === 'architecture-intelligence' ? 'Engineering Intelligence' :
               activeTab === 'smart-test-selection' ? 'Testing & Quality' :
               activeTab === 'pull-request' ? 'Change & PR' :
               activeTab === 'audit-history' ? 'Governance & Security' :
               activeTab === 'action-center' ? 'Governance & Security' :
               activeTab === 'investigation' ? 'Governance & Security' :
               activeTab === 'health' ? 'Repository Intelligence' :
               activeTab === 'quality' ? 'Engineering Intelligence' :
               activeTab === 'executive' ? 'Overview' :
               activeTab === 'diff' ? 'Change & PR' :
               activeTab === 'commit' ? 'Change & PR' :
               activeTab === 'test-impact' ? 'Testing & Quality' :
               activeTab === 'regression-risk' ? 'Change & PR' :
               activeTab === 'change-risk-explanation' ? 'Change & PR' :
               activeTab === 'change-decision' ? 'Change & PR' :
               activeTab === 'historical-risk' ? 'Testing & Quality' :
               activeTab === 'repo-tracking' ? 'Repository Intelligence' :
               activeTab === 'repo-monitoring' ? 'Repository Intelligence' :
               activeTab === 'multi-repo' ? 'Repository Intelligence' :
               activeTab === 'release-gating' ? 'Governance & Security' :
               activeTab === 'engineering-governance' ? 'Governance & Security' :
               activeTab === 'historical-intelligence' ? 'Analytics' :
               activeTab === 'repo-comparison' ? 'Repository Intelligence' :
               activeTab === 'ast' ? 'Repository Intelligence' :
               activeTab === 'graph' ? 'Engineering Intelligence' :
               activeTab === 'impact' ? 'Change & PR' :
               activeTab === 'simulate' ? 'Change & PR' :
               activeTab === 'simulator' ? 'Change & PR' : 'Engineering Intelligence'}
            </span>
            <h3 className="module-view-title">
              {activeTab === 'command-center' ? 'Engineering Command Center' :
               activeTab === 'unified-intelligence' ? 'Unified Engineering Intelligence' :
               activeTab === 'copilot' ? 'Engineering AI Copilot' :
               activeTab === 'advanced-analytics' ? 'Advanced Engineering Analytics' :
               activeTab === 'notifications-integrations' ? 'Notifications & Integrations' :
               activeTab === 'architecture-intelligence' ? 'Architecture Intelligence' :
               activeTab === 'smart-test-selection' ? 'Smart Test Selection' :
               activeTab === 'pull-request' ? 'Pull Request Intelligence' :
               activeTab === 'audit-history' ? 'Engineering Audit History' :
               activeTab === 'action-center' ? 'Engineering Action Center' :
               activeTab === 'investigation' ? 'Investigation Center' :
               activeTab === 'health' ? 'Repository Health' :
               activeTab === 'quality' ? 'Code Quality & Complexity' :
               activeTab === 'executive' ? 'Executive Audit & Summary' :
               activeTab === 'diff' ? 'Change Detection' :
               activeTab === 'commit' ? 'Git Commit Analysis' :
               activeTab === 'test-impact' ? 'Test Impact Analysis' :
               activeTab === 'regression-risk' ? 'Regression Risk Analysis' :
               activeTab === 'change-risk-explanation' ? 'Change Risk Explanation' :
               activeTab === 'change-decision' ? 'Change Decision Engine' :
               activeTab === 'historical-risk' ? 'Historical Test Results' :
               activeTab === 'repo-tracking' ? 'Repo Refresh & Tracking' :
               activeTab === 'repo-monitoring' ? 'Repository Monitoring' :
               activeTab === 'multi-repo' ? 'Multi-Repo Dashboard' :
               activeTab === 'release-gating' ? 'Release Risk Gate' :
               activeTab === 'engineering-governance' ? 'Engineering Governance' :
               activeTab === 'historical-intelligence' ? 'Historical Intelligence' :
               activeTab === 'repo-comparison' ? 'Repository Benchmarking' :
               activeTab === 'ast' ? 'Repository AST Analysis' :
               activeTab === 'graph' ? 'Dependency Graph' :
               activeTab === 'impact' ? 'Impact Analysis' :
               activeTab === 'simulate' ? 'Change Simulation' :
               activeTab === 'simulator' ? 'Code Change Simulator' : 'Analysis Module'}
            </h3>
          </div>

          {(activeTab === 'ast' || activeTab === 'graph') && (
            <div className="tab-search-wrapper">
              <svg className="tab-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                className="tab-search-input"
                placeholder={activeTab === 'ast' ? 'Filter files, functions, classes...' : 'Filter dependency relationships...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Tab Step 37 Content: Engineering Command Center & Executive Product Dashboard */}
        {activeTab === 'command-center' && (
          <div className="tab-pane-content">
            <EngineeringCommandCenter
              repositoryUrl={data.repository_url}
              onInvestigate={handleTriggerInvestigation}
              onCreateAction={handleCreateAction}
            />
          </div>
        )}

        {/* Tab Step 40 Content: Unified Engineering Intelligence & Risk Consistency Engine */}
        {activeTab === 'unified-intelligence' && (
          <div className="tab-pane-content">
            <UnifiedEngineeringIntelligence
              repositoryUrl={data.repository_url}
              onNavigateTab={(t) => setActiveTab(t as any)}
            />
          </div>
        )}

        {/* Tab Step 45 Content: Engineering AI Copilot */}
        {activeTab === 'copilot' && (
          <div className="tab-pane-content">
            <EngineeringAICopilot
              repositoryUrl={data.repository_url}
              onNavigateTab={(t) => setActiveTab(t as any)}
            />
          </div>
        )}

        {/* Tab Step 48 Content: Advanced Engineering Analytics */}
        {activeTab === 'advanced-analytics' && (
          <div className="tab-pane-content">
            <AdvancedEngineeringAnalytics
              repositoryUrl={data.repository_url}
              onNavigateTab={(t) => setActiveTab(t as any)}
            />
          </div>
        )}

        {/* Tab Step 49 Content: Notifications & Integrations Hub */}
        {activeTab === 'notifications-integrations' && (
          <div className="tab-pane-content">
            <NotificationsIntegrationsHub
              repositoryUrl={data.repository_url}
            />
          </div>
        )}



        {/* Tab Step 47 Content: Architecture Intelligence */}
        {activeTab === 'architecture-intelligence' && (
          <div className="tab-pane-content">
            <ArchitectureIntelligence
              repositoryUrl={data.repository_url}
              onNavigateTab={(t) => setActiveTab(t as any)}
            />
          </div>
        )}

        {/* Tab Step 46 Content: Smart Test Selection */}
        {activeTab === 'smart-test-selection' && (
          <div className="tab-pane-content">
            <SmartTestSelection
              repositoryUrl={data.repository_url}
              onNavigateTab={(t) => setActiveTab(t as any)}
            />
          </div>
        )}

        {/* Tab Step 42 Content: Pull Request Intelligence & Automated Change Review */}
        {activeTab === 'pull-request' && (
          <div className="tab-pane-content">
            <PullRequestIntelligence
              repositoryUrl={data.repository_url}
              onInvestigate={handleTriggerInvestigation}
              onCreateAction={handleCreateAction}
              onNavigateTab={(t) => setActiveTab(t as any)}
            />
          </div>
        )}

        {/* Tab Step 41 Content: Engineering Decision & Audit History Center */}
        {activeTab === 'audit-history' && (
          <div className="tab-pane-content">
            <EngineeringAuditHistory
              repositoryUrl={data.repository_url}
              onNavigateTab={(t) => setActiveTab(t as any)}
            />
          </div>
        )}

        {/* Tab Step 39 Content: Engineering Action Center & Remediation Workflow */}
        {activeTab === 'action-center' && (
          <div className="tab-pane-content">
            <EngineeringActionCenter
              repositoryUrl={data.repository_url}
              onInvestigate={handleTriggerInvestigation}
              selectedActionId={selectedActionId}
            />
          </div>
        )}

        {/* Tab Step 38 Content: Engineering Investigation & Drill-Down Center */}
        {activeTab === 'investigation' && (
          <div className="tab-pane-content">
            <EngineeringInvestigation
              repositoryUrl={data.repository_url}
              initialTarget={targetInvestigationTarget}
              initialTargetType={targetInvestigationType}
              onCreateAction={handleCreateAction}
            />
          </div>
        )}

        {/* Tab 0 Content: Repository Health Dashboard */}
        {activeTab === 'health' && (
          <div className="tab-pane-content">
            <RepositoryHealth
              repositoryUrl={data.repository_url}
              repoData={data}
            />
          </div>
        )}

        {/* Tab 0.5 Content: Code Quality & Complexity Engine */}
        {activeTab === 'quality' && (
          <div className="tab-pane-content">
            <CodeQuality
              repositoryUrl={data.repository_url}
              repoData={data}
            />
          </div>
        )}

        {/* Tab 0.8 Content: Step 20 Executive Audit & Summary */}
        {activeTab === 'executive' && (
          <div className="tab-pane-content">
            <ExecutiveSummary
              repositoryUrl={data.repository_url}
              repoData={data}
            />
          </div>
        )}

        {/* Tab 0.9 Content: Step 21 Repository Change Detection */}
        {activeTab === 'diff' && (
          <div className="tab-pane-content">
            <ChangeDetection
              repositoryUrl={data.repository_url}
              repoData={data}
            />
          </div>
        )}

        {/* Tab 0.95 Content: Step 22 Git Commit Analysis */}
        {activeTab === 'commit' && (
          <div className="tab-pane-content">
            <CommitAnalysis
              repositoryUrl={data.repository_url}
              repoData={data}
              onTriggerImpactAnalysis={handleTriggerImpactFromCommit}
            />
          </div>
        )}

        {/* Tab 0.98 Content: Step 23 Test Impact Analysis */}
        {activeTab === 'test-impact' && (
          <div className="tab-pane-content">
            <TestImpact
              repositoryUrl={data.repository_url}
              repoData={data}
              initialChangedFile={targetImpactFile}
              initialChangedFunc={targetImpactFunc}
            />
          </div>
        )}

        {/* Tab Step 25 Content: Deterministic Regression Risk Analysis */}
        {activeTab === 'regression-risk' && (
          <div className="tab-pane-content">
            <RegressionRisk
              repositoryUrl={data.repository_url}
              repoData={data}
              initialChangedFile={targetImpactFile}
              initialChangedFunc={targetImpactFunc}
            />
          </div>
        )}

        {/* Tab Step 26 Content: Intelligent Change Risk Explanation */}
        {activeTab === 'change-risk-explanation' && (
          <div className="tab-pane-content">
            <ChangeRiskExplanation
              repositoryUrl={data.repository_url}
              repoData={data}
              initialChangedFile={targetImpactFile}
              initialChangedFunc={targetImpactFunc}
            />
          </div>
        )}

        {/* Tab Step 27 Content: Intelligent Change Decision Engine */}
        {activeTab === 'change-decision' && (
          <div className="tab-pane-content">
            <ChangeDecision
              repositoryUrl={data.repository_url}
              repoData={data}
              initialChangedFile={targetImpactFile}
              initialChangedFunc={targetImpactFunc}
            />
          </div>
        )}

        {/* Tab Step 28 Content: Historical Risk & Revision Comparison */}
        {activeTab === 'historical-risk' && (
          <div className="tab-pane-content">
            <HistoricalRisk
              repositoryUrl={data.repository_url}
              repoData={data}
            />
          </div>
        )}

        {/* Tab Step 29 Content: Repository Refresh & Change Tracking */}
        {activeTab === 'repo-tracking' && (
          <div className="tab-pane-content">
            <RepoRefreshTracking
              repositoryUrl={data.repository_url}
              repoData={data}
            />
          </div>
        )}

        {/* Tab Step 30 Content: Continuous Repository Monitoring & Risk Alerts */}
        {activeTab === 'repo-monitoring' && (
          <div className="tab-pane-content">
            <RepoMonitoring
              repositoryUrl={data.repository_url}
              repoData={data}
            />
          </div>
        )}

        {/* Tab Step 32 Content: Multi-Repository Monitoring Dashboard */}
        {activeTab === 'multi-repo' && (
          <div className="tab-pane-content">
            <MultiRepoDashboard
              initialRepoUrl={data.repository_url}
            />
          </div>
        )}

        {/* Tab Step 33 Content: Repository Deployment Readiness & Release Risk Gating Engine */}
        {activeTab === 'release-gating' && (
          <div className="tab-pane-content">
            <ReleaseGatingEngine
              repositoryUrl={data.repository_url}
            />
          </div>
        )}

        {/* Tab Step 34 Content: Engineering Governance & Professional Repository Health Center */}
        {activeTab === 'engineering-governance' && (
          <div className="tab-pane-content">
            <EngineeringGovernance
              repositoryUrl={data.repository_url}
            />
          </div>
        )}

        {/* Tab Step 35 Content: Engineering Trend & Historical Intelligence Dashboard */}
        {activeTab === 'historical-intelligence' && (
          <div className="tab-pane-content">
            <HistoricalIntelligence
              repositoryUrl={data.repository_url}
            />
          </div>
        )}

        {/* Tab Step 36 Content: Repository Comparison & Benchmarking Engine */}
        {activeTab === 'repo-comparison' && (
          <div className="tab-pane-content">
            <RepositoryComparison
              initialRepoUrl={data.repository_url}
            />
          </div>
        )}

        {/* Tab 1 Content: Python Files & AST Breakdown */}
        {activeTab === 'ast' && (
          <div className="tab-pane-content">
            {filteredPythonFiles.length === 0 ? (
              <div className="empty-state">
                <p>No Python files found matching &quot;{searchTerm}&quot;.</p>
              </div>
            ) : (
              <div className="python-files-list">
                {filteredPythonFiles.map((fileObj) => {
                  const isExpanded = expandedFile === fileObj.file;
                  return (
                    <div key={fileObj.file} className={`python-file-item ${isExpanded ? 'expanded' : ''}`}>
                      <div className="python-file-header" onClick={() => toggleExpand(fileObj.file)}>
                        <div className="python-file-title">
                          <svg className="file-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                          </svg>
                          <span className="file-path">{fileObj.file}</span>
                        </div>
                        <div className="python-file-badges">
                          <span className="badge badge-fn">{fileObj.functions.length} funcs</span>
                          <span className="badge badge-cls">{fileObj.classes.length} classes</span>
                          <span className="badge badge-imp">{fileObj.imports.length} imports</span>
                          <button
                            type="button"
                            className="btn-quick-impact"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTriggerImpact(fileObj.file);
                            }}
                          >
                            Analyze Impact &rarr;
                          </button>
                          <svg className={`chevron-icon ${isExpanded ? 'rotated' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </div>
                      </div>

                      {/* Expandable AST details */}
                      {isExpanded && (
                        <div className="ast-detail-body">
                          {/* Functions */}
                          <div className="ast-section">
                            <div className="ast-section-header">
                              <span className="ast-label font-fn">Functions ({fileObj.functions.length})</span>
                            </div>
                            {fileObj.functions.length > 0 ? (
                              <div className="ast-tags-grid">
                                {fileObj.functions.map((fn, idx) => (
                                  <button
                                    key={`${fn}-${idx}`}
                                    type="button"
                                    className="ast-tag tag-fn tag-clickable"
                                    onClick={() => handleTriggerImpact(fileObj.file, fn)}
                                    title="Click to analyze change impact for this function"
                                  >
                                    def {fn}() &rarr;
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="ast-none">None extracted</span>
                            )}
                          </div>

                          {/* Classes */}
                          <div className="ast-section">
                            <div className="ast-section-header">
                              <span className="ast-label font-cls">Classes ({fileObj.classes.length})</span>
                            </div>
                            {fileObj.classes.length > 0 ? (
                              <div className="ast-tags-grid">
                                {fileObj.classes.map((cls, idx) => (
                                  <span key={`${cls}-${idx}`} className="ast-tag tag-cls">
                                    class {cls}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="ast-none">None extracted</span>
                            )}
                          </div>

                          {/* Imports */}
                          <div className="ast-section">
                            <div className="ast-section-header">
                              <span className="ast-label font-imp">Imports ({fileObj.imports.length})</span>
                            </div>
                            {fileObj.imports.length > 0 ? (
                              <div className="ast-tags-grid">
                                {fileObj.imports.map((imp, idx) => (
                                  <span key={`${imp}-${idx}`} className="ast-tag tag-imp">
                                    import {imp}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="ast-none">None extracted</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2 Content: Dependency Graph Visualization */}
        {activeTab === 'graph' && (
          <div className="tab-pane-content">
            <DependencyGraph
              dependencyGraph={dependencyGraph}
              searchTerm={searchTerm}
              onTriggerImpact={handleTriggerImpactFromCommit}
            />
          </div>
        )}

        {/* Tab Content: Impact Analysis Engine */}
        {activeTab === 'impact' && (
          <div className="tab-pane-content">
            <ImpactAnalysis
              repositoryUrl={data.repository_url}
              pythonFiles={pythonFiles}
              initialFile={targetImpactFile}
              initialFunction={targetImpactFunc}
            />
          </div>
        )}

        {/* Tab Content: Code Change Simulation */}
        {activeTab === 'simulate' && (
          <div className="tab-pane-content">
            <ChangeSimulation
              repositoryUrl={data.repository_url}
              pythonFiles={pythonFiles}
              initialFile={targetImpactFile}
              initialFunction={targetImpactFunc}
            />
          </div>
        )}

        {/* Tab Content: Step 16 Code Change Simulator */}
        {activeTab === 'simulator' && (
          <div className="tab-pane-content">
            <CodeChangeSimulator
              repositoryUrl={data.repository_url}
            />
          </div>
        )}
      </div>
    </div>
  );
};
