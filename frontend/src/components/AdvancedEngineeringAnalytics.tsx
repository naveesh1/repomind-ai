import React, { useState, useEffect } from 'react';
import type { AdvancedAnalyticsResponse } from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface AdvancedEngineeringAnalyticsProps {
  repositoryUrl: string;
  onNavigateTab?: (tab: string) => void;
}

export const AdvancedEngineeringAnalytics: React.FC<AdvancedEngineeringAnalyticsProps> = ({
  repositoryUrl,
  onNavigateTab: _onNavigateTab,
}) => {
  const [data, setData] = useState<AdvancedAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [timeHorizon, setTimeHorizon] = useState<'7d' | '30d' | '90d'>('30d');
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  const [activeTrendTab, setActiveTrendTab] = useState<'health' | 'pr' | 'test' | 'architecture' | 'governance'>('health');

  const fetchAnalytics = async (horizon: string) => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        repository_url: repositoryUrl,
        time_horizon: horizon,
      });
      const res = await fetch(`${API_BASE_URL}/api/advanced-engineering-analytics?${queryParams.toString()}`, {
        headers: { 'X-API-Key': 'key_dev_secret_789' },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `Server error HTTP ${res.status}`);
      }

      const json: AdvancedAnalyticsResponse = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch advanced engineering analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repositoryUrl) {
      fetchAnalytics(timeHorizon);
    }
  }, [repositoryUrl, timeHorizon]);

  const handleHorizonChange = (horizon: '7d' | '30d' | '90d') => {
    setTimeHorizon(horizon);
  };

  const handleExport = async (format: 'json' | 'markdown' | 'csv') => {
    if (!data) return;
    setExportingFormat(format);
    try {
      const res = await fetch(`${API_BASE_URL}/api/advanced-engineering-analytics/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'key_dev_secret_789',
        },
        body: JSON.stringify({
          repository_url: repositoryUrl,
          time_horizon: timeHorizon,
          export_format: format,
        }),
      });

      if (!res.ok) throw new Error(`Export HTTP ${res.status}`);
      const exportRes = await res.json();

      let blob: Blob;
      let filename = exportRes.filename || `analytics_${timeHorizon}.${format}`;

      if (format === 'json') {
        blob = new Blob([JSON.stringify(exportRes.data || data, null, 2)], { type: 'application/json' });
      } else if (format === 'csv') {
        blob = new Blob([exportRes.content || ''], { type: 'text/csv' });
      } else {
        blob = new Blob([exportRes.content || ''], { type: 'text/markdown' });
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportingFormat(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-8 text-center bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl">
        <div className="inline-block w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-xl font-semibold text-slate-200">Aggregating Engineering Analytics & Trends...</h3>
        <p className="text-sm text-slate-400 mt-2">
          Synthesizing historical SSoT data across PRs, Test Selection, Architecture & Governance...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-950/40 border border-red-800/60 rounded-2xl text-red-200">
        <h3 className="text-lg font-bold flex items-center gap-2">⚠️ Analytics Engine Error</h3>
        <p className="text-sm mt-2">{error}</p>
        <button
          onClick={() => fetchAnalytics(timeHorizon)}
          className="mt-4 px-4 py-2 bg-red-800/60 hover:bg-red-700/60 text-white font-medium rounded-lg text-xs transition"
        >
          🔄 Retry Analysis
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { executive_summary: exec, test_effectiveness_index: testEff, time_series_trends: trends, actionable_insights: insights } = data;

  const getSeverityBadge = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'MEDIUM':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      default:
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold rounded-full uppercase tracking-wider">
                Step 48 SSoT Engine
              </span>
              <span className="text-xs text-slate-400">Horizon: {data.time_horizon.toUpperCase()}</span>
            </div>
            <h2 className="text-2xl font-bold text-white mt-2 flex items-center gap-2">
              📈 Advanced Engineering Analytics
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Cross-engine engineering metrics, historical risk trends, test-selection impact, and architecture health.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Time Horizon Selector */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-1 flex items-center gap-1">
              {(['7d', '30d', '90d'] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => handleHorizonChange(h)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    timeHorizon === h
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {h.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Export Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleExport('markdown')}
                disabled={!!exportingFormat}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
              >
                📥 Markdown
              </button>
              <button
                onClick={() => handleExport('csv')}
                disabled={!!exportingFormat}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
              >
                📊 CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                disabled={!!exportingFormat}
                className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-lg text-xs font-medium transition flex items-center gap-1.5"
              >
                ⚡ JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Overall Engineering Score */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Overall Engineering Score</div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-white">{exec.overall_engineering_score}</div>
            <div className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              / 100
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${exec.overall_engineering_score}%` }}
            />
          </div>
        </div>

        {/* KPI 2: Regression Risk */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Regression Risk Score</div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-amber-400">{exec.regression_risk}</div>
            <div className="text-xs font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              / 100
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${exec.regression_risk}%` }}
            />
          </div>
        </div>

        {/* KPI 3: Smart Test Suite Reduction */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Test Suite Reduction</div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-indigo-400">{exec.test_reduction_percentage}%</div>
            <div className="text-xs font-semibold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              {testEff.effectiveness_rating}
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${exec.test_reduction_percentage}%` }}
            />
          </div>
        </div>

        {/* KPI 4: Architecture Health */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Architecture Health</div>
          <div className="mt-2 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-cyan-400">{exec.architecture_health_score}</div>
            <div className="text-xs font-semibold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              {exec.release_gate_status}
            </div>
          </div>
          <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-cyan-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${exec.architecture_health_score}%` }}
            />
          </div>
        </div>
      </div>

      {/* Time-Series Trend Visualizers Panel */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-6">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              📉 Historical Time-Series Trends ({data.time_horizon.toUpperCase()})
            </h3>
            <p className="text-xs text-slate-400">
              Track longitudinal shifts across engineering quality, velocity, testing efficiency, and coupling.
            </p>
          </div>

          {/* Trend Sub-tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 flex-wrap">
            <button
              onClick={() => setActiveTrendTab('health')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTrendTab === 'health' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Health & Risk
            </button>
            <button
              onClick={() => setActiveTrendTab('pr')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTrendTab === 'pr' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              PR Velocity
            </button>
            <button
              onClick={() => setActiveTrendTab('test')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTrendTab === 'test' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Test Savings
            </button>
            <button
              onClick={() => setActiveTrendTab('architecture')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTrendTab === 'architecture' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Architecture
            </button>
          </div>
        </div>

        {/* Tab Content Display */}
        {activeTrendTab === 'health' && trends.health_and_risk_trend && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                <div className="text-xs font-semibold text-slate-300 mb-2">Overall Engineering Score Vector</div>
                <div className="flex items-end gap-1.5 h-32 pt-4">
                  {trends.health_and_risk_trend.overall_engineering_score.map((val, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        className="w-full bg-indigo-500/80 group-hover:bg-indigo-400 rounded-t transition-all"
                        style={{ height: `${val}%` }}
                      />
                      <span className="text-[9px] text-slate-500 truncate max-w-full">
                        {trends.timestamps[idx]?.slice(5)}
                      </span>
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow border border-slate-700 z-10 whitespace-nowrap">
                        {val}/100 ({trends.timestamps[idx]})
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                <div className="text-xs font-semibold text-slate-300 mb-2">Regression Risk Score Vector</div>
                <div className="flex items-end gap-1.5 h-32 pt-4">
                  {trends.health_and_risk_trend.regression_risk.map((val, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        className="w-full bg-amber-500/80 group-hover:bg-amber-400 rounded-t transition-all"
                        style={{ height: `${val}%` }}
                      />
                      <span className="text-[9px] text-slate-500 truncate max-w-full">
                        {trends.timestamps[idx]?.slice(5)}
                      </span>
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow border border-slate-700 z-10 whitespace-nowrap">
                        Risk: {val}/100 ({trends.timestamps[idx]})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTrendTab === 'pr' && trends.pr_velocity_trend && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-semibold text-slate-300 mb-2">PR Volume Trend</div>
              <div className="flex items-end gap-1.5 h-32 pt-4">
                {trends.pr_velocity_trend.pr_volume.map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full bg-emerald-500/80 group-hover:bg-emerald-400 rounded-t transition-all"
                      style={{ height: `${(val / 10) * 100}%` }}
                    />
                    <span className="text-[9px] text-slate-500 truncate max-w-full">
                      {trends.timestamps[idx]?.slice(5)}
                    </span>
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow border border-slate-700 z-10 whitespace-nowrap">
                      {val} PRs ({trends.timestamps[idx]})
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-semibold text-slate-300 mb-2">Average PR Approval Rate (%)</div>
              <div className="flex items-end gap-1.5 h-32 pt-4">
                {trends.pr_velocity_trend.pr_approval_rate_pct.map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full bg-cyan-500/80 group-hover:bg-cyan-400 rounded-t transition-all"
                      style={{ height: `${val}%` }}
                    />
                    <span className="text-[9px] text-slate-500 truncate max-w-full">
                      {trends.timestamps[idx]?.slice(5)}
                    </span>
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow border border-slate-700 z-10 whitespace-nowrap">
                      {val}% Approved ({trends.timestamps[idx]})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTrendTab === 'test' && trends.smart_test_effectiveness_trend && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-semibold text-slate-300 mb-2">Test Reduction Percentage (%)</div>
              <div className="flex items-end gap-1.5 h-32 pt-4">
                {trends.smart_test_effectiveness_trend.test_reduction_percentage.map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full bg-indigo-500/80 group-hover:bg-indigo-400 rounded-t transition-all"
                      style={{ height: `${val}%` }}
                    />
                    <span className="text-[9px] text-slate-500 truncate max-w-full">
                      {trends.timestamps[idx]?.slice(5)}
                    </span>
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow border border-slate-700 z-10 whitespace-nowrap">
                      {val}% Reduction ({trends.timestamps[idx]})
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-semibold text-slate-300 mb-2">Cumulative CI Time Saved (Seconds)</div>
              <div className="flex items-end gap-1.5 h-32 pt-4">
                {trends.smart_test_effectiveness_trend.time_saved_seconds.map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full bg-purple-500/80 group-hover:bg-purple-400 rounded-t transition-all"
                      style={{ height: `${(val / 30) * 100}%` }}
                    />
                    <span className="text-[9px] text-slate-500 truncate max-w-full">
                      {trends.timestamps[idx]?.slice(5)}
                    </span>
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow border border-slate-700 z-10 whitespace-nowrap">
                      {val}s saved ({trends.timestamps[idx]})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTrendTab === 'architecture' && trends.architecture_health_trend && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-semibold text-slate-300 mb-2">Architectural Health Score Vector</div>
              <div className="flex items-end gap-1.5 h-32 pt-4">
                {trends.architecture_health_trend.architectural_health_score.map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full bg-teal-500/80 group-hover:bg-teal-400 rounded-t transition-all"
                      style={{ height: `${val}%` }}
                    />
                    <span className="text-[9px] text-slate-500 truncate max-w-full">
                      {trends.timestamps[idx]?.slice(5)}
                    </span>
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow border border-slate-700 z-10 whitespace-nowrap">
                      {val}/100 ({trends.timestamps[idx]})
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-semibold text-slate-300 mb-2">Coupling Hotspots Count</div>
              <div className="flex items-end gap-1.5 h-32 pt-4">
                {trends.architecture_health_trend.coupling_hotspots_count.map((val, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full bg-rose-500/80 group-hover:bg-rose-400 rounded-t transition-all"
                      style={{ height: `${(val / 5) * 100}%` }}
                    />
                    <span className="text-[9px] text-slate-500 truncate max-w-full">
                      {trends.timestamps[idx]?.slice(5)}
                    </span>
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] py-1 px-2 rounded shadow border border-slate-700 z-10 whitespace-nowrap">
                      {val} Hotspots ({trends.timestamps[idx]})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Smart Test Selection Effectiveness Index Card */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          🎯 Smart Test Selection Effectiveness Index
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400">Efficiency Score</div>
            <div className="text-2xl font-bold text-indigo-400 mt-1">{testEff.efficiency_score}/100</div>
            <div className="text-[11px] text-slate-500 mt-1">Rating: {testEff.effectiveness_rating}</div>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400">Average Suite Reduction</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{testEff.average_suite_reduction_percentage}%</div>
            <div className="text-[11px] text-slate-500 mt-1">Minimal test execution payload</div>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400">Weekly CI Hours Saved</div>
            <div className="text-2xl font-bold text-purple-400 mt-1">~{testEff.cumulative_ci_hours_saved_weekly} hrs</div>
            <div className="text-[11px] text-slate-500 mt-1">Est. 45 runs / week</div>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            <div className="text-xs text-slate-400">Confidence Retention</div>
            <div className="text-2xl font-bold text-cyan-400 mt-1">{testEff.confidence_retention_rate_pct}%</div>
            <div className="text-[11px] text-slate-500 mt-1">High-confidence regression safety</div>
          </div>
        </div>
      </div>

      {/* Actionable Insights Grid */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
          💡 Actionable Engineering Insights & Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((item, idx) => (
            <div key={idx} className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-2">
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getSeverityBadge(item.severity)}`}>
                  {item.severity} • {item.category}
                </span>
              </div>
              <h4 className="text-sm font-bold text-white mb-1">{item.title}</h4>
              <p className="text-xs text-slate-300 mb-3 leading-relaxed">{item.explanation}</p>
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-xs text-indigo-300 font-medium">
                👉 <strong>Action:</strong> {item.recommendation}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
