import React, { useState } from 'react';
import type { AnalyzeApiRequest, AnalyzeApiResponse, RepoAnalysisFormState } from '../types';
import { AnalysisResults } from './AnalysisResults';

const API_BASE_URL = 'http://127.0.0.1:8000';

export const RepoInputForm: React.FC = () => {
  const [formState, setFormState] = useState<RepoAnalysisFormState>({
    repoUrl: '',
    isSubmitting: false,
    error: null,
    apiResponse: null,
  });

  const handleSubmit = async (e?: React.FormEvent | React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const url = formState.repoUrl.trim();

    if (!url) {
      setFormState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: 'Please enter a valid GitHub repository URL.',
        apiResponse: null,
      }));
      return;
    }

    if (!url.includes('github.com')) {
      setFormState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: 'Target repository should be a valid GitHub URL (e.g., https://github.com/owner/repository).',
        apiResponse: null,
      }));
      return;
    }

    setFormState((prev) => ({
      ...prev,
      isSubmitting: true,
      error: null,
      apiResponse: null,
    }));

    try {
      const payload: AnalyzeApiRequest = { repository_url: url };
      if (formState.githubToken && formState.githubToken.trim()) {
        payload.github_token = formState.githubToken.trim();
      }

      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = `Server returned error status ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData && errorData.detail) {
            if (typeof errorData.detail === 'string') {
              errorMessage = errorData.detail;
            } else if (typeof errorData.detail === 'object') {
              errorMessage = JSON.stringify(errorData.detail);
            }
          } else if (errorData && errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Standard status error message retained
        }
        throw new Error(errorMessage);
      }

      const data: AnalyzeApiResponse = await response.json();
      setFormState((prev) => ({
        ...prev,
        repoUrl: url,
        isSubmitting: false,
        error: null,
        apiResponse: data,
      }));
    } catch (err: any) {
      const displayMsg =
        typeof err === 'string'
          ? err
          : err?.message ||
            'Failed to analyze repository. Ensure the FastAPI backend is running on http://127.0.0.1:8000.';

      setFormState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: displayMsg,
        apiResponse: null,
      }));
    } finally {
      setFormState((prev) => ({
        ...prev,
        isSubmitting: false,
      }));
    }
  };

  return (
    <div className="form-card-wrapper">
      <div className="form-card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSubmit(e);
          }}
        >
          <div className="input-group">
            <div className="input-wrapper">
              <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
                <path d="M9 18c-4.51 2-5-2-7-2"></path>
              </svg>
              <input
                type="text"
                className="repo-input"
                name="repository_url"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://github.com/owner/repository"
                value={formState.repoUrl}
                disabled={formState.isSubmitting}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    repoUrl: e.target.value,
                    error: null,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSubmit(e);
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={formState.isSubmitting}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit(e);
              }}
            >
              {formState.isSubmitting ? (
                <>
                  <span>Cloning &amp; Ingesting...</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-icon">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                  </svg>
                </>
              ) : (
                <>
                  <span>Analyze Repository</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </>
              )}
            </button>
          </div>

          <div className="public-repo-badge" style={{ marginTop: '10px', fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <span>Public GitHub repositories do not require authentication.</span>
          </div>

          <div className="advanced-auth-toggle-wrapper" style={{ marginTop: '12px' }}>
            <button
              type="button"
              className="btn-link-toggle"
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
              onClick={() => setFormState((prev) => ({ ...prev, showAdvancedAuth: !prev.showAdvancedAuth }))}
            >
              <span>{formState.showAdvancedAuth ? 'Hide Private Repository Authentication' : 'Optional Private Repository Authentication'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: formState.showAdvancedAuth ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {formState.showAdvancedAuth && (
              <div className="advanced-auth-container" style={{ marginTop: '8px', padding: '10px 12px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '6px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#cbd5e1', marginBottom: '4px' }}>
                  GitHub Personal Access Token (Optional for Private Repositories or Rate Limits)
                </label>
                <input
                  type="password"
                  className="repo-token-input"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={formState.githubToken || ''}
                  onChange={(e) => setFormState((prev) => ({ ...prev, githubToken: e.target.value }))}
                  style={{ width: '100%', padding: '6px 10px', fontSize: '13px', background: '#0f172a', border: '1px solid #334155', borderRadius: '4px', color: '#f8fafc' }}
                />
              </div>
            )}
          </div>

          {formState.error && (
            <div className="form-feedback feedback-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{formState.error}</span>
            </div>
          )}
        </form>
      </div>

      {formState.apiResponse && !formState.error && (
        <AnalysisResults data={formState.apiResponse} />
      )}
    </div>
  );
};
