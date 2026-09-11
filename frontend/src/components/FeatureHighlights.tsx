import React from 'react';
import type { FeatureCardItem } from '../types';

const features: FeatureCardItem[] = [
  {
    id: '1',
    title: 'Impact Radius Graph',
    description: 'Trace code dependencies and pinpoint affected downstream modules before making changes.',
    iconName: 'graph',
  },
  {
    id: '2',
    title: 'Regression Risk Score',
    description: 'Quantify potential breakage probability across test suites and core API signatures.',
    iconName: 'risk',
  },
  {
    id: '3',
    title: 'Change Scope Analysis',
    description: 'Inspect exact AST paths, function calls, and shared state mutations in real time.',
    iconName: 'scope',
  },
  {
    id: '4',
    title: 'CI/CD Pipeline Check',
    description: 'Integrate automated safety checks into your pull requests to prevent broken builds.',
    iconName: 'ci',
  },
];

const renderIcon = (name: FeatureCardItem['iconName']) => {
  switch (name) {
    case 'graph':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
        </svg>
      );
    case 'risk':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      );
    case 'scope':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      );
    case 'ci':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      );
  }
};

export const FeatureHighlights: React.FC = () => {
  return (
    <section className="features-section">
      <div className="container">
        <h2 className="section-title">
          Engineered for <span className="gradient-text">High-Velocity Teams</span>
        </h2>
        <div className="features-grid">
          {features.map((feature) => (
            <div key={feature.id} className="feature-card">
              <div className="feature-icon-wrapper">{renderIcon(feature.iconName)}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
