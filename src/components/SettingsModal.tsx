'use client';

import { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TONE_OPTIONS = [
  { value: 'tough_love', label: 'Tough Love', desc: 'Direct and no-nonsense coaching' },
  { value: 'balanced', label: 'Balanced', desc: 'Mix of encouragement and accountability' },
  { value: 'gentle', label: 'Gentle', desc: 'Supportive and understanding approach' },
];

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [tone, setTone] = useState('balanced');
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    fetch('/api/user/settings')
      .then(res => res.json())
      .then(data => setTone(data.settings?.tonePreference || 'balanced'))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  const updateTone = async (newTone: string) => {
    setTone(newTone);
    await fetch('/api/user/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tonePreference: newTone }),
    });
  };

  const clearHistory = async () => {
    setClearing(true);
    try {
      await fetch('/api/user/settings', { method: 'DELETE' });
      setShowConfirm(false);
    } catch (error) {
      console.error('Failed to clear history:', error);
    } finally {
      setClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Settings</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
              <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ) : (
            <>
              {/* Coaching Tone */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Coaching Tone</h3>
                <div className="space-y-2">
                  {TONE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateTone(opt.value)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                        tone === opt.value
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 bg-white hover:border-emerald-300'
                      }`}
                    >
                      <p className={`text-sm font-medium ${tone === opt.value ? 'text-emerald-700' : 'text-slate-700'}`}>
                        {opt.label}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Data Management */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Data Management</h3>
                {showConfirm ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                    <p className="text-sm text-rose-700 mb-3">Are you sure? This will delete all conversation history. Your goals, activities, and profile data will be kept.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={clearHistory}
                        disabled={clearing}
                        className="px-4 py-2 bg-rose-500 text-white text-sm rounded-lg hover:bg-rose-600 disabled:opacity-50 transition-colors"
                      >
                        {clearing ? 'Clearing...' : 'Yes, clear history'}
                      </button>
                      <button
                        onClick={() => setShowConfirm(false)}
                        className="px-4 py-2 bg-white text-slate-600 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 transition-all group"
                  >
                    <p className="text-sm font-medium text-slate-700 group-hover:text-rose-600">Clear Conversation History</p>
                    <p className="text-xs text-slate-400 mt-0.5">Remove all chat messages. Goals and profile data are kept.</p>
                  </button>
                )}
              </div>

              {/* About */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-400">Healthic v0.1.0</p>
                <p className="text-xs text-slate-400">AI Health Coach — Hackathon Demo</p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
