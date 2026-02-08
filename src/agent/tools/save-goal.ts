import { FunctionTool } from '@google/adk';
import { z } from 'zod';

// Helper function to parse target date
export function parseTargetDate(targetDateInput: string | undefined): string | null {
  if (!targetDateInput) return null;

  // Check if it's already a valid YYYY-MM-DD date
  if (/^\d{4}-\d{2}-\d{2}$/.test(targetDateInput)) {
    return targetDateInput;
  }

  // Try to parse relative date expressions
  const now = new Date();
  const lower = targetDateInput.toLowerCase();
  const numMatch = lower.match(/(\d+)/);
  const num = numMatch ? parseInt(numMatch[1]) : 1;

  if (lower.includes('month')) {
    now.setMonth(now.getMonth() + num);
    return now.toISOString().split('T')[0];
  } else if (lower.includes('week')) {
    now.setDate(now.getDate() + num * 7);
    return now.toISOString().split('T')[0];
  } else if (lower.includes('day')) {
    now.setDate(now.getDate() + num);
    return now.toISOString().split('T')[0];
  } else if (lower.includes('year')) {
    now.setFullYear(now.getFullYear() + num);
    return now.toISOString().split('T')[0];
  }
  // If we still can't parse it, return null rather than crashing
  return null;
}

export const saveGoalTool = new FunctionTool({
  name: 'save_goal',
  description:
    'Propose a health goal for the user. The goal will be shown to the user for approval before being saved. Use this when the user tells you about a goal they want to achieve.',
  parameters: z.object({
    title: z.string().describe('Short title for the goal'),
    description: z.string().describe('Detailed description of the goal'),
    goalType: z
      .enum(['weight_loss', 'exercise', 'sleep', 'nutrition', 'habit', 'other'])
      .describe('Category of the goal'),
    targetValue: z
      .number()
      .optional()
      .describe('Target number if applicable (e.g., 20 for losing 20 pounds)'),
    targetUnit: z.string().optional().describe('Unit for the target (e.g., pounds, hours, days)'),
    targetDate: z.string().optional().describe('Target date in YYYY-MM-DD format'),
  }),
  execute: async (params) => {
    try {
      const targetDate = parseTargetDate(params.targetDate);

      // Return a proposal instead of saving directly
      // The chat route will intercept this and show it to the user for approval
      const proposedGoal = {
        title: params.title,
        description: params.description,
        goalType: params.goalType,
        targetValue: params.targetValue ?? null,
        targetUnit: params.targetUnit ?? null,
        targetDate: targetDate,
      };

      console.log('Goal proposed for approval:', proposedGoal);

      return {
        success: true,
        proposal: true,
        proposedGoal,
        message: `I've prepared your goal "${params.title}". Now I'll create a weekly breakdown for you to review before saving.`,
      };
    } catch (error) {
      console.error('Error preparing goal proposal:', error);
      return { success: false, message: 'Failed to prepare goal. Please try again.' };
    }
  },
});
