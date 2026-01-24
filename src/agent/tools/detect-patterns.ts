import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getOrCreateUser } from './user-helper';

interface ActivityLog {
  id: string;
  log_date: string;
  log_type: string;
  data: { value: string };
  notes: string | null;
}

interface DetectedPattern {
  type: string;
  description: string;
  confidence: number;
  evidence: string[];
  suggestion: string;
}

// Analyze logs for day-of-week patterns
function analyzeDayOfWeekPatterns(logs: ActivityLog[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  // Group exercise logs by day of week
  const exerciseByDay: Record<string, number> = {
    Sunday: 0, Monday: 0, Tuesday: 0, Wednesday: 0,
    Thursday: 0, Friday: 0, Saturday: 0
  };
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const exerciseLogs = logs.filter(l => l.log_type === 'exercise');

  exerciseLogs.forEach(log => {
    const date = new Date(log.log_date);
    const dayName = dayNames[date.getDay()];
    exerciseByDay[dayName]++;
  });

  // Find days with significantly fewer workouts
  const totalExercise = exerciseLogs.length;
  if (totalExercise >= 7) {
    const avgPerDay = totalExercise / 7;

    for (const [day, count] of Object.entries(exerciseByDay)) {
      if (count < avgPerDay * 0.3 && avgPerDay > 0.5) {
        patterns.push({
          type: 'day_of_week_exercise',
          description: `You tend to skip workouts on ${day}s`,
          confidence: 0.7,
          evidence: [`Only ${count} workout(s) logged on ${day}s out of ${totalExercise} total`],
          suggestion: `Consider scheduling a lighter activity on ${day}s, or move your workout to a different time that day.`
        });
      }
    }
  }

  return patterns;
}

// Analyze sleep-mood correlation
function analyzeSleepMoodPatterns(logs: ActivityLog[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  const sleepLogs = logs.filter(l => l.log_type === 'sleep');
  const moodLogs = logs.filter(l => l.log_type === 'mood');

  if (sleepLogs.length >= 3 && moodLogs.length >= 3) {
    // Simple analysis: check if bad sleep correlates with bad mood
    let badSleepBadMood = 0;
    let badSleepCount = 0;

    sleepLogs.forEach(sleepLog => {
      const sleepValue = sleepLog.data.value.toLowerCase();
      const sleepHours = parseFloat(sleepValue) || 0;
      const isBadSleep = sleepHours < 6 || sleepValue.includes('poor') || sleepValue.includes('bad');

      if (isBadSleep) {
        badSleepCount++;
        // Check mood on same day or next day
        const sleepDate = new Date(sleepLog.log_date);
        const nextDay = new Date(sleepDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const relatedMood = moodLogs.find(m => {
          const moodDate = new Date(m.log_date);
          return moodDate.toDateString() === sleepDate.toDateString() ||
                 moodDate.toDateString() === nextDay.toDateString();
        });

        if (relatedMood) {
          const moodValue = relatedMood.data.value.toLowerCase();
          if (moodValue.includes('bad') || moodValue.includes('tired') ||
              moodValue.includes('stress') || moodValue.includes('anxious') ||
              moodValue.includes('low')) {
            badSleepBadMood++;
          }
        }
      }
    });

    if (badSleepCount >= 2 && badSleepBadMood / badSleepCount >= 0.5) {
      patterns.push({
        type: 'sleep_mood_correlation',
        description: 'Poor sleep appears to affect your mood the next day',
        confidence: 0.75,
        evidence: [`${badSleepBadMood} out of ${badSleepCount} poor sleep nights were followed by low mood`],
        suggestion: 'Improving your sleep quality could help stabilize your mood. Try a consistent bedtime routine.'
      });
    }
  }

  return patterns;
}

// Analyze streak patterns
function analyzeStreakPatterns(logs: ActivityLog[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = [];

  const exerciseLogs = logs
    .filter(l => l.log_type === 'exercise')
    .sort((a, b) => new Date(a.log_date).getTime() - new Date(b.log_date).getTime());

  if (exerciseLogs.length >= 5) {
    // Find gaps in exercise
    let maxStreak = 0;
    let currentStreak = 1;
    let streakBreaks: number[] = [];

    for (let i = 1; i < exerciseLogs.length; i++) {
      const prevDate = new Date(exerciseLogs[i - 1].log_date);
      const currDate = new Date(exerciseLogs[i].log_date);
      const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 2) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        streakBreaks.push(currentStreak);
        currentStreak = 1;
      }
    }
    streakBreaks.push(currentStreak);

    // Check if there's a pattern of breaking after certain streak length
    if (streakBreaks.length >= 2) {
      const avgStreakLength = streakBreaks.reduce((a, b) => a + b, 0) / streakBreaks.length;

      if (avgStreakLength >= 3 && avgStreakLength <= 7) {
        patterns.push({
          type: 'streak_pattern',
          description: `You tend to maintain exercise for about ${Math.round(avgStreakLength)} days before taking a break`,
          confidence: 0.6,
          evidence: [`Average streak length: ${avgStreakLength.toFixed(1)} days across ${streakBreaks.length} streaks`],
          suggestion: `Plan a rest day every ${Math.round(avgStreakLength)} days instead of pushing until you crash. Scheduled rest prevents burnout.`
        });
      }
    }
  }

  return patterns;
}

export const detectPatternsTool = new FunctionTool({
  name: 'detect_patterns',
  description: `Analyze user's activity logs to find behavioral patterns.
Use this when:
- User mentions struggling or failing at something
- User asks about their habits or patterns
- Before giving advice about improving consistency
Returns detected patterns that can inform personalized recommendations.`,
  parameters: z.object({
    days: z.number().default(30).describe('Number of days of history to analyze'),
    savePatterns: z.boolean().default(true).describe('Whether to save detected patterns to database'),
  }),
  execute: async (params) => {
    try {
      const user = await getOrCreateUser();
      const days = params.days ?? 30;

      // Fetch activity logs
      const logs = await sql`
        SELECT * FROM daily_logs
        WHERE user_id = ${user.id}
          AND log_date >= CURRENT_DATE - ${days}::integer
        ORDER BY log_date DESC
      `;

      if (logs.length < 5) {
        return {
          success: true,
          patterns: [],
          message: 'Not enough activity data to detect patterns yet. Keep logging for a few more days!',
        };
      }

      // Run pattern detection algorithms
      const allPatterns: DetectedPattern[] = [
        ...analyzeDayOfWeekPatterns(logs as ActivityLog[]),
        ...analyzeSleepMoodPatterns(logs as ActivityLog[]),
        ...analyzeStreakPatterns(logs as ActivityLog[]),
      ];

      // Save patterns to database if requested
      if (params.savePatterns && allPatterns.length > 0) {
        for (const pattern of allPatterns) {
          await sql`
            INSERT INTO patterns (user_id, pattern_type, description, confidence, evidence)
            VALUES (
              ${user.id},
              ${pattern.type},
              ${pattern.description},
              ${pattern.confidence},
              ${JSON.stringify({ evidence: pattern.evidence, suggestion: pattern.suggestion })}
            )
            ON CONFLICT DO NOTHING
          `;
        }
      }

      console.log('Patterns detected:', allPatterns.length);

      return {
        success: true,
        patterns: allPatterns,
        logsAnalyzed: logs.length,
        message: allPatterns.length > 0
          ? `Found ${allPatterns.length} pattern(s) in your activity data.`
          : 'No strong patterns detected yet. This is normal - patterns emerge over time.',
      };
    } catch (error) {
      console.error('Error detecting patterns:', error);
      return { success: false, patterns: [], message: 'Failed to analyze patterns.' };
    }
  },
});
