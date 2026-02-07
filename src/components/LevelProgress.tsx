'use client';

interface LevelProgressProps {
  level: number;
  name: string;
  points: number;
  progressToNext: number;
  pointsToNext: number;
  nextLevelName?: string;
  compact?: boolean;
}

const levelColors: Record<number, string> = {
  1: 'from-slate-400 to-slate-500',
  2: 'from-emerald-400 to-emerald-600',
  3: 'from-teal-400 to-teal-600',
  4: 'from-cyan-400 to-cyan-600',
  5: 'from-blue-400 to-blue-600',
  6: 'from-violet-400 to-violet-600',
  7: 'from-amber-400 to-amber-600',
};

const levelBgColors: Record<number, string> = {
  1: 'bg-slate-100',
  2: 'bg-emerald-100',
  3: 'bg-teal-100',
  4: 'bg-cyan-100',
  5: 'bg-blue-100',
  6: 'bg-violet-100',
  7: 'bg-amber-100',
};

export default function LevelProgress({
  level,
  name,
  points,
  progressToNext,
  pointsToNext,
  nextLevelName,
  compact = false,
}: LevelProgressProps) {
  const gradientClass = levelColors[level] || levelColors[1];
  const bgClass = levelBgColors[level] || levelBgColors[1];

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientClass} flex items-center justify-center shadow-md`}>
          <span className="text-white font-bold text-lg">{level}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-slate-700">{name}</span>
            <span className="text-xs text-slate-500">{points} pts</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${gradientClass} transition-all duration-500`}
              style={{ width: `${progressToNext}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-2xl ${bgClass} border border-white/50`}>
      <div className="flex items-center gap-4">
        {/* Level Badge */}
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradientClass} flex flex-col items-center justify-center shadow-lg`}>
          <span className="text-white/70 text-[10px] font-medium uppercase tracking-wider">Level</span>
          <span className="text-white font-bold text-2xl -mt-1">{level}</span>
        </div>

        {/* Level Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-slate-800">{name}</h3>
            <span className="text-sm font-medium text-slate-600 animate-sparkle">{points} pts</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 bg-white/70 rounded-full overflow-hidden shadow-inner mb-2">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${gradientClass} transition-all duration-500`}
              style={{ width: `${progressToNext}%` }}
            />
          </div>

          {/* Next level info */}
          {nextLevelName && pointsToNext > 0 ? (
            <p className="text-xs text-slate-500">
              {pointsToNext} pts to <span className="font-medium">{nextLevelName}</span>
            </p>
          ) : (
            <p className="text-xs text-slate-500 font-medium">Max level reached!</p>
          )}
        </div>
      </div>
    </div>
  );
}
