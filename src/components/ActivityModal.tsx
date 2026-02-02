'use client';

import { useState, useEffect } from 'react';

interface Activity {
  id: string;
  date: string;
  type: string;
  data: { value: string };
  notes: string | null;
}

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACTIVITY_TYPES = [
  { value: 'exercise', label: 'Exercise', icon: '🏃' },
  { value: 'meal', label: 'Meal', icon: '🍎' },
  { value: 'sleep', label: 'Sleep', icon: '😴' },
  { value: 'mood', label: 'Mood', icon: '😊' },
  { value: 'weight', label: 'Weight', icon: '⚖️' },
  { value: 'stress', label: 'Stress', icon: '🧘' },
];

const activityTypeIcons: Record<string, string> = {
  exercise: '🏃',
  meal: '🍎',
  sleep: '😴',
  mood: '😊',
  weight: '⚖️',
  stress: '🧘',
};

const emptyForm = {
  type: 'exercise',
  value: '',
  notes: '',
};

export default function ActivityModal({ isOpen, onClose }: ActivityModalProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'list' | 'add'>('list');
  const [form, setForm] = useState(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setView('list');
    setConfirmDeleteId(null);
    fetchActivities();
  }, [isOpen]);

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/activities?days=30');
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = () => {
    setForm(emptyForm);
    setView('add');
  };

  const handleSave = async () => {
    if (!form.value.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          value: form.value.trim(),
          notes: form.notes.trim() || null,
        }),
      });

      if (res.ok) {
        await fetchActivities();
        setView('list');
      }
    } catch (error) {
      console.error('Failed to save activity:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/activities?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setActivities(prev => prev.filter(a => a.id !== id));
        setConfirmDeleteId(null);
      }
    } catch (error) {
      console.error('Failed to delete activity:', error);
    }
  };

  if (!isOpen) return null;

  // Group activities by date
  const grouped: Record<string, Activity[]> = {};
  for (const activity of activities) {
    const dateKey = new Date(activity.date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(activity);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100vh-4rem)] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-800">
              {view === 'list' ? 'Recent Activity' : 'Log Activity'}
            </h2>
            <p className="text-sm text-slate-400">
              {view === 'list'
                ? `${activities.length} activit${activities.length !== 1 ? 'ies' : 'y'} in the last 30 days`
                : 'Record what you did today'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {view === 'list' && (
              <button
                onClick={handleAdd}
                className="px-3 py-1.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all"
              >
                + Log Activity
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
                  <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-slate-500 font-medium">No activity logged</p>
                <p className="text-sm text-slate-400 mt-1">Log your first activity or tell the agent what you did</p>
                <button
                  onClick={handleAdd}
                  className="mt-4 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all"
                >
                  + Log Your First Activity
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {Object.entries(grouped).map(([date, dateActivities]) => (
                  <div key={date}>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{date}</h3>
                    <div className="space-y-2">
                      {dateActivities.map(activity => (
                        <div key={activity.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 group hover:bg-slate-100 transition-colors">
                          <span className="text-xl flex-shrink-0">{activityTypeIcons[activity.type] || '📝'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700">{activity.data.value}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-400 capitalize">{activity.type}</span>
                              {activity.notes && (
                                <span className="text-xs text-slate-400">— {activity.notes}</span>
                              )}
                            </div>
                          </div>
                          {confirmDeleteId === activity.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(activity.id)}
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
                              onClick={() => setConfirmDeleteId(activity.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Add Form */
            <div className="space-y-5">
              {/* Activity Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Activity Type *</label>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_TYPES.map(type => (
                    <button
                      key={type.value}
                      onClick={() => setForm(f => ({ ...f, type: type.value }))}
                      className={`px-3 py-1.5 text-sm rounded-full border transition-all flex items-center gap-1.5 ${
                        form.type === type.value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                          : 'border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <span>{type.icon}</span>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Value */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">What did you do? *</label>
                <input
                  value={form.value}
                  onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                  placeholder={
                    form.type === 'exercise' ? 'e.g., Ran for 30 minutes' :
                    form.type === 'meal' ? 'e.g., Had a salad and grilled chicken' :
                    form.type === 'sleep' ? 'e.g., Slept 7.5 hours' :
                    form.type === 'mood' ? 'e.g., Feeling energetic and positive' :
                    form.type === 'weight' ? 'e.g., 175 lbs' :
                    'e.g., 15 minutes meditation'
                  }
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  autoFocus
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional details..."
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={!form.value.trim() || isSaving}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Log Activity'}
                </button>
                <button
                  onClick={() => setView('list')}
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
