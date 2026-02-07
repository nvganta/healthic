'use client';

import { useState } from 'react';

interface WeeklyTarget {
  weekNumber: number;
  weekStart: string;
  targetValue: number;
  targetDescription: string;
  dailyActions: string[];
}

interface ProposedPlan {
  goal: {
    title: string;
    description: string;
    goalType: string;
    targetValue?: number;
    targetUnit?: string;
    targetDate?: string;
  };
  weeklyTargets: WeeklyTarget[];
}

interface PlanApprovalModalProps {
  isOpen: boolean;
  plan: ProposedPlan;
  onApprove: (plan: ProposedPlan) => void;
  onReject: () => void;
}

const goalTypeLabels: Record<string, string> = {
  weight_loss: 'Weight Loss',
  exercise: 'Exercise',
  sleep: 'Sleep',
  nutrition: 'Nutrition',
  habit: 'Habit',
  other: 'Other',
};

const goalTypeColors: Record<string, string> = {
  weight_loss: 'bg-rose-100 text-rose-700',
  exercise: 'bg-orange-100 text-orange-700',
  sleep: 'bg-indigo-100 text-indigo-700',
  nutrition: 'bg-green-100 text-green-700',
  habit: 'bg-purple-100 text-purple-700',
  other: 'bg-slate-100 text-slate-700',
};

const formatWeekDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 6);

  const formatOpts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${date.toLocaleDateString('en-US', formatOpts)} - ${endDate.toLocaleDateString('en-US', formatOpts)}`;
};

export default function PlanApprovalModal({ isOpen, plan, onApprove, onReject }: PlanApprovalModalProps) {
  const [editedPlan, setEditedPlan] = useState<ProposedPlan>(plan);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
  const [editingAction, setEditingAction] = useState<{ weekIdx: number; actionIdx: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isApproving, setIsApproving] = useState(false);

  if (!isOpen) return null;

  const toggleWeek = (weekNumber: number) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekNumber)) {
        next.delete(weekNumber);
      } else {
        next.add(weekNumber);
      }
      return next;
    });
  };

  const handleEditAction = (weekIdx: number, actionIdx: number, currentValue: string) => {
    setEditingAction({ weekIdx, actionIdx });
    setEditValue(currentValue);
  };

  const handleSaveAction = () => {
    if (!editingAction || !editValue.trim()) return;

    setEditedPlan(prev => {
      const newPlan = { ...prev };
      const newTargets = [...newPlan.weeklyTargets];
      const newActions = [...newTargets[editingAction.weekIdx].dailyActions];
      newActions[editingAction.actionIdx] = editValue.trim();
      newTargets[editingAction.weekIdx] = {
        ...newTargets[editingAction.weekIdx],
        dailyActions: newActions,
      };
      return { ...newPlan, weeklyTargets: newTargets };
    });
    setEditingAction(null);
    setEditValue('');
  };

  const handleDeleteAction = (weekIdx: number, actionIdx: number) => {
    setEditedPlan(prev => {
      const newPlan = { ...prev };
      const newTargets = [...newPlan.weeklyTargets];
      const newActions = newTargets[weekIdx].dailyActions.filter((_, i) => i !== actionIdx);
      newTargets[weekIdx] = {
        ...newTargets[weekIdx],
        dailyActions: newActions,
      };
      return { ...newPlan, weeklyTargets: newTargets };
    });
  };

  const handleAddAction = (weekIdx: number) => {
    setEditedPlan(prev => {
      const newPlan = { ...prev };
      const newTargets = [...newPlan.weeklyTargets];
      const newActions = [...newTargets[weekIdx].dailyActions, 'New action'];
      newTargets[weekIdx] = {
        ...newTargets[weekIdx],
        dailyActions: newActions,
      };
      return { ...newPlan, weeklyTargets: newTargets };
    });
    // Auto-edit the new action
    const newActionIdx = editedPlan.weeklyTargets[weekIdx].dailyActions.length;
    setEditingAction({ weekIdx, actionIdx: newActionIdx });
    setEditValue('');
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove(editedPlan);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={onReject} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-3xl max-h-[calc(100vh-4rem)] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-200">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-slate-800 mb-1">Review Your Plan</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold text-emerald-700">{editedPlan.goal.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${goalTypeColors[editedPlan.goal.goalType] || goalTypeColors.other}`}>
                  {goalTypeLabels[editedPlan.goal.goalType] || editedPlan.goal.goalType}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
                {editedPlan.goal.targetValue && (
                  <span>
                    Target: <strong className="text-slate-700">{editedPlan.goal.targetValue} {editedPlan.goal.targetUnit}</strong>
                  </span>
                )}
                {editedPlan.goal.targetDate && (
                  <span>
                    By: <strong className="text-slate-700">{new Date(editedPlan.goal.targetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onReject}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - Weekly Targets */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="text-sm text-slate-500 mb-4">
            Review and customize your weekly plan. You can edit or remove actions, and add new ones.
          </p>

          {editedPlan.weeklyTargets.map((week, weekIdx) => (
            <div
              key={week.weekNumber}
              className="border border-slate-200 rounded-xl overflow-hidden transition-all hover:border-emerald-200"
            >
              {/* Week Header */}
              <button
                onClick={() => toggleWeek(week.weekNumber)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow">
                    {week.weekNumber}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-slate-700">Week {week.weekNumber}</div>
                    <div className="text-xs text-slate-500">{formatWeekDate(week.weekStart)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-medium text-emerald-600">{week.targetDescription}</div>
                    <div className="text-xs text-slate-400">{week.dailyActions.length} daily actions</div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform ${expandedWeeks.has(week.weekNumber) ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Week Actions */}
              {expandedWeeks.has(week.weekNumber) && (
                <div className="p-4 border-t border-slate-100 space-y-2 bg-white">
                  {week.dailyActions.map((action, actionIdx) => (
                    <div key={actionIdx} className="group flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>

                      {editingAction?.weekIdx === weekIdx && editingAction?.actionIdx === actionIdx ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveAction();
                              if (e.key === 'Escape') {
                                setEditingAction(null);
                                setEditValue('');
                              }
                            }}
                            autoFocus
                            className="flex-1 px-3 py-1.5 text-sm border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            placeholder="Enter action..."
                          />
                          <button
                            onClick={handleSaveAction}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setEditingAction(null);
                              setEditValue('');
                            }}
                            className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-slate-700">{action}</span>
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                            <button
                              onClick={() => handleEditAction(weekIdx, actionIdx, action)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteAction(weekIdx, actionIdx)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add Action Button */}
                  <button
                    onClick={() => handleAddAction(weekIdx)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors mt-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add action
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-400">
            {editedPlan.weeklyTargets.length} weeks · {editedPlan.weeklyTargets.reduce((sum, w) => sum + w.dailyActions.length, 0)} total actions
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onReject}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={isApproving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isApproving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve Plan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
