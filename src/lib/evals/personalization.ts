import { Opik } from 'opik';

const opik = new Opik({ projectName: 'healthic-evals' });

// Personalization evaluation prompt template
const PERSONALIZATION_PROMPT = `You are evaluating whether a health coach's advice is personalized to the user.

PERSONALIZED advice:
- References the user's stated preferences, constraints, or history
- Accounts for what the user has shared about themselves
- Adapts recommendations to the individual, not generic advice

NOT PERSONALIZED (generic) advice:
- Could apply to anyone with no customization
- Ignores stated preferences or constraints
- Uses one-size-fits-all recommendations

User Context: {context}
User's question: {input}
Coach's response: {output}

Consider these personalization failures:
- User said they hate running → coach suggests running routine
- User mentioned being vegetarian → coach suggests chicken
- User said they work nights → coach suggests morning workouts
- User has knee injury → coach suggests high-impact exercises

Score the advice on a scale of 0.0 to 1.0:
- 0.0: Completely generic, ignores all user context
- 0.3: Minimal acknowledgment of user context
- 0.6: Some personalization but misses key context
- 0.8: Well-personalized, incorporates most context
- 1.0: Excellent, fully tailored to user's specific situation

Respond in JSON format:
{
  "score": <number between 0 and 1>,
  "reason": "<brief explanation of why this score was given>"
}`;

interface PersonalizationInput {
  context: string;  // User's known preferences, constraints, history
  input: string;    // User's question/message
  output: string;   // Agent's response
}

interface EvalResult {
  score: number;
  reason: string;
}

/**
 * Evaluates whether a health coach response is personalized to the user.
 * Uses LLM-as-judge pattern with the Gemini model.
 */
export async function evaluatePersonalization(
  input: PersonalizationInput
): Promise<EvalResult> {
  const trace = opik.trace({
    name: 'personalization_eval',
    input: {
      context: input.context,
      userMessage: input.input,
      agentResponse: input.output,
    },
    metadata: { evalType: 'personalization' },
  });

  try {
    const prompt = PERSONALIZATION_PROMPT
      .replace('{context}', input.context)
      .replace('{input}', input.input)
      .replace('{output}', input.output);

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GOOGLE_GENAI_API_KEY || '',
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

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    const result: EvalResult = JSON.parse(text);

    trace.update({
      output: result,
      metadata: { status: 'success', score: result.score },
    });
    trace.end();
    await opik.flush();

    return result;
  } catch (error) {
    trace.update({
      output: { error: String(error) },
      metadata: { status: 'error' },
    });
    trace.end();
    await opik.flush();

    throw error;
  }
}

// Test data for running the evaluation
export const personalizationTestCases = [
  {
    name: 'ignores_constraint',
    context: 'User is vegetarian and has mentioned they hate running',
    input: 'Can you suggest a workout plan?',
    output: 'I recommend starting your day with a 30-minute run. For protein, include chicken breast in your meals.',
    expectedScoreRange: [0, 0.3], // Should score very low - ignores both constraints
  },
  {
    name: 'fully_personalized',
    context: 'User is vegetarian, works night shifts, and prefers low-impact exercise due to knee issues',
    input: 'Can you suggest a workout plan?',
    output: 'Given your night shifts, let\'s plan workouts for after you wake up, around 4pm. Since you need low-impact options for your knee, I suggest swimming or cycling for 20-30 minutes. For protein, we\'ll focus on tofu, lentils, and tempeh to support your vegetarian diet.',
    expectedScoreRange: [0.8, 1.0], // Should score high - addresses all context
  },
  {
    name: 'generic_advice',
    context: 'User has mentioned they struggle with mornings and prefer evening activities',
    input: 'How should I start my fitness journey?',
    output: 'Start by waking up early and exercising in the morning. This is the best time for workouts as it boosts your metabolism all day.',
    expectedScoreRange: [0, 0.4], // Should score low - directly contradicts preference
  },
  {
    name: 'partial_personalization',
    context: 'User is training for a 5K, currently can run 1 mile, and has 8 weeks',
    input: 'What should my training plan look like?',
    output: 'Since you\'re training for a 5K, you should gradually increase your distance. Try running 3 times a week.',
    expectedScoreRange: [0.4, 0.7], // Acknowledges goal but doesn't fully personalize to current ability and timeline
  },
];

/**
 * Run all personalization test cases and return results.
 */
export async function runPersonalizationEval(): Promise<{
  passed: number;
  failed: number;
  results: Array<{ name: string; score: number; reason: string; passed: boolean }>;
}> {
  const results: Array<{ name: string; score: number; reason: string; passed: boolean }> = [];

  for (const testCase of personalizationTestCases) {
    try {
      const result = await evaluatePersonalization({
        context: testCase.context,
        input: testCase.input,
        output: testCase.output,
      });

      const passed = result.score >= testCase.expectedScoreRange[0] &&
                     result.score <= testCase.expectedScoreRange[1];

      results.push({
        name: testCase.name,
        score: result.score,
        reason: result.reason,
        passed,
      });
    } catch (error) {
      results.push({
        name: testCase.name,
        score: 0,
        reason: `Error: ${error}`,
        passed: false,
      });
    }
  }

  return {
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results,
  };
}
