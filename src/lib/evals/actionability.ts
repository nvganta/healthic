import { Opik } from 'opik';

const opik = new Opik({ projectName: 'healthic-evals' });

// Actionability evaluation prompt template
const ACTIONABILITY_PROMPT = `You are evaluating whether a health coach's advice is actionable.

ACTIONABLE advice contains:
- Specific actions (not vague suggestions)
- Concrete times, quantities, or durations
- Something the user can act on TODAY or THIS WEEK

NOT ACTIONABLE advice examples:
- "Eat healthier" (too vague)
- "Exercise more" (no specifics)
- "Try to sleep better" (no concrete steps)

ACTIONABLE advice examples:
- "Walk for 20 minutes after lunch" (specific action + time)
- "Swap your afternoon chips for greek yogurt" (specific substitution)
- "Drink 8 glasses of water today" (specific quantity)
- "Go to bed by 10pm tonight" (specific time)

User's question: {input}
Coach's response: {output}

Score the advice on a scale of 0.0 to 1.0:
- 0.0: Completely vague, no actionable content
- 0.3: Some suggestions but lacks specifics
- 0.6: Has actionable elements but could be more specific
- 0.8: Good actionable advice with specific details
- 1.0: Excellent, highly specific and immediately actionable

Respond in JSON format:
{
  "score": <number between 0 and 1>,
  "reason": "<brief explanation of why this score was given>"
}`;

interface ActionabilityInput {
  input: string;  // User's question/message
  output: string; // Agent's response
}

interface EvalResult {
  score: number;
  reason: string;
}

/**
 * Evaluates whether a health coach response contains actionable advice.
 * Uses LLM-as-judge pattern with the Gemini model.
 */
export async function evaluateActionability(
  input: ActionabilityInput
): Promise<EvalResult> {
  const trace = opik.trace({
    name: 'actionability_eval',
    input: { userMessage: input.input, agentResponse: input.output },
    metadata: { evalType: 'actionability' },
  });

  try {
    // Call the Gemini API to evaluate
    const prompt = ACTIONABILITY_PROMPT
      .replace('{input}', input.input)
      .replace('{output}', input.output);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_GENAI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const result: EvalResult = JSON.parse(jsonMatch[0]);

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
export const actionabilityTestCases = [
  {
    name: 'vague_advice',
    input: 'I want to lose weight',
    output: 'Try to eat healthier and exercise more. It\'s important to stay motivated!',
    expectedScoreRange: [0, 0.4], // Should score low
  },
  {
    name: 'specific_advice',
    input: 'I want to lose weight',
    output: 'Let\'s start with two changes today: 1) Replace your afternoon snack with a handful of almonds (about 20), and 2) Take a 15-minute walk after dinner tonight. We\'ll build from there.',
    expectedScoreRange: [0.7, 1.0], // Should score high
  },
  {
    name: 'partial_advice',
    input: 'How can I sleep better?',
    output: 'You should try to go to bed earlier and avoid screens. Maybe try some relaxation techniques.',
    expectedScoreRange: [0.3, 0.6], // Should score medium
  },
];

/**
 * Run all actionability test cases and return results.
 */
export async function runActionabilityEval(): Promise<{
  passed: number;
  failed: number;
  results: Array<{ name: string; score: number; reason: string; passed: boolean }>;
}> {
  const results: Array<{ name: string; score: number; reason: string; passed: boolean }> = [];

  for (const testCase of actionabilityTestCases) {
    try {
      const result = await evaluateActionability({
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
