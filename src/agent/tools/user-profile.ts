import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { sql } from '@/lib/db';
import { getOrCreateUser } from './user-helper';

/**
 * Tool to update user profile with intake information.
 * Use this to store important details about the user that will help personalize their plan.
 */
export const updateUserProfileTool = new FunctionTool({
  name: 'update_user_profile',
  description: 'Save or update user profile information gathered during intake. Use this to store important details about the user that will help personalize their plan - like their current weight, activity level, dietary preferences, schedule, and what motivates them.',
  parameters: z.object({
    name: z.string().optional().describe("User's name"),
    preferences: z.object({
      currentWeight: z.number().optional().describe('Current weight in pounds'),
      targetWeight: z.number().optional().describe('Target weight in pounds'),
      height: z.string().optional().describe('Height (e.g., "5\'10")'),
      activityLevel: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active']).optional().describe('Current activity level'),
      dietaryPreferences: z.array(z.string()).optional().describe('Dietary preferences or restrictions (e.g., vegetarian, gluten-free)'),
      workSchedule: z.string().optional().describe('Typical work schedule (e.g., "9-5 weekdays", "shift work")'),
      exercisePreferences: z.array(z.string()).optional().describe('Types of exercise they enjoy (e.g., walking, swimming, weights)'),
      challenges: z.array(z.string()).optional().describe('Known challenges or obstacles (e.g., "stress eating", "no time in mornings")'),
      motivation: z.string().optional().describe('What motivates them (e.g., "want to keep up with my kids")'),
    }).describe('User preferences and profile data'),
    tonePreference: z.enum(['tough_love', 'gentle', 'balanced']).optional().describe('Preferred coaching tone - tough_love for direct feedback, gentle for encouragement, balanced for mix'),
  }),
  execute: async (params) => {
    try {
      // Get or create user (defaults to default_user for now)
      const user = await getOrCreateUser();
      
      // Merge new preferences with existing ones, handling arrays intelligently
      const existingPrefs = (user.preferences as Record<string, unknown>) || {};
      const newPreferences = { ...existingPrefs };
      
      // Handle array fields specially - merge instead of replace
      const arrayFields = ['dietaryPreferences', 'exercisePreferences', 'challenges'];
      
      for (const [key, value] of Object.entries(params.preferences)) {
        if (arrayFields.includes(key) && Array.isArray(value)) {
          // Merge arrays, avoiding duplicates
          const existingArray = Array.isArray(existingPrefs[key]) ? existingPrefs[key] as string[] : [];
          newPreferences[key] = [...new Set([...existingArray, ...value])];
        } else {
          // For non-array fields, replace as normal
          newPreferences[key] = value;
        }
      }
      
      await sql`
        UPDATE users 
        SET 
          name = COALESCE(${params.name || null}, name),
          preferences = ${JSON.stringify(newPreferences)},
          tone_preference = COALESCE(${params.tonePreference || null}, tone_preference),
          updated_at = NOW()
        WHERE id = ${user.id}
      `;
      
      return { 
        success: true, 
        message: 'Profile updated successfully. I now have a better understanding of your situation and can give you more personalized advice.' 
      };
    } catch (error) {
      console.error('Error updating user profile:', error);
      return { success: false, message: 'Failed to update profile. Please try again.' };
    }
  },
});

/**
 * Tool to get user profile for personalization.
 */
export const getUserProfileTool = new FunctionTool({
  name: 'get_user_profile',
  description: "Retrieve the user's profile information including their preferences, constraints, and coaching tone preference. Use this to personalize your advice and remember what you've learned about them.",
  parameters: z.object({}),
  execute: async () => {
    try {
      const user = await getOrCreateUser();
      
      return { 
        profile: {
          name: user.name,
          email: user.email,
          preferences: user.preferences || {},
          tonePreference: user.tone_preference,
          createdAt: user.created_at,
        },
        message: 'Profile retrieved successfully.'
      };
    } catch (error) {
      console.error('Error getting user profile:', error);
      return { profile: null, message: 'Failed to retrieve profile.' };
    }
  },
});
