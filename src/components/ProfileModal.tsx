'use client';

import { useState, useEffect } from 'react';

interface ProfileData {
  profile: {
    name: string;
    email: string;
    tonePreference: string;
    createdAt: string;
    intake: Record<string, unknown>;
    extracted: Record<string, unknown>;
  };
  patterns: Array<{
    id: string;
    patternType: string;
    description: string;
    confidence: number;
    createdAt: string;
  }>;
  portrait: {
    summary?: string;
    personality?: { motivationStyle: string; communicationPreference: string; decisionMakingStyle: string };
  } | null;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// All scalar fields that always show
const SCALAR_FIELDS = [
  { key: 'currentWeight', label: 'Current Weight', placeholder: 'e.g., 185 lbs' },
  { key: 'targetWeight', label: 'Target Weight', placeholder: 'e.g., 165 lbs' },
  { key: 'height', label: 'Height', placeholder: "e.g., 5'10\"" },
  { key: 'activityLevel', label: 'Activity Level', placeholder: 'e.g., moderately active' },
  { key: 'workSchedule', label: 'Work Schedule', placeholder: 'e.g., 9-5 weekdays' },
  { key: 'motivation', label: 'Motivation', placeholder: 'What drives you?' },
];

// All array fields that always show
const ARRAY_FIELDS = [
  { key: 'dietary', altKey: 'dietaryPreferences', label: 'Dietary Preferences', placeholder: 'e.g., vegetarian' },
  { key: 'exercise_preferences', altKey: 'exercisePreferences', label: 'Exercise Preferences', placeholder: 'e.g., walking' },
  { key: 'health_conditions', altKey: null, label: 'Health Conditions', placeholder: 'e.g., knee pain' },
  { key: 'schedule_constraints', altKey: null, label: 'Schedule Constraints', placeholder: 'e.g., busy weekdays' },
  { key: 'challenges', altKey: null, label: 'Challenges', placeholder: 'e.g., stress eating' },
  { key: 'dislikes', altKey: null, label: 'Dislikes', placeholder: 'e.g., mornings' },
];

const PATTERN_LABELS: Record<string, string> = {
  day_of_week_exercise: 'Exercise Pattern',
  sleep_mood_correlation: 'Sleep-Mood Link',
  streak_pattern: 'Streak Pattern',
  motivation: 'Motivation Insight',
  challenge: 'Challenge',
  success_pattern: 'Success Pattern',
  trigger_pattern: 'Trigger Pattern',
  communication_preference: 'Communication Style',
  coaching_effectiveness: 'Coaching Insight',
  follow_up: 'Follow-up',
};

const XIcon = ({ size = 3 }: { size?: number }) => (
  <svg className={`w-${size} h-${size}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addValue, setAddValue] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setEditingField(null);
    setAddingTo(null);
    fetch('/api/user/profile')
      .then(res => res.json())
      .then(d => { setData(d); setNameValue(d.profile?.name || ''); })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const allPrefs = data ? { ...data.profile.extracted, ...data.profile.intake } : {};

  // Get values for a scalar field
  const getScalar = (key: string): string | number | null => {
    const val = allPrefs[key];
    if (val !== null && val !== undefined && !Array.isArray(val)) return val as string | number;
    return null;
  };

  // Get merged array values for a field (handles alt keys like dietary + dietaryPreferences)
  const getArray = (key: string, altKey: string | null): string[] => {
    const a = allPrefs[key];
    const b = altKey ? allPrefs[altKey] : null;
    const arr1 = Array.isArray(a) ? a : [];
    const arr2 = Array.isArray(b) ? b : [];
    return [...new Set([...arr1, ...arr2])];
  };

  const saveName = async () => {
    if (!nameValue.trim()) return;
    await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameValue.trim() }),
    });
    setData(prev => prev ? { ...prev, profile: { ...prev.profile, name: nameValue.trim() } } : prev);
    setEditingName(false);
  };

  const saveScalar = async (key: string) => {
    const val = editValue.trim();
    if (!val) { setEditingField(null); return; }
    const numVal = Number(val);
    await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: { [key]: isNaN(numVal) ? val : numVal } }),
    });
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        profile: { ...prev.profile, intake: { ...prev.profile.intake, [key]: isNaN(numVal) ? val : numVal } },
      };
    });
    setEditingField(null);
  };

  const clearScalar = async (key: string) => {
    await fetch('/api/user/profile/item', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'preference', clearKey: key }),
    });
    setData(prev => {
      if (!prev) return prev;
      const newIntake = { ...prev.profile.intake };
      delete newIntake[key];
      const newExtracted = { ...prev.profile.extracted };
      delete newExtracted[key];
      return { ...prev, profile: { ...prev.profile, intake: newIntake, extracted: newExtracted } };
    });
  };

  const addArrayItem = async (key: string) => {
    const val = addValue.trim();
    if (!val) { setAddingTo(null); return; }
    const existing = Array.isArray(allPrefs[key]) ? (allPrefs[key] as string[]) : [];
    await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences: { [key]: [...existing, val] } }),
    });
    setData(prev => {
      if (!prev) return prev;
      const section = ['dietary', 'health_conditions', 'exercise_preferences', 'schedule_constraints', 'dislikes'].includes(key)
        ? 'extracted' : 'intake';
      const curr = prev.profile[section][key];
      const arr = Array.isArray(curr) ? curr : [];
      return {
        ...prev,
        profile: { ...prev.profile, [section]: { ...prev.profile[section], [key]: [...arr, val] } },
      };
    });
    setAddValue('');
    setAddingTo(null);
  };

  const deleteArrayItem = async (key: string, value: string) => {
    await fetch('/api/user/profile/item', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'preference', preferenceKey: key, preferenceValue: value }),
    });
    setData(prev => {
      if (!prev) return prev;
      const update = (section: 'intake' | 'extracted') => {
        const arr = prev.profile[section][key];
        if (Array.isArray(arr)) {
          return { ...prev.profile[section], [key]: arr.filter((v: string) => v.toLowerCase() !== value.toLowerCase()) };
        }
        return prev.profile[section];
      };
      return { ...prev, profile: { ...prev.profile, intake: update('intake'), extracted: update('extracted') } };
    });
  };

  const deletePattern = async (patternId: string) => {
    await fetch('/api/user/profile/item', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pattern', patternId }),
    });
    setData(prev => prev ? { ...prev, patterns: prev.patterns.filter(p => p.id !== patternId) } : prev);
  };

  const initial = data?.profile.name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100vh-4rem)] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                  className="text-lg font-bold text-slate-800 border-b-2 border-emerald-500 outline-none bg-transparent"
                  autoFocus
                />
                <button onClick={saveName} className="text-xs text-emerald-600 font-medium">Save</button>
                <button onClick={() => setEditingName(false)} className="text-xs text-slate-400">Cancel</button>
              </div>
            ) : (
              <h2
                className="text-lg font-bold text-slate-800 cursor-pointer hover:text-emerald-600 transition-colors"
                onClick={() => { setEditingName(true); setNameValue(data?.profile.name || ''); }}
              >
                {data?.profile.name || 'Health User'}
                <svg className="w-3.5 h-3.5 inline ml-1.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </h2>
            )}
            <p className="text-sm text-slate-400">
              Member since {data?.profile.createdAt ? new Date(data.profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '...'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Body Stats & Lifestyle */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Body Stats & Lifestyle</h3>
                <div className="grid grid-cols-2 gap-3">
                  {SCALAR_FIELDS.map(field => {
                    const value = getScalar(field.key);
                    return (
                      <div key={field.key} className="bg-slate-50 rounded-xl p-3 group relative">
                        <p className="text-xs text-slate-400 mb-1">{field.label}</p>
                        {editingField === field.key ? (
                          <div className="flex items-center gap-1">
                            <input
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveScalar(field.key); if (e.key === 'Escape') setEditingField(null); }}
                              placeholder={field.placeholder}
                              className="text-sm font-medium text-slate-700 border-b border-emerald-500 outline-none bg-transparent w-full"
                              autoFocus
                            />
                            <button onClick={() => saveScalar(field.key)} className="text-xs text-emerald-600 whitespace-nowrap">Save</button>
                          </div>
                        ) : value !== null ? (
                          <p
                            className="text-sm font-medium text-slate-700 cursor-pointer hover:text-emerald-600"
                            onClick={() => { setEditingField(field.key); setEditValue(String(value)); }}
                          >
                            {String(value)}
                          </p>
                        ) : (
                          <button
                            onClick={() => { setEditingField(field.key); setEditValue(''); }}
                            className="text-sm text-slate-300 hover:text-emerald-500 transition-colors"
                          >
                            + Add
                          </button>
                        )}
                        {value !== null && (
                          <button
                            onClick={() => clearScalar(field.key)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"
                          >
                            <XIcon size={3.5} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preferences & Conditions */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Preferences & Conditions</h3>
                <div className="space-y-4">
                  {ARRAY_FIELDS.map(field => {
                    const values = getArray(field.key, field.altKey);
                    return (
                      <div key={field.key}>
                        <p className="text-xs text-slate-400 mb-1.5">{field.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {values.map((v: string) => (
                            <span key={v} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm rounded-full border border-emerald-200">
                              {v}
                              <button
                                onClick={() => deleteArrayItem(field.key, v)}
                                className="text-emerald-400 hover:text-rose-500 transition-colors"
                              >
                                <XIcon />
                              </button>
                            </span>
                          ))}
                          {addingTo === field.key ? (
                            <div className="inline-flex items-center gap-1">
                              <input
                                value={addValue}
                                onChange={e => setAddValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') addArrayItem(field.key); if (e.key === 'Escape') { setAddingTo(null); setAddValue(''); } }}
                                placeholder={field.placeholder}
                                className="text-sm px-3 py-1.5 border border-emerald-300 rounded-full outline-none focus:ring-2 focus:ring-emerald-500 w-36"
                                autoFocus
                              />
                              <button onClick={() => addArrayItem(field.key)} className="text-xs text-emerald-600 font-medium">Add</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setAddingTo(field.key); setAddValue(''); }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-slate-400 rounded-full border border-dashed border-slate-300 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Agent's Understanding */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Agent&apos;s Understanding</h3>
                {data?.portrait?.summary ? (
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                    <p className="text-sm text-slate-700 leading-relaxed">{data.portrait.summary}</p>
                    {data.portrait.personality && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {data.portrait.personality.motivationStyle && (
                          <span className="text-xs px-2 py-1 bg-white/60 rounded-full text-teal-700">
                            Motivated by: {data.portrait.personality.motivationStyle}
                          </span>
                        )}
                        {data.portrait.personality.communicationPreference && (
                          <span className="text-xs px-2 py-1 bg-white/60 rounded-full text-teal-700">
                            Prefers: {data.portrait.personality.communicationPreference}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-300 italic">The agent will build an understanding as you chat more.</p>
                )}
              </div>

              {/* Observed Patterns */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Observed Patterns</h3>
                {data?.patterns && data.patterns.length > 0 ? (
                  <div className="space-y-2">
                    {data.patterns.map(p => (
                      <div key={p.id} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3 group">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-400 mb-0.5">
                            {PATTERN_LABELS[p.patternType] || p.patternType.replace(/_/g, ' ')}
                            {p.confidence ? ` (${Math.round(Number(p.confidence) * 100)}%)` : ''}
                          </p>
                          <p className="text-sm text-slate-700">{p.description}</p>
                        </div>
                        <button
                          onClick={() => deletePattern(p.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all flex-shrink-0 mt-1"
                        >
                          <XIcon size={3.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-300 italic">Patterns will appear as the agent detects trends in your activity.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
