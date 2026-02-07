'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Confetti from './Confetti';

interface DailyAction {
  id: string;
  actionText: string;
  actionDate: string;
  isCompleted: boolean;
  completedAt: string | null;
  notes: string | null;
  goalId: string;
  goalTitle: string;
  goalType: string;
}

interface ActionStats {
  completed: number;
  total: number;
  percentage: number;
}

interface TodayActionsData {
  date: string;
  actions: DailyAction[];
  stats: ActionStats;
}

const goalTypeColors: Record<string, string> = {
  weight_loss: 'border-l-rose-400',
  exercise: 'border-l-orange-400',
  sleep: 'border-l-indigo-400',
  nutrition: 'border-l-green-400',
  habit: 'border-l-purple-400',
  other: 'border-l-slate-400',
};

interface TodayActionsProps {
  onActionComplete?: () => void;
}

export default function TodayActions({ onActionComplete }: TodayActionsProps) {
  const [data, setData] = useState<TodayActionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevPercentageRef = useRef<number>(0);

  const fetchActions = useCallback(async () => {
    try {
      const res = await fetch('/api/daily-actions');
      const d = await res.json();
      setData(d);
    } catch (err) {
      console.error('Failed to fetch daily actions:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const toggleAction = async (actionId: string, currentStatus: boolean) => {
    setUpdatingId(actionId);
    setError(null);

    try {
      const res = await fetch('/api/daily-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId,
          isCompleted: !currentStatus,
        }),
      });

      if (res.ok) {
        // Update local state after successful API response
        setData((prev) => {
          if (!prev) return prev;
          const newActions = prev.actions.map((a) =>
            a.id === actionId ? { ...a, isCompleted: !currentStatus, completedAt: !currentStatus ? new Date().toISOString() : null } : a
          );
          const completed = newActions.filter((a) => a.isCompleted).length;
          const newPercentage = newActions.length > 0 ? Math.round((completed / newActions.length) * 100) : 0;

          // Trigger confetti when reaching 100%
          if (newPercentage === 100 && prevPercentageRef.current < 100) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3500);
          }
          prevPercentageRef.current = newPercentage;

          return {
            ...prev,
            actions: newActions,
            stats: {
              completed,
              total: newActions.length,
              percentage: newPercentage,
            },
          };
        });
        onActionComplete?.();
      } else {
        // Handle API error response
        const errorData = await res.json().catch(() => ({}));
        setError(errorData.error || 'Failed to update action');
        // Clear error after 3 seconds
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      console.error('Failed to update action:', err);
      setError('Network error. Please try again.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="h-6 w-40 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.actions.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Today&apos;s Actions</h2>
          <p className="text-sm text-slate-400 mt-1">Your daily tasks to stay on track</p>
        </div>
        <div className="p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-slate-500">No actions for today</p>
          <p className="text-sm text-slate-400 mt-1">Set a goal with your coach to get daily actions</p>
        </div>
      </div>
    );
  }

  // Group actions by goal
  const actionsByGoal = data.actions.reduce((acc, action) => {
    if (!acc[action.goalId]) {
      acc[action.goalId] = {
        goalTitle: action.goalTitle,
        goalType: action.goalType,
        actions: [],
      };
    }
    acc[action.goalId].actions.push(action);
    return acc;
  }, {} as Record<string, { goalTitle: string; goalType: string; actions: DailyAction[] }>);

  return (
    <>
      <Confetti active={showConfetti} />
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Error message */}
        {error && (
          <div className="p-3 bg-rose-50 border-b border-rose-100 text-rose-700 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}
        <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Today&apos;s Actions</h2>
            <p className="text-sm text-slate-400 mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-800">{data.stats.percentage}%</p>
              <p className="text-xs text-slate-400">{data.stats.completed}/{data.stats.total} done</p>
            </div>
            <div className="w-12 h-12 relative">
              <svg className="w-12 h-12 -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="4"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${(data.stats.percentage / 100) * 125.6} 125.6`}
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {Object.entries(actionsByGoal).map(([goalId, { goalTitle, goalType, actions }]) => (
          <div key={goalId} className="p-4">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">{goalTitle}</p>
            <div className="space-y-2">
              {actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => toggleAction(action.id, action.isCompleted)}
                  disabled={updatingId === action.id}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-l-4 transition-all ${
                    goalTypeColors[goalType] || goalTypeColors.other
                  } ${
                    action.isCompleted
                      ? 'bg-emerald-50/50'
                      : 'bg-slate-50 hover:bg-slate-100'
                  } ${updatingId === action.id ? 'opacity-50' : ''}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      action.isCompleted
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-slate-300 hover:border-emerald-400'
                    }`}
                  >
                    {action.isCompleted && (
                      <svg className="w-4 h-4 text-white animate-check-pop" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span
                    className={`text-sm text-left flex-1 ${
                      action.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'
                    }`}
                  >
                    {action.actionText}
                  </span>
                  {action.isCompleted && action.completedAt && (
                    <span className="text-xs text-slate-400">
                      {new Date(action.completedAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {data.stats.percentage === 100 && (
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-t border-emerald-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center animate-bounce-soft">
                <span className="text-lg">🎉</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-700">All done for today!</p>
                <p className="text-xs text-emerald-600">Great work staying consistent</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
