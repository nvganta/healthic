'use client';

import { useState } from 'react';

interface Question {
  id: string;
  question: string;
  options: string[];
}

interface ChoicesPanelProps {
  title: string;
  questions: Question[];
  onSubmit: (answers: string) => void;
  onDismiss: () => void;
}

export default function ChoicesPanel({ title, questions, onSubmit, onDismiss }: ChoicesPanelProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});

  const allAnswered = questions.every((q) => {
    const sel = selections[q.id];
    if (!sel) return false;
    if (sel === 'Other') return (otherTexts[q.id] || '').trim().length > 0;
    return true;
  });

  const handleSelect = (questionId: string, option: string) => {
    setSelections((prev) => ({ ...prev, [questionId]: option }));
  };

  const handleOtherText = (questionId: string, text: string) => {
    setOtherTexts((prev) => ({ ...prev, [questionId]: text }));
  };

  const handleSubmit = () => {
    const answerParts = questions.map((q) => {
      const sel = selections[q.id];
      const answer = sel === 'Other' ? otherTexts[q.id] : sel;
      return `${q.question}: ${answer}`;
    });
    onSubmit(answerParts.join('\n'));
  };

  return (
    <div className="w-80 h-full bg-white border-l border-slate-200 flex flex-col animate-fade-in max-md:fixed max-md:right-0 max-md:top-0 max-md:z-50 max-md:shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <button onClick={onDismiss} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Questions */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {questions.map((q, idx) => (
          <div key={q.id}>
            <p className="text-sm font-medium text-slate-700 mb-3">
              {idx + 1}. {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleSelect(q.id, option)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all ${
                    selections[q.id] === option
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300'
                  }`}
                >
                  {option}
                </button>
              ))}
              {selections[q.id] === 'Other' && (
                <input
                  type="text"
                  value={otherTexts[q.id] || ''}
                  onChange={(e) => handleOtherText(q.id, e.target.value)}
                  placeholder="Type your answer..."
                  className="w-full px-4 py-2.5 rounded-xl border border-emerald-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                  autoFocus
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Submit button */}
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
            allAnswered
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-200 hover:from-emerald-600 hover:to-teal-600'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          Submit Answers
        </button>
      </div>
    </div>
  );
}
