import { FunctionTool } from '@google/adk';
import { z } from 'zod';

export const presentChoicesTool = new FunctionTool({
  name: 'present_choices',
  description: `Present multiple-choice questions to the user in a structured side panel.
Use this when you need to ask the user a set of questions with predefined options.
Each question should have exactly 2 specific options plus an "Other" option that is added automatically.
Examples: asking about dietary preferences, exercise preferences, schedule preferences, health conditions.
The user's answers will be sent back to you as a combined text message.`,
  parameters: z.object({
    title: z
      .string()
      .describe('Title for the question panel (e.g., "Quick Questions", "Tell me about yourself")'),
    questions: z
      .array(
        z.object({
          id: z
            .string()
            .describe('Unique identifier for the question (e.g., "diet_type", "exercise_freq")'),
          question: z.string().describe('The question text'),
          options: z
            .array(z.string())
            .min(2)
            .max(2)
            .describe(
              'Exactly 2 predefined options. An "Other" option with free text will be added automatically.'
            ),
        })
      )
      .min(1)
      .max(5)
      .describe('Array of 1-5 questions to present'),
  }),
  execute: async (params) => {
    return {
      success: true,
      type: 'present_choices',
      title: params.title,
      questions: params.questions.map((q) => ({
        ...q,
        options: [...q.options, 'Other'],
      })),
      message: 'Questions presented to user. Wait for their response.',
    };
  },
});
