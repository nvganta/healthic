'use client';

import { useState, useEffect } from 'react';
import TodayActions from './TodayActions';
import AnimatedCounter from './AnimatedCounter';
import Tooltip from './Tooltip';
import StreakFlame from './StreakFlame';
import LevelProgress from './LevelProgress';

interface GoalProgress {
  id: string;
  title: string;
  goalType: string;
  targetValue: number;
  targetUnit: string;
  targetDate: string;
  progressPercent: number;
  totalWeeks: number;
  currentWeek: {
    targetValue: number;
    actualValue: number;
    notes: Record<string, unknown>;
  } | null;
}

interface Pattern {
  id: string;
  patternType: string;
  description: string;
  confidence: number;
  createdAt: string;
}

interface DashboardData {
  overview: {
    activeGoals: number;
    completedGoals: number;
    activitiesThisWeek: number;
    activitiesLastWeek: number;
    streak: number;
    conversations: number;
  };
  goals: GoalProgress[];
  activityBreakdown: Record<string, number>;
  patterns: Pattern[];
  portrait: { summary: string } | null;
}

interface GamificationData {
  points: number;
  level: {
    level: number;
    name: string;
    progressToNext: number;
    pointsToNext: number;
    nextLevel?: { name: string } | null;
  };
  streak: {
    current: number;
    longest: number;
  };
  badges: {
    earned: Array<{ id: string; name: string; icon: string; earnedAt: string }>;
    unearned: Array<{ id: string; name: string; icon: string; description: string }>;
  };
}

const goalTypeColors: Record<string, string> = {
  weight_loss: 'bg-rose-100 text-rose-700',
  exercise: 'bg-orange-100 text-orange-700',
  sleep: 'bg-indigo-100 text-indigo-700',
  nutrition: 'bg-green-100 text-green-700',
  habit: 'bg-purple-100 text-purple-700',
  other: 'bg-slate-100 text-slate-700',
};

const goalTypeProgressColors: Record<string, string> = {
  weight_loss: 'bg-rose-500',
  exercise: 'bg-orange-500',
  sleep: 'bg-indigo-500',
  nutrition: 'bg-green-500',
  habit: 'bg-purple-500',
  other: 'bg-slate-500',
};

const activityTypeConfig: Record<string, { icon: string; color: string; bg: string }> = {
  exercise: { icon: '🏃', color: 'bg-orange-500', bg: 'bg-orange-50' },
  meal: { icon: '🍎', color: 'bg-green-500', bg: 'bg-green-50' },
  sleep: { icon: '😴', color: 'bg-indigo-500', bg: 'bg-indigo-50' },
  mood: { icon: '😊', color: 'bg-yellow-500', bg: 'bg-yellow-50' },
  weight: { icon: '⚖️', color: 'bg-slate-500', bg: 'bg-slate-50' },
  stress: { icon: '🧘', color: 'bg-teal-500', bg: 'bg-teal-50' },
};

interface DashboardProps {
  onGoToChat: () => void;
}

export default function Dashboard({ onGoToChat }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [gamification, setGamification] = useState<GamificationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then((res) => res.json()),
      fetch('/api/gamification').then((res) => res.json()),
    ])
      .then(([dashboardData, gamificationData]) => {
        setData(dashboardData);
        setGamification(gamificationData);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 to-emerald-50/30">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-white rounded-2xl animate-pulse" />
          <div className="h-48 bg-white rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50/30">
        <p className="text-slate-500">Failed to load dashboard</p>
      </div>
    );
  }

  const { overview, goals, activityBreakdown, patterns, portrait } = data;

  const activityDelta = overview.activitiesThisWeek - overview.activitiesLastWeek;
  const maxActivityCount = Math.max(...Object.values(activityBreakdown), 1);

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 to-emerald-50/30">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Section 1 — Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-fade">
          <Tooltip content="Your currently active health goals" position="bottom">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:scale-[1.02] transition-all cursor-default">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-500">Active Goals</span>
              </div>
              <p className="text-3xl font-bold text-slate-800">
                <AnimatedCounter value={overview.activeGoals} />
              </p>
              {overview.completedGoals > 0 && (
                <p className="text-xs text-slate-400 mt-1">{overview.completedGoals} completed</p>
              )}
            </div>
          </Tooltip>

          <Tooltip content={`${overview.activitiesLastWeek} activities last week`} position="bottom">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:scale-[1.02] transition-all cursor-default">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-500">This Week</span>
              </div>
              <p className="text-3xl font-bold text-slate-800">
                <AnimatedCounter value={overview.activitiesThisWeek} />
              </p>
              <p className={`text-xs mt-1 ${activityDelta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {activityDelta >= 0 ? '+' : ''}{activityDelta} vs last week
              </p>
            </div>
          </Tooltip>

          <Tooltip content="Consecutive days with logged activities" position="bottom">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:scale-[1.02] transition-all cursor-default">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center ${overview.streak >= 3 ? 'animate-flame' : ''}`}>
                  <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-500">Streak</span>
              </div>
              <p className="text-3xl font-bold text-slate-800">
                <AnimatedCounter value={overview.streak} />
              </p>
              <p className="text-xs text-slate-400 mt-1">day{overview.streak !== 1 ? 's' : ''} in a row</p>
            </div>
          </Tooltip>

          <Tooltip content="Total chats with your health coach" position="bottom">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:scale-[1.02] transition-all cursor-default">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-500">Conversations</span>
              </div>
              <p className="text-3xl font-bold text-slate-800">
                <AnimatedCounter value={overview.conversations} />
              </p>
              <p className="text-xs text-slate-400 mt-1">with your coach</p>
            </div>
          </Tooltip>
        </div>

        {/* Gamification Section */}
        {gamification && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Level & Points Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-5">
                <LevelProgress
                  level={gamification.level.level}
                  name={gamification.level.name}
                  points={gamification.points}
                  progressToNext={gamification.level.progressToNext}
                  pointsToNext={gamification.level.pointsToNext}
                  nextLevelName={gamification.level.nextLevel?.name}
                />
              </div>
            </div>

            {/* Streak & Badges Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-500 mb-3">Current Streak</h3>
                  <StreakFlame streak={gamification.streak.current} size="lg" />
                  {gamification.streak.longest > gamification.streak.current && (
                    <p className="text-xs text-slate-400 mt-2">
                      Best: {gamification.streak.longest} days
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <h3 className="text-sm font-medium text-slate-500 mb-3">Badges Earned</h3>
                  {gamification.badges.earned.length > 0 ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      {gamification.badges.earned.slice(0, 5).map((badge) => (
                        <Tooltip key={badge.id} content={badge.name} position="bottom">
                          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl hover:scale-110 transition-transform cursor-default">
                            {badge.icon}
                          </div>
                        </Tooltip>
                      ))}
                      {gamification.badges.earned.length > 5 && (
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-medium text-slate-500">
                          +{gamification.badges.earned.length - 5}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">Complete actions to earn badges!</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Section 2 — Today's Actions (Accountability Widget) */}
        <TodayActions />

        {/* Section 3 — Goals Progress */}
        {goals.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Goals Progress</h2>
              <p className="text-sm text-slate-400 mt-1">{goals.length} active goal{goals.length !== 1 ? 's' : ''} - Click to expand</p>
            </div>
            <div className="divide-y divide-slate-50">
              {goals.map((goal) => {
                const isExpanded = expandedGoalId === goal.id;
                const notes = goal.currentWeek?.notes as Record<string, unknown> | null;
                const dailyActions = (notes?.dailyActions as string[]) || [];
                const description = (notes?.description as string) || '';
                const progressColor = goal.progressPercent >= 80 ? 'text-emerald-600' :
                                     goal.progressPercent >= 50 ? 'text-amber-600' : 'text-rose-500';

                return (
                  <div key={goal.id}>
                    <button
                      onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                      className="w-full p-6 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <svg
                            className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <h3 className="font-semibold text-slate-800">{goal.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${goalTypeColors[goal.goalType] || goalTypeColors.other}`}>
                            {goal.goalType.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-medium ${progressColor}`}>{goal.progressPercent}%</span>
                          {goal.targetDate && (
                            <p className="text-xs text-slate-400">
                              by {new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${goalTypeProgressColors[goal.goalType] || goalTypeProgressColors.other}`}
                          style={{ width: `${goal.progressPercent}%` }}
                        />
                      </div>
                      {goal.currentWeek && (
                        <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                          <span>This week: {goal.currentWeek.actualValue ?? 0} / {goal.currentWeek.targetValue} {goal.targetUnit}</span>
                          <span>{goal.totalWeeks} week{goal.totalWeeks !== 1 ? 's' : ''} planned</span>
                        </div>
                      )}
                    </button>

                    {/* Expanded Details */}
                    {isExpanded && goal.currentWeek && (
                      <div className="px-6 pb-6 pt-2 bg-slate-50 animate-fade-in">
                        <div className="ml-7">
                          {description && (
                            <p className="text-sm text-slate-600 mb-4 p-3 bg-white rounded-lg border border-slate-100">
                              {description}
                            </p>
                          )}
                          {dailyActions.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Daily Actions</p>
                              <div className="space-y-2">
                                {dailyActions.map((action, i) => (
                                  <div key={i} className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-100">
                                    <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                                    </svg>
                                    <span className="text-sm text-slate-700">{action}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {!description && dailyActions.length === 0 && (
                            <p className="text-sm text-slate-400 italic">No details available for this week</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 4 — Activity Breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">Activity Breakdown</h2>
            <p className="text-sm text-slate-400 mt-1">This week&apos;s logged activities</p>
          </div>
          <div className="p-6">
            {Object.keys(activityBreakdown).length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-400">No activities logged this week</p>
                <p className="text-sm text-slate-300 mt-1">Start logging activities to see your breakdown</p>
              </div>
            ) : (
              <div className="space-y-4 stagger-fade">
                {Object.entries(activityBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count], index) => {
                    const config = activityTypeConfig[type] || { icon: '📝', color: 'bg-slate-500', bg: 'bg-slate-50' };
                    const widthPercent = Math.round((count / maxActivityCount) * 100);
                    const totalActivities = Object.values(activityBreakdown).reduce((a, b) => a + b, 0);
                    const percentage = Math.round((count / totalActivities) * 100);
                    return (
                      <Tooltip key={type} content={`${count} ${type} activities (${percentage}% of total)`} position="right">
                        <div className="flex items-center gap-4 hover:bg-slate-50 p-2 -mx-2 rounded-xl transition-colors cursor-default">
                          <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center text-lg flex-shrink-0`}>
                            {config.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-700 capitalize">{type}</span>
                              <span className="text-sm font-semibold text-slate-800">{count}</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full animate-bar-grow ${config.color}`}
                                style={{
                                  width: `${widthPercent}%`,
                                  animationDelay: `${index * 100}ms`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </Tooltip>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Section 5 — Weekly Plan */}
        {goals.some((g) => g.currentWeek) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">This Week&apos;s Plan</h2>
              <p className="text-sm text-slate-400 mt-1">Your weekly targets and daily actions</p>
            </div>
            <div className="divide-y divide-slate-50">
              {goals
                .filter((g) => g.currentWeek)
                .map((goal) => {
                  const notes = goal.currentWeek?.notes as Record<string, unknown> | null;
                  const dailyActions = (notes?.dailyActions as string[]) || [];
                  const description = (notes?.description as string) || '';
                  const weekTarget = goal.currentWeek?.targetValue ?? 0;
                  const weekActual = goal.currentWeek?.actualValue ?? 0;
                  const weekPercent = weekTarget > 0 ? Math.min(100, Math.round(((weekActual as number) / (weekTarget as number)) * 100)) : 0;

                  return (
                    <div key={goal.id} className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-slate-800">{goal.title}</h3>
                        <span className="text-sm text-slate-500">
                          {weekActual} / {weekTarget} {goal.targetUnit}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                        <div
                          className={`h-full rounded-full ${goalTypeProgressColors[goal.goalType] || goalTypeProgressColors.other}`}
                          style={{ width: `${weekPercent}%` }}
                        />
                      </div>
                      {description && (
                        <p className="text-sm text-slate-500 mb-3">{description}</p>
                      )}
                      {dailyActions.length > 0 && (
                        <div className="space-y-1.5">
                          {dailyActions.map((action, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                              </svg>
                              <span className="text-sm text-slate-600">{action}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Section 6 — Health Insights */}
        {(patterns.length > 0 || portrait) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Health Insights</h2>
              <p className="text-sm text-slate-400 mt-1">AI-detected patterns from your conversations</p>
            </div>
            <div className="p-6 space-y-4">
              {portrait && (
                <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                  <h3 className="text-sm font-semibold text-emerald-700 mb-2">Your Health Portrait</h3>
                  <p className="text-sm text-slate-600">{portrait.summary}</p>
                </div>
              )}
              {patterns.map((pattern) => (
                <div key={pattern.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-700 capitalize">
                        {pattern.patternType.replace(/_/g, ' ')}
                      </span>
                      {pattern.confidence && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          pattern.confidence >= 0.7
                            ? 'bg-emerald-100 text-emerald-700'
                            : pattern.confidence >= 0.4
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {Math.round(pattern.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{pattern.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state if no data at all */}
        {goals.length === 0 && Object.keys(activityBreakdown).length === 0 && patterns.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Start Your Journey</h3>
            <p className="text-slate-400 max-w-md mx-auto">
              Chat with your health coach to set goals, log activities, and build your personalized dashboard.
            </p>
            <button
              onClick={onGoToChat}
              className="inline-block mt-6 px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all"
            >
              Talk to Your Coach
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
