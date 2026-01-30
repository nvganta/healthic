import { Opik } from 'opik';
import { callEvalApi, clampScore } from './utils';

const opik = new Opik({ projectName: 'healthic-evals' });

// ============================================================================
// CHECK-IN TIMING EVAL
// ============================================================================

const CHECKIN_TIMING_PROMPT = `You are an expert evaluator assessing the quality of a health coach's check-in timing decisions.

## EVALUATION DIMENSIONS

### 1. Activity Gap Awareness (Weight: 30%)
- EXCELLENT: Recognizes 3+ day gaps, tracks patterns
- GOOD: Notes inactivity but timing slightly off
- POOR: Ignores activity patterns entirely

### 2. Emotional/Progress Triggers (Weight: 30%)
- EXCELLENT: Responds to declining mood, missed goals, struggles
- GOOD: Some awareness of user state
- POOR: No consideration of user's current situation

### 3. Frequency Calibration (Weight: 20%)
- EXCELLENT: Appropriate spacing, respects preferences
- GOOD: Generally good but minor frequency issues
- POOR: Too frequent (nagging) or too sparse (neglectful)

### 4. Context Sensitivity (Weight: 20%)
- EXCELLENT: Considers schedule, time zones, stated preferences
- GOOD: Some context awareness
- POOR: Ignores user constraints and preferences

## INPUT DATA

### User Context:
{userContext}

### Check-in Decision & Reasoning:
{checkInDecision}

## SCORING RUBRIC

Score 0.0-0.2: CRITICAL - Check-in will likely damage user relationship
Score 0.3-0.4: POOR - Questionable timing, needs improvement
Score 0.5-0.6: ACCEPTABLE - Reasonable but could be better calibrated
Score 0.7-0.8: GOOD - Well-timed with clear justification
Score 0.9-1.0: EXCELLENT - Perfect timing, demonstrates deep user understanding

## RESPONSE FORMAT

Respond ONLY with valid JSON:
{
  "score": <number 0.0-1.0>,
  "reason": "<2-3 sentence explanation>",
  "dimension_scores": {
    "activity_gap_awareness": <0.0-1.0>,
    "emotional_triggers": <0.0-1.0>,
    "frequency_calibration": <0.0-1.0>,
    "context_sensitivity": <0.0-1.0>
  },
  "timing_factors_positive": ["<factors that support good timing>"],
  "timing_factors_negative": ["<factors that indicate poor timing>"],
  "recommendation": "<specific improvement suggestion if score < 0.8>"
}`;

interface CheckInTimingInput {
  userContext: string;  // User's recent activity, patterns, preferences
  checkInDecision: string; // The check-in decision and reasoning
}

interface DimensionScores {
  activity_gap_awareness: number;
  emotional_triggers: number;
  frequency_calibration: number;
  context_sensitivity: number;
}

interface CheckInTimingResult {
  score: number;
  reason: string;
  dimension_scores: DimensionScores;
  timing_factors_positive: string[];
  timing_factors_negative: string[];
  recommendation: string;
}

/**
 * Evaluates whether a check-in decision was well-timed.
 * Uses multi-dimensional scoring for comprehensive assessment.
 */
export async function evaluateCheckInTiming(
  input: CheckInTimingInput
): Promise<CheckInTimingResult> {
  const defaultResult: CheckInTimingResult = {
    score: 0.5,
    reason: 'Evaluation could not be completed',
    dimension_scores: {
      activity_gap_awareness: 0.5,
      emotional_triggers: 0.5,
      frequency_calibration: 0.5,
      context_sensitivity: 0.5,
    },
    timing_factors_positive: [],
    timing_factors_negative: [],
    recommendation: '',
  };

  const trace = opik.trace({
    name: 'checkin_timing_eval',
    input: input as unknown as Record<string, unknown>,
    metadata: { evalType: 'checkin_timing', version: '2.0' },
  });

  try {
    const prompt = CHECKIN_TIMING_PROMPT
      .replace('{userContext}', input.userContext)
      .replace('{checkInDecision}', input.checkInDecision);

    const result = await callEvalApi<CheckInTimingResult>(prompt, defaultResult);

    // Validate score is within bounds
    result.score = clampScore(result.score);

    trace.update({
      output: result as unknown as Record<string, unknown>,
      metadata: { 
        status: 'success', 
        score: result.score,
        dimensionScores: result.dimension_scores,
      },
    });
    trace.end();
    await opik.flush();

    return result;
  } catch (error) {
    console.error('Check-in timing eval error:', error);
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
// TONE MATCHING EVAL
// ============================================================================

const TONE_MATCHING_PROMPT = `You are an expert evaluator assessing how well a health coach matched their communication tone to the user's emotional state.

## EVALUATION DIMENSIONS

### 1. Emotion Detection Accuracy (Weight: 25%)
- EXCELLENT: Correctly identifies primary and secondary emotions
- GOOD: Identifies primary emotion correctly
- POOR: Misreads emotional state entirely

### 2. Tone Calibration (Weight: 35%)
- EXCELLENT: Perfect match - empathetic to frustrated, celebratory to excited, etc.
- GOOD: Generally appropriate but minor calibration issues
- POOR: Mismatched - harsh to vulnerable, dismissive to excited

### 3. Preference Alignment (Weight: 20%)
- EXCELLENT: Honors stated preferences (tough love, gentle, balanced)
- GOOD: Somewhat aligned with preferences
- POOR: Ignores or contradicts stated preferences

### 4. Adaptive Response (Weight: 20%)
- EXCELLENT: Adjusts tone mid-response if appropriate
- GOOD: Consistent appropriate tone
- POOR: Rigid tone regardless of emotional cues

## EMOTION-TONE MAPPINGS (Reference)

| User Emotion | Appropriate Tones |
|--------------|-------------------|
| Frustrated | Empathetic, validating, supportive |
| Excited | Celebratory, enthusiastic, affirming |
| Discouraged | Encouraging, realistic, hopeful |
| Anxious | Calming, reassuring, grounding |
| Confused | Patient, clear, educational |
| Motivated | Energetic, challenging, goal-focused |

## INPUT DATA

### User's Message (with emotional cues):
{userMessage}

### User's Stated Tone Preference:
{tonePreference}

### Coach's Response:
{coachResponse}

## SCORING RUBRIC

Score 0.0-0.2: HARMFUL - Tone likely to damage rapport or cause distress
Score 0.3-0.4: POOR - Notable mismatch, needs significant improvement
Score 0.5-0.6: ACCEPTABLE - Adequate but not optimally calibrated
Score 0.7-0.8: GOOD - Well-matched with minor room for improvement
Score 0.9-1.0: EXCELLENT - Perfect emotional attunement

## RESPONSE FORMAT

Respond ONLY with valid JSON:
{
  "score": <number 0.0-1.0>,
  "reason": "<2-3 sentence explanation>",
  "dimension_scores": {
    "emotion_detection": <0.0-1.0>,
    "tone_calibration": <0.0-1.0>,
    "preference_alignment": <0.0-1.0>,
    "adaptive_response": <0.0-1.0>
  },
  "detected_emotions": {
    "primary": "<main emotion detected>",
    "secondary": "<secondary emotion if present, or 'none'>"
  },
  "tone_analysis": {
    "tone_used": "<dominant tone in response>",
    "appropriate_tones": ["<list of appropriate tones for this situation>"]
  },
  "specific_examples": {
    "good_phrases": ["<phrases that matched well>"],
    "problematic_phrases": ["<phrases that didn't match>"]
  },
  "recommendation": "<specific improvement if score < 0.8>"
}`;

interface ToneMatchingInput {
  userMessage: string;
  tonePreference: string;
  coachResponse: string;
}

interface ToneDimensionScores {
  emotion_detection: number;
  tone_calibration: number;
  preference_alignment: number;
  adaptive_response: number;
}

interface ToneMatchingResult {
  score: number;
  reason: string;
  dimension_scores: ToneDimensionScores;
  detected_emotions: {
    primary: string;
    secondary: string;
  };
  tone_analysis: {
    tone_used: string;
    appropriate_tones: string[];
  };
  specific_examples: {
    good_phrases: string[];
    problematic_phrases: string[];
  };
  recommendation: string;
}

/**
 * Evaluates whether the coach's tone matched the user's emotional state.
 * Uses multi-dimensional analysis for comprehensive assessment.
 */
export async function evaluateToneMatching(
  input: ToneMatchingInput
): Promise<ToneMatchingResult> {
  const defaultResult: ToneMatchingResult = {
    score: 0.5,
    reason: 'Evaluation could not be completed',
    dimension_scores: {
      emotion_detection: 0.5,
      tone_calibration: 0.5,
      preference_alignment: 0.5,
      adaptive_response: 0.5,
    },
    detected_emotions: {
      primary: 'unknown',
      secondary: 'none',
    },
    tone_analysis: {
      tone_used: 'unknown',
      appropriate_tones: [],
    },
    specific_examples: {
      good_phrases: [],
      problematic_phrases: [],
    },
    recommendation: '',
  };

  const trace = opik.trace({
    name: 'tone_matching_eval',
    input: input as unknown as Record<string, unknown>,
    metadata: { evalType: 'tone_matching', version: '2.0' },
  });

  try {
    const prompt = TONE_MATCHING_PROMPT
      .replace('{userMessage}', input.userMessage)
      .replace('{tonePreference}', input.tonePreference || 'Not specified')
      .replace('{coachResponse}', input.coachResponse);

    const result = await callEvalApi<ToneMatchingResult>(prompt, defaultResult);

    // Validate score is within bounds
    result.score = clampScore(result.score);

    trace.update({
      output: result as unknown as Record<string, unknown>,
      metadata: { 
        status: 'success', 
        score: result.score,
        primaryEmotion: result.detected_emotions?.primary,
        toneUsed: result.tone_analysis?.tone_used,
      },
    });
    trace.end();
    await opik.flush();

    return result;
  } catch (error) {
    console.error('Tone matching eval error:', error);
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

export const checkInTimingTestCases = [
  // GOOD TIMING CASES
  {
    name: 'Good timing - 5 days inactive with pattern break',
    userContext: `User's activity pattern:
- Usually logs meals daily (last 30 days: 28 logs)
- Last activity: 5 days ago
- No vacation or break mentioned
- Time zone: PST, typically active 7am-9pm`,
    checkInDecision: `Decided to check in because:
1. User has been inactive for 5 days (unusual - they normally log daily)
2. This pattern break could indicate struggle or disengagement
3. Waiting long enough to not feel intrusive but not too long to lose them`,
    expectedScoreRange: [0.7, 1.0] as [number, number],
  },
  {
    name: 'Good timing - declining mood with missed goals',
    userContext: `Recent user data:
- Missed weekly step target by 60%
- Mood logs: Mon: 7/10, Wed: 5/10, Fri: 3/10 (declining)
- Last message: "This week has been tough"
- Tone preference: gentle, supportive`,
    checkInDecision: `Reaching out because:
1. Clear declining mood trend (7 → 3 over the week)
2. Significantly missed goals (60% under target)
3. User's last message indicated struggle
4. Appropriate to offer support before weekend`,
    expectedScoreRange: [0.8, 1.0] as [number, number],
  },
  {
    name: 'Good timing - milestone approaching',
    userContext: `User context:
- Goal: Run first 5K on Saturday (2 days away)
- Has been training for 6 weeks
- Last check-in: 4 days ago
- Expressed nervousness about race day last week`,
    checkInDecision: `Checking in because:
1. Major milestone (first 5K) is 2 days away
2. User previously expressed pre-race anxiety
3. Good time to offer encouragement and tips
4. Not too close to overwhelm, not too far to forget`,
    expectedScoreRange: [0.8, 1.0] as [number, number],
  },
  
  // BAD TIMING CASES
  {
    name: 'Bad timing - just checked in yesterday',
    userContext: `Recent interactions:
- Coach sent check-in message yesterday at 2pm
- User replied "Thanks, all good!" at 3pm
- No new activity or concerning signals since`,
    checkInDecision: `Checking in again today to see how things are going and remind them about their water intake goal.`,
    expectedScoreRange: [0.0, 0.3] as [number, number],
  },
  {
    name: 'Bad timing - no clear trigger or reason',
    userContext: `User data:
- Logged activity today (on track with goals)
- Mood: 8/10 (happy)
- Last check-in: 2 days ago (appropriate frequency)
- Everything proceeding normally`,
    checkInDecision: `Sending a check-in message because it's been 2 days and want to stay engaged.`,
    expectedScoreRange: [0.2, 0.5] as [number, number],
  },
  {
    name: 'Bad timing - during stated busy period',
    userContext: `User preferences:
- Stated "Please don't message during work hours (9am-5pm EST)"
- Current time: 2pm EST (work hours)
- User mentioned having an important presentation today`,
    checkInDecision: `Sending check-in now because user hasn't logged lunch today and want to remind them about nutrition.`,
    expectedScoreRange: [0.0, 0.3] as [number, number],
  },
];

export const toneMatchingTestCases = [
  // GOOD TONE MATCHES
  {
    name: 'Excellent match - frustrated user receives validation and empathy',
    userMessage: "I'm SO frustrated! 😤 I've been doing EVERYTHING right - counting calories, exercising 5 days a week, drinking water - but the scale hasn't moved in 3 weeks! What's the point?!",
    tonePreference: 'gentle',
    coachResponse: "I hear you, and that frustration is completely valid. Three weeks of hard work with no scale movement would frustrate anyone! Here's the thing - your body might be going through changes that the scale can't capture. Muscle building, water retention, hormonal cycles... Let's look at the bigger picture together. How are your energy levels? How do your clothes fit? Sometimes our bodies need time to catch up to our efforts. You're doing amazing work - don't let one metric discourage you. 💪",
    expectedScoreRange: [0.8, 1.0] as [number, number],
  },
  {
    name: 'Excellent match - excited user receives celebration',
    userMessage: "OMG I just ran my first mile without stopping!!! 🏃‍♀️🎉 I never thought I could do it! I started 2 months ago barely able to run 30 seconds!!",
    tonePreference: 'balanced',
    coachResponse: "THIS IS INCREDIBLE!!! 🎉🏃‍♀️ A full mile non-stop - from 30 seconds to a MILE in just 2 months?! You should be SO proud of yourself! This is exactly the kind of progress that shows what you're capable of. How did it feel crossing that mental barrier? This milestone is proof that consistency pays off. You've just unlocked a whole new level! What's next on your running journey? 🌟",
    expectedScoreRange: [0.8, 1.0] as [number, number],
  },
  {
    name: 'Good match - anxious user receives calming reassurance',
    userMessage: "I'm really nervous about starting this new diet. What if I fail again like all the other times? I've tried so many things and nothing works for me. Maybe I'm just meant to be this way...",
    tonePreference: 'gentle',
    coachResponse: "I understand that nervousness completely, and it makes sense given your past experiences. Here's what I want you to know: this time is different because we're not doing a 'diet' - we're building sustainable habits together, one small step at a time. There's no pass or fail here. Every choice is just information that helps us adjust. Let's start with just ONE small change this week. What feels manageable to you? We'll build from there, at your pace. You're not alone in this.",
    expectedScoreRange: [0.7, 1.0] as [number, number],
  },
  {
    name: 'Good match - tough love preference gets direct feedback',
    userMessage: "I skipped my workout for the 4th day in a row. I keep making excuses. I'm pathetic.",
    tonePreference: 'tough_love',
    coachResponse: "Alright, let's cut through this. Four days is a pattern, not a slip-up. And calling yourself pathetic? That's not tough love, that's self-sabotage. Here's the deal: what's actually blocking you? Not the excuse - the REAL reason. Is it the time? The workout itself? Energy levels? Once we identify the real obstacle, we fix it. But I need you to be honest with yourself first. What's really going on?",
    expectedScoreRange: [0.7, 1.0] as [number, number],
  },

  // BAD TONE MATCHES
  {
    name: 'Poor match - harsh response to vulnerable user',
    userMessage: "I'm SO frustrated! 😤 I've been doing EVERYTHING right - counting calories, exercising 5 days a week, drinking water - but the scale hasn't moved in 3 weeks! What's the point?!",
    tonePreference: 'gentle',
    coachResponse: "Well, if you were really doing everything right, you'd see results. The scale doesn't lie. Are you sure you're tracking accurately? Most people underestimate their calories by 30-50%. Maybe review your food log and be more honest with yourself.",
    expectedScoreRange: [0.0, 0.3] as [number, number],
  },
  {
    name: 'Poor match - dismissive response to excitement',
    userMessage: "OMG I just ran my first mile without stopping!!! �‍♀️�🎉 I never thought I could do it!",
    tonePreference: 'balanced',
    coachResponse: "That's good. A mile is a decent starting point. Most runners can eventually do 3-5 miles, so you have a long way to go. Make sure you don't get injured by increasing too fast. Let me know when you're ready to work on real distance.",
    expectedScoreRange: [0.0, 0.4] as [number, number],
  },
  {
    name: 'Poor match - overly cheerful to anxious user',
    userMessage: "I'm really nervous about starting this new diet. What if I fail again like all the other times?",
    tonePreference: 'gentle',
    coachResponse: "Don't worry, this will be FUN! 🎉 Just stay positive and everything will work out! Failure is just a mindset - if you believe you'll succeed, you will! Let's get EXCITED about this journey! 💪🌟",
    expectedScoreRange: [0.2, 0.5] as [number, number],
  },
  {
    name: 'Poor match - gentle when tough love requested',
    userMessage: "I need you to be straight with me. I've been slacking off and making excuses. Don't sugarcoat it.",
    tonePreference: 'tough_love',
    coachResponse: "Oh, don't be so hard on yourself! Everyone has off days. You're doing your best, and that's what matters. Just try to do a little better tomorrow, okay? We all struggle sometimes. 🤗",
    expectedScoreRange: [0.2, 0.5] as [number, number],
  },
];

/**
 * Run check-in timing evaluation suite
 */
export async function runCheckInTimingEval(): Promise<{
  passed: number;
  failed: number;
  results: Array<{ name: string; score: number; passed: boolean; reason: string }>;
}> {
  const results: Array<{ name: string; score: number; passed: boolean; reason: string }> = [];
  let passed = 0;
  let failed = 0;

  for (const testCase of checkInTimingTestCases) {
    const result = await evaluateCheckInTiming({
      userContext: testCase.userContext,
      checkInDecision: testCase.checkInDecision,
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

/**
 * Run tone matching evaluation suite
 */
export async function runToneMatchingEval(): Promise<{
  passed: number;
  failed: number;
  results: Array<{ name: string; score: number; passed: boolean; reason: string }>;
}> {
  const results: Array<{ name: string; score: number; passed: boolean; reason: string }> = [];
  let passed = 0;
  let failed = 0;

  for (const testCase of toneMatchingTestCases) {
    const result = await evaluateToneMatching({
      userMessage: testCase.userMessage,
      tonePreference: testCase.tonePreference,
      coachResponse: testCase.coachResponse,
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
