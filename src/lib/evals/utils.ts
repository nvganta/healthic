/**
 * Shared utilities for evaluation modules
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

export const EVAL_CONFIG = {
  maxRetries: 2,
  retryDelayMs: 1000,
  apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
};

// ============================================================================
// API HELPER
// ============================================================================

export class EvalApiError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_API_KEY' | 'API_ERROR' | 'PARSE_ERROR' | 'EMPTY_RESPONSE',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'EvalApiError';
  }
}

export interface CallEvalApiOptions {
  /** Maximum number of retry attempts (default: 2) */
  maxRetries?: number;
  /** Delay between retries in ms (default: 1000) */
  retryDelayMs?: number;
  /** Whether to throw on missing API key (default: false for backward compatibility) */
  throwOnMissingKey?: boolean;
}

/**
 * Shared helper function to make evaluation API calls with retry logic.
 * 
 * @param prompt - The prompt to send to the API
 * @param defaultResult - The default result to return on failure
 * @param options - Configuration options
 * @returns The parsed API response or default result
 * 
 * @example
 * ```typescript
 * const result = await callEvalApi<MyResultType>(prompt, defaultResult);
 * ```
 */
export async function callEvalApi<T>(
  prompt: string, 
  defaultResult: T,
  options: CallEvalApiOptions = {}
): Promise<T> {
  const {
    maxRetries = EVAL_CONFIG.maxRetries,
    retryDelayMs = EVAL_CONFIG.retryDelayMs,
    throwOnMissingKey = false,
  } = options;

  const apiKey = process.env.GOOGLE_GENAI_API_KEY;
  
  if (!apiKey) {
    const message = 'GOOGLE_GENAI_API_KEY not configured. Evaluation will return default result.';
    console.warn(`⚠️  ${message}`);
    
    if (throwOnMissingKey) {
      throw new EvalApiError(message, 'NO_API_KEY');
    }
    
    return defaultResult;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(EVAL_CONFIG.apiEndpoint, {
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
      });

      if (!response.ok) {
        throw new EvalApiError(
          `API returned ${response.status}: ${response.statusText}`,
          'API_ERROR',
          { status: response.status, statusText: response.statusText }
        );
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new EvalApiError('Empty response from API', 'EMPTY_RESPONSE', data);
      }

      try {
        return JSON.parse(text) as T;
      } catch (parseError) {
        throw new EvalApiError(
          'Failed to parse API response as JSON',
          'PARSE_ERROR',
          { text, parseError }
        );
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`API call attempt ${attempt + 1}/${maxRetries + 1} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  console.error('All API call attempts failed. Returning default result.');
  return defaultResult;
}

/**
 * Validate and clamp a score to the 0-1 range
 */
export function clampScore(score: number): number {
  if (typeof score !== 'number' || isNaN(score)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, score));
}
