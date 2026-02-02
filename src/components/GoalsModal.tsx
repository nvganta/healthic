'use client';

import { useState, useEffect } from 'react';

interface Goal {
  id: string;
  title: string;
  description: string | null;
  goalType: string;
  targetValue: number | null;
  targetUnit: string | null;
  targetDate: string | null;
  createdAt: string;
}

interface GoalsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GOAL_TYPES = [
  { value: 'weight_loss', label: 'Weight Loss' },
  { value: 'exercise', label: 'Exercise' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'habit', label: 'Habit' },
  { value: 'other', label: 'Other' },
];

const goalTypeColors: Record<string, string> = {
  weight_loss: 'bg-rose-100 text-rose-700',
  exercise: 'bg-orange-100 text-orange-700',
  sleep: 'bg-indigo-100 text-indigo-700',
  nutrition: 'bg-green-100 text-green-700',
  habit: 'bg-purple-100 text-purple-700',
  other: 'bg-slate-100 text-slate-700',
};

const emptyForm = {
  title: '',
  description: '',
  goalType: 'exercise',
  targetValue: '',
  targetUnit: '',
  targetDate: '',
};

export default function GoalsModal({ isOpen, onClose }: GoalsModalProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'list' | 'add' | 'edit'>('list');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setView('list');
    setEditingGoalId(null);
    setConfirmDeleteId(null);
    fetchGoals();
  }, [isOpen]);

  const fetchGoals = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/goals');
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals || []);
      }
    } catch (error) {
      console.error('Failed to fetch goals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setForm(emptyForm);
    setView('add');
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoalId(goal.id);
    setForm({
      title: goal.title,
      description: goal.description || '',
      goalType: goal.goalType,
      targetValue: goal.targetValue?.toString() || '',
      targetUnit: goal.targetUnit || '',
      targetDate: goal.targetDate ? goal.targetDate.split('T')[0] : '',
    });
    setView('edit');
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setIsSaving(true);
    try {
      const payload = {
        ...(view === 'edit' ? { id: editingGoalId } : {}),
        title: form.title.trim(),
        description: form.description.trim() || null,
        goalType: form.goalType,
        targetValue: form.targetValue ? Number(form.targetValue) : null,
        targetUnit: form.targetUnit.trim() || null,
        targetDate: form.targetDate || null,
      };

      const res = await fetch('/api/goals', {
        method: view === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchGoals();
        setView('list');
        setEditingGoalId(null);
      }
    } catch (error) {
      console.error('Failed to save goal:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/goals?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setGoals(prev => prev.filter(g => g.id !== id));
        setConfirmDeleteId(null);
      }
    } catch (error) {
      console.error('Failed to delete goal:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100vh-4rem)] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-800">
              {view === 'list' ? 'My Goals' : view === 'add' ? 'Add Goal' : 'Edit Goal'}
            </h2>
            <p className="text-sm text-slate-400">
              {view === 'list'
                ? `${goals.length} active goal${goals.length !== 1 ? 's' : ''}`
                : view === 'add'
                ? 'Create a new health goal'
                : 'Update your goal details'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {view === 'list' && (
              <button
                onClick={handleAdd}
                className="px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all"
              >
                + Add Goal
              </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {view === 'list' ? (
            isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : goals.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-slate-500 font-medium">No goals yet</p>
                <p className="text-sm text-slate-400 mt-1">Add your first goal or tell the agent about it in chat</p>
                <button
                  onClick={handleAdd}
                  className="mt-4 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all"
                >
                  + Add Your First Goal
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map(goal => (
                  <div key={goal.id} className="bg-slate-50 rounded-xl p-4 group hover:bg-slate-100 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-semibold text-slate-800">{goal.title}</h4>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${goalTypeColors[goal.goalType] || goalTypeColors.other}`}>
                            {goal.goalType.replace('_', ' ')}
                          </span>
                        </div>
                        {goal.description && (
                          <p className="text-sm text-slate-500 mb-2">{goal.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          {goal.targetValue && (
                            <span>Target: {goal.targetValue} {goal.targetUnit}</span>
                          )}
                          {goal.targetDate && (
                            <span>Due: {new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          )}
                          <span>Added {new Date(goal.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => handleEdit(goal)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {confirmDeleteId === goal.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(goal.id)}
                              className="px-2 py-1 text-xs font-medium text-white bg-rose-500 rounded-lg hover:bg-rose-600 transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(goal.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Add / Edit Form */
            <div className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Lose 10 pounds"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Describe your goal in more detail..."
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
                />
              </div>

              {/* Goal Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Goal Type *</label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => setForm(f => ({ ...f, goalType: type.value }))}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                        form.goalType === type.value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Value + Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Target Value</label>
                  <input
                    type="number"
                    value={form.targetValue}
                    onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                    placeholder="e.g., 10"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Unit</label>
                  <input
                    value={form.targetUnit}
                    onChange={e => setForm(f => ({ ...f, targetUnit: e.target.value }))}
                    placeholder="e.g., pounds, hours, days"
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              {/* Target Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Target Date</label>
                <input
                  type="date"
                  value={form.targetDate}
                  onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={!form.title.trim() || isSaving}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : view === 'edit' ? 'Update Goal' : 'Add Goal'}
                </button>
                <button
                  onClick={() => { setView('list'); setEditingGoalId(null); }}
                  className="px-5 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
