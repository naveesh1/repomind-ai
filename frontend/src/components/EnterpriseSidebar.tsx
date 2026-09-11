import React, { useState } from 'react';

export interface NavCategory {
  title: string;
  items: {
    key: string;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }[];
}

interface EnterpriseSidebarProps {
  activeTab: string;
  onSelectTab: (tabKey: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const EnterpriseSidebar: React.FC<EnterpriseSidebarProps> = ({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
}) => {
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    'OVERVIEW': true,
    'REPOSITORY INTELLIGENCE': true,
    'CHANGE & PR INTELLIGENCE': true,
    'ENGINEERING INTELLIGENCE': true,
    'TESTING & QUALITY': true,
    'ANALYTICS': true,
    'GOVERNANCE & SECURITY': true,
    'NOTIFICATIONS': true,
  });

  const toggleCategory = (catTitle: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [catTitle]: !prev[catTitle],
    }));
  };

  const categories: NavCategory[] = [
    {
      title: 'OVERVIEW',
      items: [
        {
          key: 'dashboard',
          label: 'Main Dashboard',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
              <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
              <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
              <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
            </svg>
          ),
          badge: 'HQ',
        },
        {
          key: 'command-center',
          label: 'Command Center',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          ),
        },
        {
          key: 'unified-intelligence',
          label: 'Unified Intelligence',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          ),
        },
      ],
    },
    {
      title: 'REPOSITORY INTELLIGENCE',
      items: [
        {
          key: 'ast',
          label: 'Repository Analysis',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          ),
        },
        {
          key: 'health',
          label: 'Repository Health',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          ),
        },
        {
          key: 'multi-repo',
          label: 'Multi-Repo Dashboard',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          ),
        },
        {
          key: 'repo-comparison',
          label: 'Repository Benchmarking',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          ),
        },
      ],
    },
    {
      title: 'CHANGE & PR INTELLIGENCE',
      items: [
        {
          key: 'pull-request',
          label: 'Pull Request Intelligence',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="18" r="3"></circle>
              <circle cx="6" cy="6" r="3"></circle>
              <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
              <line x1="6" y1="9" x2="6" y2="21"></line>
            </svg>
          ),
        },
        {
          key: 'impact',
          label: 'Impact Analysis',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="6"></circle>
              <circle cx="12" cy="12" r="2"></circle>
            </svg>
          ),
        },
        {
          key: 'diff',
          label: 'Change Detection',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"></path>
            </svg>
          ),
        },
        {
          key: 'commit',
          label: 'Git Commit Analysis',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4"></circle>
              <line x1="1.05" y1="12" x2="8" y2="12"></line>
              <line x1="16" y1="12" x2="22.95" y2="12"></line>
            </svg>
          ),
        },
        {
          key: 'regression-risk',
          label: 'Regression Risk',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          ),
        },
        {
          key: 'change-risk-explanation',
          label: 'Change Risk Explanation',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
            </svg>
          ),
        },
      ],
    },
    {
      title: 'ENGINEERING INTELLIGENCE',
      items: [
        {
          key: 'architecture-intelligence',
          label: 'Architecture Intelligence',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4"></path>
            </svg>
          ),
        },
        {
          key: 'graph',
          label: 'Dependency Graph',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
          ),
        },
        {
          key: 'quality',
          label: 'Code Quality & Complexity',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          ),
        },
        {
          key: 'copilot',
          label: 'Engineering AI Copilot',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          ),
          badge: 'AI',
        },
      ],
    },
    {
      title: 'TESTING & QUALITY',
      items: [
        {
          key: 'smart-test-selection',
          label: 'Smart Test Selection',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          ),
        },
        {
          key: 'test-impact',
          label: 'Test Impact Analysis',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          ),
        },
        {
          key: 'historical-risk',
          label: 'Historical Test Results',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          ),
        },
      ],
    },
    {
      title: 'ANALYTICS',
      items: [
        {
          key: 'advanced-analytics',
          label: 'Advanced Engineering Analytics',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          ),
        },
        {
          key: 'historical-intelligence',
          label: 'Historical Intelligence',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18"></path>
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path>
            </svg>
          ),
        },
      ],
    },
    {
      title: 'GOVERNANCE & SECURITY',
      items: [
        {
          key: 'audit-history',
          label: 'Engineering Audit History',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
          ),
        },
        {
          key: 'engineering-governance',
          label: 'Engineering Governance',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          ),
        },
        {
          key: 'investigation',
          label: 'Investigation Center',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          ),
        },
        {
          key: 'action-center',
          label: 'Engineering Action Center',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          ),
        },
        {
          key: 'release-gating',
          label: 'Release Risk Gate',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          ),
        },
      ],
    },
    {
      title: 'NOTIFICATIONS',
      items: [
        {
          key: 'notifications-integrations',
          label: 'Notifications & Integrations',
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <aside className={`ent-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="ent-sidebar-inner">
        {categories.map((category) => {
          const isOpen = openCategories[category.title] ?? true;
          return (
            <div key={category.title} className="ent-nav-group">
              {!collapsed && (
                <div
                  className="ent-nav-group-header"
                  onClick={() => toggleCategory(category.title)}
                >
                  <span className="ent-nav-group-title">{category.title}</span>
                  <svg
                    className={`ent-nav-chevron ${isOpen ? 'open' : ''}`}
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
              )}

              {(isOpen || collapsed) && (
                <div className="ent-nav-items">
                  {category.items.map((item) => {
                    const isActive = activeTab === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`ent-nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => onSelectTab(item.key)}
                        title={collapsed ? item.label : undefined}
                      >
                        <span className="ent-nav-icon">{item.icon}</span>
                        {!collapsed && <span className="ent-nav-label">{item.label}</span>}
                        {!collapsed && item.badge && (
                          <span className={`ent-nav-badge ${item.badge.toLowerCase()}`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="ent-sidebar-footer">
        <button
          type="button"
          className="ent-sidebar-collapse-toggle"
          onClick={onToggleCollapse}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'none' }}
          >
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          {!collapsed && <span>Collapse Sidebar</span>}
        </button>
      </div>
    </aside>
  );
};
