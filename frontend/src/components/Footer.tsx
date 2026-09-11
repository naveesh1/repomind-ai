import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <strong>RepoMind AI</strong> &mdash; AI-Powered Software Change Impact &amp; Regression Risk Analyzer
        </div>
        <div>&copy; {new Date().getFullYear()} RepoMind AI. All rights reserved.</div>
      </div>
    </footer>
  );
};
