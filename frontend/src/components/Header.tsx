import React from 'react';
import type { StatusBadgeProps } from '../types';

export const Header: React.FC<StatusBadgeProps> = ({ label = 'FastAPI API Ready', online = true }) => {
  return (
    <header className="app-header">
      <div className="container header-content">
        <a href="/" className="brand-logo">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="logo-text">RepoMind AI</span>
        </a>

        <div className="header-actions">
          <div className="nav-badge">
            {online && <span className="pulse-dot"></span>}
            <span>{label}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
