'use client';

import { useEffect, useState } from 'react';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface BadgeToastProps {
  badge: Badge;
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export default function BadgeToast({
  badge,
  onClose,
  autoClose = true,
  autoCloseDelay = 5000,
}: BadgeToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!autoClose) return;

    const timer = setTimeout(() => {
      handleClose();
    }, autoCloseDelay);

    return () => clearTimeout(timer);
  }, [autoClose, autoCloseDelay]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed top-4 right-4 z-[100] transition-all duration-300 ${
        isVisible && !isExiting
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-4 scale-95'
      }`}
    >
      <div className="relative bg-gradient-to-br from-amber-50 via-white to-amber-50 rounded-2xl shadow-2xl border border-amber-200 p-5 min-w-[280px] overflow-hidden">
        {/* Sparkle effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-2 left-4 w-2 h-2 bg-amber-300 rounded-full animate-sparkle-float" style={{ animationDelay: '0ms' }} />
          <div className="absolute top-6 right-8 w-1.5 h-1.5 bg-yellow-400 rounded-full animate-sparkle-float" style={{ animationDelay: '200ms' }} />
          <div className="absolute bottom-4 left-8 w-1 h-1 bg-orange-300 rounded-full animate-sparkle-float" style={{ animationDelay: '400ms' }} />
          <div className="absolute bottom-6 right-12 w-2 h-2 bg-amber-400 rounded-full animate-sparkle-float" style={{ animationDelay: '600ms' }} />
        </div>

        {/* Content */}
        <div className="relative flex items-start gap-4">
          {/* Badge Icon */}
          <div className="flex-shrink-0 animate-badge-pop">
            <div className="relative">
              {/* Glow effect */}
              <div className="absolute inset-0 w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-400 rounded-full blur-lg opacity-40 animate-pulse-soft" />

              {/* Badge circle */}
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-orange-400 to-amber-500 flex items-center justify-center shadow-lg ring-4 ring-amber-100">
                <span className="text-3xl">{badge.icon}</span>
              </div>

              {/* Star burst */}
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-yellow-300 to-amber-400 rounded-full flex items-center justify-center shadow-md animate-bounce-soft">
                <svg className="w-3.5 h-3.5 text-amber-700" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0 pt-1">
            <p className="text-xs font-medium text-amber-600 uppercase tracking-wider mb-1">
              Badge Earned!
            </p>
            <h3 className="text-lg font-bold text-slate-800 mb-1">
              {badge.name}
            </h3>
            <p className="text-sm text-slate-500">
              {badge.description}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1 text-slate-300 hover:text-slate-500 transition-colors rounded-lg hover:bg-slate-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress bar for auto-close */}
        {autoClose && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-100">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-400"
              style={{
                animation: `shrink-width ${autoCloseDelay}ms linear forwards`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Component to manage multiple badge toasts
interface BadgeToastManagerProps {
  badges: Badge[];
  onClearBadge: (badgeId: string) => void;
}

export function BadgeToastManager({ badges, onClearBadge }: BadgeToastManagerProps) {
  if (badges.length === 0) return null;

  // Only show the first badge; subsequent ones will appear after dismissal
  const currentBadge = badges[0];

  return (
    <BadgeToast
      key={currentBadge.id}
      badge={currentBadge}
      onClose={() => onClearBadge(currentBadge.id)}
    />
  );
}
