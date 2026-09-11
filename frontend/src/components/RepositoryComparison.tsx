import React, { useState, useEffect } from 'react';
import type {
  RepositoryComparisonResponse,
  RepositoryComparisonExportResponse,
  ComparedRepoSummary,
} from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface RepositoryComparisonProps {
  initialRepoUrl?: string;
}

export const RepositoryComparison: React.FC<RepositoryComparisonProps> = ({ initialRepoUrl }) => {
  const [repoUrls, setRepoUrls] = useState<string[]>([
    initialRepoUrl || 'https://github.com/psf/requests',
    'https://github.com/pallets/flask',
  ]);
  const [newUrlInput, setNewUrlInput] = useState<string>('');
  const [data, setData] = useState<RepositoryComparisonResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const runComparison = async () => {
    const validUrls = repoUrls.map((u) => u.trim()).filter((u) => u.length > 0);
    if (validUrls.length < 2) {
      setError('Please add at least 2 unique GitHub repository URLs to run benchmarking comparison.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/repository-comparison`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repository_urls: validUrls }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Comparison failed with HTTP ${res.status}`);
      }

      const json: RepositoryComparisonResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to compare repositories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialRepoUrl && !repoUrls.includes(initialRepoUrl)) {
      setRepoUrls([initialRepoUrl, 'https://github.com/pallets/flask']);
    }
  }, [initialRepoUrl]);

  useEffect(() => {
    runComparison();
  }, []);

  const handleAddRepo = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newUrlInput.trim();
    if (!trimmed) return;
    if (!trimmed.includes('github.com')) {
      alert('Please enter a valid public GitHub repository URL.');
      return;
    }
    if (repoUrls.includes(trimmed)) {
      alert('Repository is already included in the comparison list.');
      return;
    }
    setRepoUrls((prev) => [...prev, trimmed]);
    setNewUrlInput('');
  };

  const handleRemoveRepo = (urlToRemove: string) => {
    if (repoUrls.length <= 2) {
      alert('At least 2 repositories are required for comparison.');
      return;
    }
    setRepoUrls((prev) => prev.filter((u) => u !== urlToRemove));
  };

  const handleExport = async (format: 'json' | 'markdown' | 'html') => {
    if (!data) return;
    setExporting(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/repository-comparison/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository_urls: repoUrls,
          export_format: format,
        }),
      });

      if (!res.ok) {
        throw new Error(`Export failed with HTTP ${res.status}`);
      }

      const result: RepositoryComparisonExportResponse = await res.json();
      let blobContent: string;
      if (format === 'json') {
        blobContent = typeof result.content === 'object' ? JSON.stringify(result.content, null, 2) : String(result.content);
      } else {
        blobContent = String(result.content);
      }

      const blob = new Blob([blobContent], { type: result.content_type || 'text/plain' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = result.filename || `repository_comparison.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(`Export Error: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#38bdf8';
    if (score >= 40) return '#eab308';
    return '#ef4444';
  };

  return (
    <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#0f172a', borderRadius: '12px', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📊 Repository Benchmarking &amp; Comparison Engine</span>
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            Step 36: Side-by-side engineering intelligence, benchmark scores, metric leaders, and gap analysis across repositories.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !data}
            onClick={() => handleExport('json')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'json' ? 'Exporting...' : '📄 Export JSON'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !data}
            onClick={() => handleExport('markdown')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'markdown' ? 'Exporting...' : '📝 Export MD'}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={exporting !== null || !data}
            onClick={() => handleExport('html')}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            {exporting === 'html' ? 'Exporting...' : '🌐 Export HTML'}
          </button>
        </div>
      </div>

      {/* Repository Selector / Input Section */}
      <div style={{ marginTop: '1.25rem', padding: '1rem', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: '#f8fafc' }}>
          Compare Repositories ({repoUrls.length} selected)
        </h4>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {repoUrls.map((url, idx) => (
            <div
              key={idx}
              style={{
                background: '#0f172a',
                border: '1px solid #38bdf8',
                borderRadius: '6px',
                padding: '0.35rem 0.7rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{url}</span>
              {repoUrls.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveRepo(url)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleAddRepo} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="url"
            placeholder="Add another GitHub repository URL (e.g. https://github.com/torvalds/linux)"
            value={newUrlInput}
            onChange={(e) => setNewUrlInput(e.target.value)}
            style={{ flex: 1, minWidth: '280px', padding: '0.45rem 0.75rem', background: '#0f172a', border: '1px solid #475569', borderRadius: '6px', color: '#f8fafc', fontSize: '0.85rem' }}
          />
          <button type="submit" className="btn-secondary" style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}>
            ➕ Add Repo
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={loading}
            onClick={runComparison}
            style={{ fontSize: '0.8rem', padding: '0.45rem 1.2rem', background: '#0284c7' }}
          >
            {loading ? 'Analyzing...' : '⚡ Compare Repositories'}
          </button>
        </form>
      </div>

      {error && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#450a0a', border: '1px solid #ef4444', borderRadius: '6px', color: '#fca5a5', fontSize: '0.85rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Winner Hero Card */}
      {data && data.rankings.length > 0 && (
        <div style={{ marginTop: '1.25rem', padding: '1.25rem', background: '#1e293b', border: '2px solid #22c55e', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>🏆 Overall Engineering Winner</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#22c55e', marginTop: '0.25rem' }}>
                {data.overall_winner}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ background: '#0f172a', padding: '0.6rem 1.2rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Benchmark Score</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e' }}>{data.rankings[0].benchmark_score} / 100</div>
              </div>
              <div style={{ background: '#0f172a', padding: '0.6rem 1.2rem', borderRadius: '6px', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Strongest Metric</span>
                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.25rem' }}>{data.rankings[0].strongest_metric}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Engineering Benchmark Score Cards */}
      {data && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.75rem' }}>🥇 Repository Benchmark Score Cards</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {data.rankings.map((repo: ComparedRepoSummary) => (
              <div
                key={repo.full_name}
                style={{
                  background: '#1e293b',
                  border: repo.rank === 1 ? '2px solid #22c55e' : '1px solid #334155',
                  borderRadius: '10px',
                  padding: '1.1rem',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span
                    style={{
                      background: repo.rank === 1 ? '#15803d' : '#334155',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '4px',
                    }}
                  >
                    #{repo.rank} Rank
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontFamily: 'monospace' }}>{repo.release_gate_status}</span>
                </div>

                <h4 style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '1.1rem', color: '#38bdf8' }}>{repo.full_name}</h4>

                <div style={{ margin: '0.75rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#94a3b8' }}>Engineering Benchmark Score:</span>
                    <strong style={{ color: getScoreColor(repo.benchmark_score) }}>{repo.benchmark_score} / 100</strong>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#0f172a', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${repo.benchmark_score}%`, height: '100%', background: getScoreColor(repo.benchmark_score) }} />
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.75rem', color: '#cbd5e1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Governance Score:</span>
                    <strong>{repo.governance_score}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Risk Safety:</span>
                    <strong>{repo.risk_safety_score}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Code Quality:</span>
                    <strong>{repo.code_quality}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Strongest Metric:</span>
                    <strong style={{ color: '#22c55e' }}>{repo.strongest_metric}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Weakest Metric:</span>
                    <strong style={{ color: '#ef4444' }}>{repo.weakest_metric}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Table */}
      {data && (
        <div style={{ marginTop: '1.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', marginBottom: '0.75rem' }}>📋 Side-by-Side Benchmarking Table</h3>
          <div style={{ overflowX: 'auto', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', background: '#0f172a' }}>
                  <th style={{ padding: '0.75rem' }}>Rank</th>
                  <th style={{ padding: '0.75rem' }}>Repository</th>
                  <th style={{ padding: '0.75rem' }}>Benchmark Score</th>
                  <th style={{ padding: '0.75rem' }}>Gov Score</th>
                  <th style={{ padding: '0.75rem' }}>Risk Safety</th>
                  <th style={{ padding: '0.75rem' }}>Health</th>
                  <th style={{ padding: '0.75rem' }}>Quality</th>
                  <th style={{ padding: '0.75rem' }}>Testing</th>
                  <th style={{ padding: '0.75rem' }}>Monitoring</th>
                  <th style={{ padding: '0.75rem' }}>Release Gate</th>
                </tr>
              </thead>
              <tbody>
                {data.rankings.map((repo: ComparedRepoSummary) => (
                  <tr key={repo.full_name} style={{ borderBottom: '1px solid #0f172a' }}>
                    <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#38bdf8' }}>#{repo.rank}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#f8fafc' }}>{repo.full_name}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 'bold', color: getScoreColor(repo.benchmark_score) }}>
                      {repo.benchmark_score}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{repo.governance_score}</td>
                    <td style={{ padding: '0.75rem' }}>{repo.risk_safety_score}</td>
                    <td style={{ padding: '0.75rem' }}>{repo.repository_health}</td>
                    <td style={{ padding: '0.75rem' }}>{repo.code_quality}</td>
                    <td style={{ padding: '0.75rem' }}>{repo.testing_health_score}</td>
                    <td style={{ padding: '0.75rem' }}>{repo.monitoring_score}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ color: repo.release_gate_status === 'APPROVED_FOR_RELEASE' ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                        {repo.release_gate_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Metric Leaders & Gaps */}
      {data && (
        <div style={{ marginTop: '1.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#22c55e', fontSize: '0.95rem' }}>👑 Metric Leaders</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
              {data.metric_leaders.map((leader, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.4rem 0.75rem', borderRadius: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>{leader.metric}:</span>
                  <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{leader.leader} ({leader.score}/100)</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.75rem 0', color: '#eab308', fontSize: '0.95rem' }}>📐 Metric Divergence &amp; Gaps</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
              {data.metric_gaps.map((gap, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: '#0f172a', padding: '0.4rem 0.75rem', borderRadius: '6px' }}>
                  <span style={{ color: '#94a3b8' }}>{gap.metric}:</span>
                  <span style={{ fontWeight: 'bold', color: gap.gap >= 15 ? '#ef4444' : '#22c55e' }}>
                    {gap.gap} pts gap ({gap.highest_score} vs {gap.lowest_score})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Comparison Insights */}
      {data && (
        <div style={{ marginTop: '1.75rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', margin: '0 0 0.75rem 0' }}>💡 Deterministic Comparison Insights</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
            {data.insights.map((ins, idx) => (
              <div key={idx} style={{ background: '#0f172a', padding: '0.6rem 0.9rem', borderRadius: '6px', borderLeft: '3px solid #38bdf8' }}>
                {ins}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
