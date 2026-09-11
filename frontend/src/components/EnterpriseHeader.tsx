import React, { useState } from 'react';

interface EnterpriseHeaderProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  activeRepoUrl?: string;
  apiOnline?: boolean;
  onSearchSelect?: (tabKey: string) => void;
}

export const EnterpriseHeader: React.FC<EnterpriseHeaderProps> = ({
  sidebarCollapsed,
  onToggleSidebar,
  activeRepoUrl,
  apiOnline = true,
  onSearchSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const navItems = [
    { label: 'Main Dashboard', key: 'dashboard', category: 'Overview' },
    { label: 'Command Center', key: 'command-center', category: 'Overview' },
    { label: 'Unified Engineering Intelligence', key: 'unified-intelligence', category: 'Overview' },
    { label: 'Repository Analysis', key: 'ast', category: 'Repository Intelligence' },
    { label: 'Repository Health', key: 'health', category: 'Repository Intelligence' },
    { label: 'Multi-Repo Dashboard', key: 'multi-repo', category: 'Repository Intelligence' },
    { label: 'Repository Benchmarking', key: 'repo-comparison', category: 'Repository Intelligence' },
    { label: 'Pull Request Intelligence', key: 'pull-request', category: 'Change & PR' },
    { label: 'Impact Analysis', key: 'impact', category: 'Change & PR' },
    { label: 'Change Detection', key: 'diff', category: 'Change & PR' },
    { label: 'Git Commit Analysis', key: 'commit', category: 'Change & PR' },
    { label: 'Regression Risk', key: 'regression-risk', category: 'Change & PR' },
    { label: 'Change Risk Explanation', key: 'change-risk-explanation', category: 'Change & PR' },
    { label: 'Architecture Intelligence', key: 'architecture-intelligence', category: 'Engineering Intelligence' },
    { label: 'Dependency Graph', key: 'graph', category: 'Engineering Intelligence' },
    { label: 'Code Quality & Complexity', key: 'quality', category: 'Engineering Intelligence' },
    { label: 'Engineering AI Copilot', key: 'copilot', category: 'Engineering Intelligence' },
    { label: 'Smart Test Selection', key: 'smart-test-selection', category: 'Testing & Quality' },
    { label: 'Test Impact Analysis', key: 'test-impact', category: 'Testing & Quality' },
    { label: 'Historical Test Results', key: 'historical-risk', category: 'Testing & Quality' },
    { label: 'Advanced Engineering Analytics', key: 'advanced-analytics', category: 'Analytics' },
    { label: 'Historical Intelligence', key: 'historical-intelligence', category: 'Analytics' },
    { label: 'Engineering Audit History', key: 'audit-history', category: 'Governance & Security' },
    { label: 'Engineering Governance', key: 'engineering-governance', category: 'Governance & Security' },
    { label: 'Investigation Center', key: 'investigation', category: 'Governance & Security' },
    { label: 'Engineering Action Center', key: 'action-center', category: 'Governance & Security' },
    { label: 'Release Risk Gate', key: 'release-gating', category: 'Governance & Security' },
    { label: 'Notifications & Integrations', key: 'notifications-integrations', category: 'Notifications' },
  ];

  const filteredItems = searchQuery.trim()
    ? navItems.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <header className="ent-header">
      <div className="ent-header-left">
        <button
          type="button"
          className="ent-sidebar-toggle-btn"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <a href="/" className="ent-brand">
          <div className="ent-brand-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div className="ent-brand-text">
            <span className="ent-brand-title">RepoMind AI</span>
            <span className="ent-brand-subtitle">AI-Powered Software Engineering Intelligence Platform</span>
          </div>
        </a>
      </div>

      <div className="ent-header-center">
        <div className="ent-search-wrapper">
          <svg className="ent-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="ent-search-input"
            placeholder="Search modules, features, metrics (Ctrl + K)..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(true);
            }}
            onFocus={() => setShowSearchDropdown(true)}
            onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
          />
          <kbd className="ent-search-kbd">Ctrl K</kbd>

          {showSearchDropdown && filteredItems.length > 0 && (
            <div className="ent-search-dropdown">
              {filteredItems.map((item) => (
                <div
                  key={item.key}
                  className="ent-search-dropdown-item"
                  onClick={() => {
                    if (onSearchSelect) onSearchSelect(item.key);
                    setSearchQuery('');
                    setShowSearchDropdown(false);
                  }}
                >
                  <span className="ent-search-item-label">{item.label}</span>
                  <span className="ent-search-item-cat">{item.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="ent-header-right">
        {activeRepoUrl ? (
          <div className="ent-active-repo-badge" title={activeRepoUrl}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
            </svg>
            <span className="ent-repo-name-text">
              {activeRepoUrl.replace('https://github.com/', '')}
            </span>
          </div>
        ) : null}

        <div className="ent-status-badge">
          {apiOnline && <span className="ent-status-dot"></span>}
          <span>FastAPI Engine</span>
        </div>

        <div className="ent-user-pill">
          <div className="ent-avatar">EA</div>
          <span className="ent-user-name">Engineering Admin</span>
        </div>
      </div>
    </header>
  );
};
