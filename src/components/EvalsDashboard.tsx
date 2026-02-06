'use client';

import { useState, useEffect } from 'react';

interface EvalResult {
  name: string;
  score: number;
  reason: string;
  passed: boolean;
  concerns?: string[];
}

interface EvalCategory {
  type: string;
  passed: number;
  failed: number;
  results: EvalResult[];
}

interface EvalsData {
  success: boolean;
  timestamp: string;
  actionability: EvalCategory;
  personalization: EvalCategory;
  safety: EvalCategory;
  summary: {
    totalPassed: number;
    totalFailed: number;
    passRate: number;
  };
}

interface EvalsDashboardProps {
  onBack: () => void;
}

export default function EvalsDashboard({ onBack }: EvalsDashboardProps) {
  const [data, setData] = useState<EvalsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runEvals = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setIsLoading(true);
    } else {
      setIsRunning(true);
    }
    setError(null);
    try {
      const res = await fetch('/api/evals');
      const d = await res.json();
      if (!d.success) throw new Error(d.error || 'Failed to run evals');
      setData(d);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runEvals(true);
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-emerald-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-rose-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 0.8) return 'bg-emerald-100';
    if (score >= 0.5) return 'bg-yellow-100';
    return 'bg-rose-100';
  };

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'actionability':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      case 'personalization':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'safety':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getCategoryColor = (type: string) => {
    switch (type) {
      case 'actionability':
        return { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' };
      case 'personalization':
        return { bg: 'bg-purple-100', text: 'text-purple-600', border: 'border-purple-200' };
      case 'safety':
        return { bg: 'bg-rose-100', text: 'text-rose-600', border: 'border-rose-200' };
      default:
        return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 to-indigo-50/30">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Evaluation Dashboard</h1>
                <p className="text-sm text-slate-500 mt-1">
                  LLM-as-judge quality metrics powered by Opik
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://www.comet.com/opik"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Opik Dashboard
            </a>
            <button
              onClick={runEvals}
              disabled={isRunning}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Running...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Run Evals
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700">
            <p className="font-medium">Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !data && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />
              ))}
            </div>
            <div className="h-64 bg-white rounded-2xl animate-pulse" />
          </div>
        )}

        {/* Data Display */}
        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-slate-500">Pass Rate</span>
                </div>
                <p className={`text-3xl font-bold ${data.summary.passRate >= 80 ? 'text-emerald-600' : data.summary.passRate >= 50 ? 'text-yellow-600' : 'text-rose-600'}`}>
                  {data.summary.passRate.toFixed(0)}%
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {data.summary.totalPassed} / {data.summary.totalPassed + data.summary.totalFailed} tests
                </p>
              </div>

              {['actionability', 'personalization', 'safety'].map((type) => {
                const category = data[type as keyof EvalsData] as EvalCategory;
                const colors = getCategoryColor(type);
                const passRate = category.passed / (category.passed + category.failed) * 100;
                return (
                  <div key={type} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center ${colors.text}`}>
                        {getCategoryIcon(type)}
                      </div>
                      <span className="text-sm font-medium text-slate-500 capitalize">{type}</span>
                    </div>
                    <p className={`text-3xl font-bold ${passRate === 100 ? 'text-emerald-600' : passRate >= 50 ? 'text-yellow-600' : 'text-rose-600'}`}>
                      {category.passed}/{category.passed + category.failed}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">tests passed</p>
                  </div>
                );
              })}
            </div>

            {/* Detailed Results */}
            {['actionability', 'personalization', 'safety'].map((type) => {
              const category = data[type as keyof EvalsData] as EvalCategory;
              const colors = getCategoryColor(type);

              return (
                <div key={type} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className={`p-6 border-b ${colors.border} ${colors.bg}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center ${colors.text}`}>
                        {getCategoryIcon(type)}
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-800 capitalize">{type} Evaluation</h2>
                        <p className="text-sm text-slate-500">
                          {type === 'actionability' && 'Is advice specific and actionable?'}
                          {type === 'personalization' && 'Does it use user context?'}
                          {type === 'safety' && 'Does it avoid harmful advice?'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {category.results.map((result, i) => (
                      <div key={i} className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center ${result.passed ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                {result.passed ? (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                )}
                              </span>
                              <h3 className="font-medium text-slate-700">{result.name.replace(/_/g, ' ')}</h3>
                            </div>
                            <p className="text-sm text-slate-500 ml-9">{result.reason}</p>
                            {result.concerns && result.concerns.length > 0 && (
                              <div className="ml-9 mt-2 flex flex-wrap gap-2">
                                {result.concerns.map((concern, j) => (
                                  <span key={j} className="text-xs px-2 py-1 bg-rose-50 text-rose-600 rounded-full">
                                    {concern}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className={`px-3 py-1.5 rounded-lg font-semibold text-sm ${getScoreBg(result.score)} ${getScoreColor(result.score)}`}>
                            {(result.score * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Timestamp */}
            <div className="text-center text-sm text-slate-400">
              Last run: {new Date(data.timestamp).toLocaleString()}
            </div>
          </>
        )}

        {/* No Data State */}
        {!isLoading && !data && !error && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No Evaluation Data</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              Run the evaluations to see quality metrics for your health coach.
            </p>
            <button
              onClick={runEvals}
              className="inline-block mt-6 px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all"
            >
              Run Evaluations
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
