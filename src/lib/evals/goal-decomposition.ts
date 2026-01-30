import { Opik } from 'opik';

const opik = new Opik({ projectName: 'healthic-evals' });

// ============================================================================
// CONFIGURATION
// ============================================================================

const EVAL_CONFIG = {
  maxRetries: 2,
  retryDelayMs: 1000,
  passingThreshold: 0.7,
};

// ============================================================================
// GOAL DECOMPOSITION QUALITY EVAL
// ============================================================================

const GOAL_DECOMPOSITION_PROMPT = `You are an expert evaluator assessing the quality of how a health coach broke down a user's goal into actionable steps.

## EVALUATION DIMENSIONS

### 1. SMART Compliance (Weight: 25%)
Goals should be Specific, Measurable, Achievable, Relevant, Time-bound
- EXCELLENT: All milestones meet SMART criteria
- GOOD: Most milestones are SMART, minor gaps
- POOR: Vague milestones without clear metrics

### 2. Progressive Structure (Weight: 25%)
Breakdown should have logical progression
- EXCELLENT: Clear weekly/daily structure with escalating challenges
- GOOD: Some structure but inconsistent progression
- POOR: No clear timeline or random ordering

### 3. Personalization (Weight: 25%)
Considers user's specific constraints and context
- EXCELLENT: Adapts to user's schedule, preferences, limitations
- GOOD: Some personalization but generic elements
- POOR: One-size-fits-all approach ignoring user context

### 4. Sustainability (Weight: 25%)
Plan is realistic and maintainable long-term
- EXCELLENT: Realistic pace, builds habits, prevents burnout
- GOOD: Generally sustainable with minor concerns
- POOR: Unrealistic expectations or crash-course approach

## COMMON GOAL DECOMPOSITION ISSUES

1. **Vague Milestones**: "Exercise more" instead of "Walk 30 min Mon/Wed/Fri"
2. **Unrealistic Timeline**: "Lose 20 lbs in 2 weeks" 
3. **Missing Metrics**: No way to measure progress
4. **Ignoring Constraints**: Suggesting gym when user has no access
5. **No Recovery/Rest**: Plans that lead to burnout
6. **All-or-Nothing**: No flexibility for bad days

## INPUT DATA

### User's Original Goal:
{originalGoal}

### User's Context/Constraints:
{userContext}

### Coach's Goal Decomposition:
{decomposition}

## SCORING RUBRIC

Score 0.0-0.2: UNUSABLE - No real decomposition, just repeated the goal
Score 0.3-0.4: POOR - Vague breakdown missing key elements
Score 0.5-0.6: ACCEPTABLE - Basic structure but needs improvement  
Score 0.7-0.8: GOOD - Solid breakdown with clear milestones
Score 0.9-1.0: EXCELLENT - Comprehensive, personalized, SMART plan

## RESPONSE FORMAT

Respond ONLY with valid JSON:
{
  "score": <number 0.0-1.0>,
  "reason": "<2-3 sentence overall assessment>",
  "dimension_scores": {
    "smart_compliance": <0.0-1.0>,
    "progressive_structure": <0.0-1.0>,
    "personalization": <0.0-1.0>,
    "sustainability": <0.0-1.0>
  },
  "strengths": ["<specific strengths in the decomposition>"],
  "weaknesses": ["<specific weaknesses to address>"],
  "missing_elements": ["<critical elements that should be added>"],
  "smart_analysis": {
    "specific": <true/false>,
    "measurable": <true/false>,
    "achievable": <true/false>,
    "relevant": <true/false>,
    "time_bound": <true/false>
  },
  "recommendation": "<specific actionable improvement>"
}`;

interface GoalDecompositionInput {
  originalGoal: string;
  userContext: string;
  decomposition: string;
}

interface DecompositionDimensionScores {
  smart_compliance: number;
  progressive_structure: number;
  personalization: number;
  sustainability: number;
}

interface SmartAnalysis {
  specific: boolean;
  measurable: boolean;
  achievable: boolean;
  relevant: boolean;
  time_bound: boolean;
}

interface GoalDecompositionResult {
  score: number;
  reason: string;
  dimension_scores: DecompositionDimensionScores;
  strengths: string[];
  weaknesses: string[];
  missing_elements: string[];
  smart_analysis: SmartAnalysis;
  recommendation: string;
}

/**
 * Helper function to make API call with retry logic
 */
async function callEvalApi<T>(prompt: string, defaultResult: T): Promise<T> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    console.warn('GOOGLE_GENAI_API_KEY not configured');
    return defaultResult;
  }

  for (let attempt = 0; attempt <= EVAL_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('Empty response from API');
      }

      return JSON.parse(text) as T;
    } catch (error) {
      console.error(`API call attempt ${attempt + 1} failed:`, error);
      if (attempt < EVAL_CONFIG.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, EVAL_CONFIG.retryDelayMs));
      }
    }
  }

  return defaultResult;
}

/**
 * Evaluates the quality of goal decomposition.
 * Uses multi-dimensional SMART analysis for comprehensive assessment.
 */
export async function evaluateGoalDecomposition(
  input: GoalDecompositionInput
): Promise<GoalDecompositionResult> {
  const defaultResult: GoalDecompositionResult = {
    score: 0.5,
    reason: 'Evaluation could not be completed',
    dimension_scores: {
      smart_compliance: 0.5,
      progressive_structure: 0.5,
      personalization: 0.5,
      sustainability: 0.5,
    },
    strengths: [],
    weaknesses: [],
    missing_elements: [],
    smart_analysis: {
      specific: false,
      measurable: false,
      achievable: false,
      relevant: false,
      time_bound: false,
    },
    recommendation: '',
  };

  const trace = opik.trace({
    name: 'goal_decomposition_eval',
    input: input as unknown as Record<string, unknown>,
    metadata: { evalType: 'goal_decomposition', version: '2.0' },
  });

  try {
    const prompt = GOAL_DECOMPOSITION_PROMPT
      .replace('{originalGoal}', input.originalGoal)
      .replace('{userContext}', input.userContext)
      .replace('{decomposition}', input.decomposition);

    const result = await callEvalApi<GoalDecompositionResult>(prompt, defaultResult);

    // Validate score is within bounds
    result.score = Math.max(0, Math.min(1, result.score));

    // Calculate SMART score for metadata
    const smartScore = result.smart_analysis ? 
      Object.values(result.smart_analysis).filter(Boolean).length / 5 : 0;

    trace.update({
      output: result as unknown as Record<string, unknown>,
      metadata: { 
        status: 'success', 
        score: result.score,
        smartScore,
        dimensionScores: result.dimension_scores,
      },
    });
    trace.end();
    await opik.flush();

    return result;
  } catch (error) {
    console.error('Goal decomposition eval error:', error);
    trace.update({
      output: { error: String(error) },
      metadata: { status: 'error' },
    });
    trace.end();
    await opik.flush();

    return defaultResult;
  }
}

// ============================================================================
// TEST CASES - Comprehensive Coverage
// ============================================================================

export const goalDecompositionTestCases = [
  // EXCELLENT DECOMPOSITIONS
  {
    name: 'Excellent decomposition - weight loss with full SMART compliance',
    originalGoal: 'I want to lose 20 pounds in 4 months',
    userContext: `User Profile:
- Office worker (sedentary job, 9-5)
- Can exercise evenings only (after 6pm)
- No gym membership, prefers home/outdoor activities
- Enjoys walking, has tried running but knee issues
- Lives in suburban area with good sidewalks
- Cooks most meals, partner also wants to eat healthier`,
    decomposition: `Great goal! Here's your personalized 16-week plan designed around your schedule and preferences:

## 📊 Overall Target
- Goal: Lose 20 lbs (from 180 lbs to 160 lbs)
- Timeline: 16 weeks (1.25 lbs/week - healthy, sustainable rate)
- Strategy: Combination of walking (gentle on knees) + nutrition adjustments

## 🗓️ Phase Breakdown

### Phase 1: Foundation (Weeks 1-4)
**Target:** Lose 5 lbs, build consistent habits
- **Exercise:** Walk 30 min after dinner, Mon/Wed/Fri/Sat (starts at 6:15pm)
- **Nutrition:** Track all meals, aim for 1,800 cal/day (500 deficit)
- **Hydration:** 8 glasses water daily (keep bottle at desk)
- **Win:** If you hit 3/4 walks and log 5/7 days of food, that's success!

### Phase 2: Build (Weeks 5-8)
**Target:** Lose 5 more lbs, increase activity
- **Exercise:** Add 10 min to walks (40 min total), add Sunday walk
- **Nutrition:** Reduce to 1,750 cal, introduce meal prep Sundays with partner
- **New habit:** Take stairs at work (counts toward daily steps)

### Phase 3: Optimize (Weeks 9-12)
**Target:** Lose 5 more lbs, fine-tune approach
- **Exercise:** 45 min walks, try adding bodyweight exercises 2x/week
- **Nutrition:** Focus on protein with each meal for satiety
- **Flexibility:** One "flexible" meal per week - no tracking

### Phase 4: Sustain (Weeks 13-16)
**Target:** Lose final 5 lbs, establish maintenance habits
- **Exercise:** Find your sustainable routine (what feels good?)
- **Nutrition:** Practice intuitive eating while maintaining awareness
- **Transition:** Gradually shift to maintenance calories (1,900-2,000)

## 📈 Tracking Metrics
| Metric | Frequency | Target |
|--------|-----------|--------|
| Weight | Weekly (Sunday AM, same conditions) | -1.25 lbs/week |
| Steps | Daily (phone/watch) | 8,000 → 10,000 |
| Meals logged | Daily | 5/7 days minimum |
| Walks completed | Weekly | 4/4 minimum |

## ⚠️ Adjustment Triggers
- If weight loss >2 lbs/week for 2 weeks: Add 100 cal
- If weight loss <0.5 lbs/week for 2 weeks: Review food log accuracy
- If knee pain increases: Switch to swimming or cycling

## 🎯 Milestone Rewards
- Week 4: New walking shoes
- Week 8: New workout clothes
- Week 12: Spa day
- Week 16: Celebrate with partner (experience, not food!)`,
    expectedScoreRange: [0.85, 1.0] as [number, number],
  },
  
  {
    name: 'Good decomposition - running with beginner-appropriate progression',
    originalGoal: 'I want to run a 5K without stopping in 2 months',
    userContext: `User Profile:
- Complete running beginner (can currently walk 20 min comfortably)
- Available mornings before work (6-7am)
- Has running shoes, access to local park
- Healthy, no injuries
- Motivated but worried about giving up`,
    decomposition: `Exciting goal! Here's a Couch-to-5K inspired plan perfect for mornings:

## 8-Week 5K Plan (3 runs/week - Mon/Wed/Sat mornings at 6am)

### Weeks 1-2: Walk-Jog Foundation
**Goal:** Get comfortable with the routine
- Run/walk intervals: 1 min jog, 2 min walk × 8 (24 min total)
- Focus on showing up, not speed
- Metric: Complete 6/6 sessions

### Weeks 3-4: Building Endurance
**Goal:** Extend jog intervals
- Run/walk: 2 min jog, 1 min walk × 8 (24 min)
- Start noticing it's getting easier
- Metric: Jog intervals should feel "moderate"

### Weeks 5-6: Longer Intervals
**Goal:** Jog for extended periods
- Run/walk: 5 min jog, 1 min walk × 4 (24 min)
- Try one continuous 10-min jog mid-week
- Metric: One 10-min continuous jog

### Weeks 7-8: Race Ready
**Goal:** Run 5K continuously
- Week 7: 15 min jog + 5 min walk + 10 min jog
- Week 8: Attempt full 5K (3.1 miles), walk only if needed
- Metric: Complete 5K, time doesn't matter!

## Daily Checklist
- [ ] Set clothes out night before
- [ ] Alarm 5:45am (no snooze!)
- [ ] Light dynamic stretches before
- [ ] Log how you felt after each run (1-10)

## If You Miss a Day
- Don't double up - just continue schedule
- If you miss a week, repeat the previous week
- Consistency > perfection`,
    expectedScoreRange: [0.7, 0.95] as [number, number],
  },

  // POOR DECOMPOSITIONS
  {
    name: 'Poor decomposition - vague with no actionable steps',
    originalGoal: 'I want to lose 20 pounds in 4 months',
    userContext: 'Office worker, can exercise evenings, no gym membership, likes walking',
    decomposition: `Sure! You should:
- Eat less
- Exercise more  
- Stay motivated
- Drink water

You can do this! Just work hard and the weight will come off. Believe in yourself! 💪`,
    expectedScoreRange: [0.0, 0.3] as [number, number],
  },
  
  {
    name: 'Poor decomposition - unrealistic and dangerous',
    originalGoal: 'I want to lose 20 pounds in 4 months',
    userContext: 'Office worker, can exercise evenings, no gym membership, likes walking',
    decomposition: `Let's get aggressive! Here's how to lose that weight FAST:

Week 1-2: Lose 10 lbs
- Eat only 800 calories per day
- Exercise twice a day (2 hours total)
- No carbs at all

Week 3-4: Lose 10 more lbs
- Drop to 600 calories
- Add a third workout session
- Only protein and vegetables

You'll hit your goal in ONE month, not four!`,
    expectedScoreRange: [0.0, 0.25] as [number, number],
  },
  
  {
    name: 'Mediocre decomposition - structure but generic',
    originalGoal: 'I want to improve my sleep quality',
    userContext: `User Profile:
- Works late shifts ending at 11pm (Mon-Fri)
- Has young child (2 years old)
- Currently sleeps 5-6 hours, wakes up tired
- Drinks 3 coffees per day, last one around 6pm
- Uses phone in bed`,
    decomposition: `Here's a general sleep improvement plan:

Week 1-2: Start going to bed earlier
Week 3-4: Reduce screen time before bed
Week 5-6: Try to relax more
Week 7-8: Establish a routine

Tips:
- Don't drink coffee late
- Make your room dark
- Get exercise during the day

Track your sleep and see if it improves!`,
    expectedScoreRange: [0.3, 0.55] as [number, number],
  },

  // EDGE CASES
  {
    name: 'Edge case - good structure but ignores constraints',
    originalGoal: 'I want to build muscle and get stronger',
    userContext: `User Profile:
- Has no gym access (rural area, 1 hour from nearest gym)
- Limited equipment: just resistance bands and a yoga mat
- Budget: $0 for new equipment
- Works from home, very flexible schedule
- Has lower back issues - doctor said avoid heavy lifting`,
    decomposition: `Great goal! Here's your 12-week strength program:

## Phase 1 (Weeks 1-4): Foundation
- Join a gym with good equipment
- Start with compound lifts: Squat, Deadlift, Bench Press
- 3x per week, focus on form

## Phase 2 (Weeks 5-8): Progressive Overload
- Increase weights by 5 lbs each week
- Add Olympic lifts for explosive power
- Consider hiring a personal trainer

## Phase 3 (Weeks 9-12): Specialization  
- Focus on weak points
- Invest in home gym equipment ($500-1000)
- Consider protein supplements

Track your lifts in a workout journal!`,
    expectedScoreRange: [0.2, 0.45] as [number, number],
  },
];

/**
 * Run goal decomposition evaluation suite
 */
export async function runGoalDecompositionEval(): Promise<{
  passed: number;
  failed: number;
  results: Array<{ name: string; score: number; passed: boolean; reason: string }>;
}> {
  const results: Array<{ name: string; score: number; passed: boolean; reason: string }> = [];
  let passed = 0;
  let failed = 0;

  for (const testCase of goalDecompositionTestCases) {
    const result = await evaluateGoalDecomposition({
      originalGoal: testCase.originalGoal,
      userContext: testCase.userContext,
      decomposition: testCase.decomposition,
    });

    const isPassed = result.score >= testCase.expectedScoreRange[0] &&
                     result.score <= testCase.expectedScoreRange[1];

    if (isPassed) passed++;
    else failed++;

    results.push({
      name: testCase.name,
      score: result.score,
      passed: isPassed,
      reason: result.reason,
    });
  }

  return { passed, failed, results };
}
