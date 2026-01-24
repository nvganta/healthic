'use client';

import { useState, useEffect } from 'react';

interface Goal {
  id: string;
  title: string;
  goalType: string;
  targetValue?: number;
  targetUnit?: string;
  createdAt: string;
}

interface Activity {
  id: string;
  date: string;
  type: string;
  data: { value: string };
}

// Icons
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const TargetIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ActivityIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const goalTypeColors: Record<string, string> = {
  weight_loss: 'bg-rose-100 text-rose-700',
  exercise: 'bg-orange-100 text-orange-700',
  sleep: 'bg-indigo-100 text-indigo-700',
  nutrition: 'bg-green-100 text-green-700',
  habit: 'bg-purple-100 text-purple-700',
  other: 'bg-slate-100 text-slate-700',
};

const activityTypeIcons: Record<string, string> = {
  exercise: '🏃',
  meal: '🍎',
  sleep: '😴',
  mood: '😊',
  weight: '⚖️',
  stress: '🧘',
};

interface SidebarProps {
  onNewChat: () => void;
}

export default function Sidebar({ onNewChat }: SidebarProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(true);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  const fetchGoals = async () => {
    setIsLoadingGoals(true);
    try {
      const res = await fetch('/api/goals');
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals || []);
      }
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      setIsLoadingGoals(false);
    }
  };

  const fetchActivities = async () => {
    setIsLoadingActivities(true);
    try {
      const res = await fetch('/api/activities?days=7');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  useEffect(() => {
    fetchGoals();
    fetchActivities();
  }, []);

  const refreshData = () => {
    fetchGoals();
    fetchActivities();
  };

  return (
    <aside className="w-72 h-screen bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Healthic</h1>
            <p className="text-xs text-slate-500">AI Health Coach</p>
          </div>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md shadow-emerald-200 hover:shadow-lg"
        >
          <PlusIcon />
          New Chat
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
        {/* Goals Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <TargetIcon />
              <span>My Goals</span>
            </div>
            <button
              onClick={refreshData}
              className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
              title="Refresh"
            >
              <RefreshIcon />
            </button>
          </div>

          {isLoadingGoals ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : goals.length === 0 ? (
            <div className="text-center py-6 px-4 bg-slate-50 rounded-xl">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                <TargetIcon />
              </div>
              <p className="text-sm text-slate-500">No goals yet</p>
              <p className="text-xs text-slate-400 mt-1">Start a chat to set your first goal</p>
            </div>
          ) : (
            <div className="space-y-2">
              {goals.slice(0, 3).map((goal) => (
                <div
                  key={goal.id}
                  className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{goal.title}</p>
                      {goal.targetValue && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Target: {goal.targetValue} {goal.targetUnit}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${goalTypeColors[goal.goalType] || goalTypeColors.other}`}>
                      {goal.goalType.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
              {goals.length > 3 && (
                <p className="text-xs text-center text-slate-400 pt-1">
                  +{goals.length - 3} more goals
                </p>
              )}
            </div>
          )}
        </div>

        {/* Recent Activity Section */}
        <div>
          <div className="flex items-center gap-2 text-slate-700 font-semibold mb-3">
            <ActivityIcon />
            <span>Recent Activity</span>
          </div>

          {isLoadingActivities ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-6 px-4 bg-slate-50 rounded-xl">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                <ActivityIcon />
              </div>
              <p className="text-sm text-slate-500">No activity logged</p>
              <p className="text-xs text-slate-400 mt-1">Tell me what you did today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activities.slice(0, 5).map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl"
                >
                  <span className="text-lg">{activityTypeIcons[activity.type] || '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 truncate">{activity.data.value}</p>
                    <p className="text-xs text-slate-400">{activity.type}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats Overview */}
        <div>
          <div className="flex items-center gap-2 text-slate-700 font-semibold mb-3">
            <ChartIcon />
            <span>This Week</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-emerald-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-emerald-600">{goals.length}</p>
              <p className="text-xs text-emerald-700">Active Goals</p>
            </div>
            <div className="p-3 bg-teal-50 rounded-xl text-center">
              <p className="text-2xl font-bold text-teal-600">{activities.length}</p>
              <p className="text-xs text-teal-700">Activities</p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="p-4 border-t border-slate-100">
        <button className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
          <SettingsIcon />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}
