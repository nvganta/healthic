interface ExtractedQuestion {
  id: string;
  question: string;
  options: string[];
}

interface ExtractedQuestions {
  hasQuestions: boolean;
  title: string;
  questions: ExtractedQuestion[];
}

/**
 * Post-process agent response to extract questions and generate clickable options.
 * Uses Gemini Flash to detect questions in the agent's text and create
 * structured choices for the side panel UI.
 */
export async function extractQuestionsFromResponse(agentResponse: string): Promise<ExtractedQuestions | null> {
  try {
    // Quick check: skip if response doesn't contain question marks
    if (!agentResponse.includes('?')) {
      return null;
    }

    // Skip extraction if response is a plan/advice (contains action items, schedules, etc.)
    const planIndicators = [
      'here\'s your plan',
      'here is your plan',
      'your plan:',
      'action plan',
      'weekly plan',
      'daily plan',
      'step 1',
      'week 1',
      'day 1',
      'monday:',
      'schedule:',
      'routine:',
      'here\'s what i recommend',
      'i recommend:',
      'let\'s start with',
    ];
    const lowerResponse = agentResponse.toLowerCase();
    if (planIndicators.some(indicator => lowerResponse.includes(indicator))) {
      return null;
    }

    const prompt = `Analyze this health coach response and extract ONLY information-gathering questions. Do NOT extract confirmation questions asked after giving advice.

Rules:
- ONLY extract questions that gather NEW information (preferences, constraints, details)
- DO NOT extract: "Does this work?", "Sound good?", "Ready to start?", "Any questions?" - these are confirmation questions
- DO NOT extract questions if the response contains a plan, schedule, or actionable advice
- Each question needs exactly 2 concise answer options (UI adds "Other" automatically)
- Options should be short (1-5 words) and represent common answers
- If the response is primarily advice/plan with a question at the end, return hasQuestions: false
- Generate a short title for the question panel
- Maximum 3 questions (fewer is better)

Agent response:
"${agentResponse.replace(/"/g, '\\"')}"

Return ONLY valid JSON in this format:
{
  "hasQuestions": true/false,
  "title": "panel title",
  "questions": [
    {
      "id": "q1",
      "question": "the question text",
      "options": ["Option A", "Option B"]
    }
  ]
}`;

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
    const result: ExtractedQuestions = JSON.parse(text);

    if (!result.hasQuestions || !result.questions || result.questions.length === 0) {
      return null;
    }

    // Add "Other" option to each question
    return {
      ...result,
      questions: result.questions.map((q) => ({
        ...q,
        options: [...q.options, 'Other'],
      })),
    };
  } catch (error) {
    console.error('Error extracting questions:', error);
    return null;
  }
}
