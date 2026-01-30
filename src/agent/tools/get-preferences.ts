import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { getUserPreferences } from '@/lib/extract-preferences';

export const getPreferencesTool = new FunctionTool({
  name: 'get_user_preferences',
  description:
    'Get stored user preferences, health conditions, dietary restrictions, and constraints. Use this to personalize your advice based on what the user has told you previously.',
  parameters: z.object({}),
  execute: async () => {
    try {
      const preferences = await getUserPreferences();

      const hasAny = Object.values(preferences).some(
        (arr) => Array.isArray(arr) && arr.length > 0
      );

      if (!hasAny) {
        return {
          success: true,
          preferences: {},
          message: 'No preferences stored yet. Ask the user about their dietary restrictions, health conditions, or schedule.',
        };
      }

      return {
        success: true,
        preferences,
        message: 'Retrieved user preferences. Use these to personalize your advice.',
      };
    } catch (error) {
      console.error('Error getting preferences:', error);
      return { success: false, preferences: {}, message: 'Failed to retrieve preferences.' };
    }
  },
});
