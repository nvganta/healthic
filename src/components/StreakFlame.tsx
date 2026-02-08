'use client';

interface StreakFlameProps {
  streak: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function StreakFlame({ streak, size = 'md', showLabel = true }: StreakFlameProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
  };

  const flameSize = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  // Determine flame intensity based on streak
  const getFlameColor = () => {
    if (streak >= 30) return 'from-amber-400 via-orange-500 to-red-600';
    if (streak >= 14) return 'from-orange-400 via-orange-500 to-amber-500';
    if (streak >= 7) return 'from-orange-300 via-orange-400 to-orange-500';
    if (streak >= 3) return 'from-yellow-300 via-orange-300 to-orange-400';
    return 'from-yellow-200 via-yellow-300 to-orange-300';
  };

  // Show more flames for longer streaks
  const getFlameCount = () => {
    if (streak >= 30) return 3;
    if (streak >= 7) return 2;
    return 1;
  };

  if (streak === 0) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className={`${sizeClasses[size]} rounded-xl bg-slate-100 flex items-center justify-center`}>
          <span className={`${flameSize[size]} opacity-30`}>🔥</span>
        </div>
        {showLabel && (
          <span className="text-xs text-slate-400">No streak</span>
        )}
      </div>
    );
  }

  const flameCount = getFlameCount();

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`${sizeClasses[size]} rounded-xl bg-gradient-to-br ${getFlameColor()} flex items-center justify-center relative overflow-hidden shadow-lg`}
      >
        {/* Animated glow effect */}
        <div className="absolute inset-0 bg-white/20 animate-pulse-soft" />

        {/* Flame(s) */}
        <div className={`relative flex ${flameCount > 1 ? '-space-x-1' : ''}`}>
          {Array.from({ length: flameCount }).map((_, i) => (
            <span
              key={i}
              className={`${flameSize[size]} animate-flame`}
              style={{
                animationDelay: `${i * 200}ms`,
                filter: i === 0 ? 'none' : 'brightness(1.1)',
              }}
            >
              🔥
            </span>
          ))}
        </div>

        {/* Streak number badge */}
        <div className="absolute -bottom-1 -right-1 bg-white rounded-full px-1.5 py-0.5 shadow-md border border-orange-100">
          <span className="text-xs font-bold text-orange-600">{streak}</span>
        </div>
      </div>

      {showLabel && (
        <span className="text-xs font-medium text-slate-600">
          {streak} day{streak !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
