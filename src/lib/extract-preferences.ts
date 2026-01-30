import { sql } from '@/lib/db';
import { getOrCreateUser } from '@/agent/tools/user-helper';

interface ExtractedPreferences {
  dietary?: string[];
  health_conditions?: string[];
  exercise_preferences?: string[];
  schedule_constraints?: string[];
  dislikes?: string[];
}

/**
 * Extract user preferences from a chat message using Gemini.
 * Runs in the background on every user message.
 * If preferences are found, merges them into the user's profile in the database.
 */
export async function extractAndSavePreferences(userMessage: string, userId: string = 'default_user') {
  try {
    const extracted = await extractPreferences(userMessage);

    // If nothing was found, skip the DB update
    const hasPreferences = Object.values(extracted).some(
      (arr) => Array.isArray(arr) && arr.length > 0
    );

    if (!hasPreferences) {
      return { updated: false, preferences: extracted };
    }

    // Get user and merge preferences
    const user = await getOrCreateUser(userId);
    const existing: ExtractedPreferences = (user.preferences as ExtractedPreferences) || {};

    const merged = mergePreferences(existing, extracted);

    await sql`
      UPDATE users
      SET preferences = ${JSON.stringify(merged)}::jsonb,
          updated_at = NOW()
      WHERE id = ${user.id}
    `;

    console.log('📝 Preferences updated:', merged);
    return { updated: true, preferences: merged };
  } catch (error) {
    console.error('Error extracting preferences:', error);
    return { updated: false, preferences: {} };
  }
}

/**
 * Call Gemini to extract preferences from a message.
 */
async function extractPreferences(message: string): Promise<ExtractedPreferences> {
  const prompt = `Extract any personal health preferences, constraints, or conditions from this user message. Only extract what is clearly stated, do not infer or guess.

Categories:
- dietary: Food restrictions or preferences (e.g., "vegetarian", "lactose intolerant", "no gluten")
- health_conditions: Physical conditions or injuries (e.g., "knee pain", "asthma", "diabetes")
- exercise_preferences: Exercise likes or preferences (e.g., "prefers swimming", "likes yoga", "hates running")
- schedule_constraints: Time or schedule limitations (e.g., "works night shift", "only free in evenings", "busy on weekdays")
- dislikes: Things the user dislikes or wants to avoid (e.g., "hates mornings", "doesn't like gyms")

User message: "${message}"

If nothing relevant is found in any category, return an empty array for that category.
Return ONLY valid JSON with the categories above.`;

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
  return JSON.parse(text);
}

/**
 * Merge new preferences into existing ones, avoiding duplicates.
 */
function mergePreferences(
  existing: ExtractedPreferences,
  incoming: ExtractedPreferences
): ExtractedPreferences {
  const categories: (keyof ExtractedPreferences)[] = [
    'dietary',
    'health_conditions',
    'exercise_preferences',
    'schedule_constraints',
    'dislikes',
  ];

  const merged: ExtractedPreferences = { ...existing };

  for (const category of categories) {
    const existingItems = existing[category] || [];
    const newItems = incoming[category] || [];

    if (newItems.length > 0) {
      const combined = [...existingItems];
      for (const item of newItems) {
        const lower = item.toLowerCase();
        const alreadyExists = combined.some(
          (e) => e.toLowerCase() === lower
        );
        if (!alreadyExists) {
          combined.push(item);
        }
      }
      merged[category] = combined;
    }
  }

  return merged;
}

/**
 * Get stored preferences for a user.
 */
export async function getUserPreferences(userId: string = 'default_user'): Promise<ExtractedPreferences> {
  const user = await getOrCreateUser(userId);
  return (user.preferences as ExtractedPreferences) || {};
}
