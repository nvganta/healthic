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

    const prompt = `Analyze this health coach response and extract any questions being asked to the user. For each question, generate exactly 2 short, common answer options that most people would pick from.

Rules:
- Only extract direct questions aimed at the user (ignore rhetorical questions)
- Each question needs exactly 2 concise answer options (the UI adds an "Other" option automatically)
- Options should be short (1-5 words) and represent the most common answers
- If there are no real questions to the user, return hasQuestions: false
- Generate a short title for the question panel (e.g., "Quick Questions", "Tell me more", "About your goals")
- Maximum 5 questions

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
