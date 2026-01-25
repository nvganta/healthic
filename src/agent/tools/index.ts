export { saveGoalTool } from './save-goal';
export { logActivityTool } from './log-activity';
export { getGoalsTool } from './get-goals';
export { getRecentActivityTool } from './get-recent-activity';
export { decomposeGoalTool } from './decompose-goal';
export { detectPatternsTool } from './detect-patterns';

// New tools for conversation persistence and user profiles
export { updateUserProfileTool, getUserProfileTool } from './user-profile';
export { getWeeklyProgressTool, updateWeeklyProgressTool } from './weekly-progress';
export { 
  getOrCreateConversation, 
  saveMessage, 
  getConversationHistory,
  getUserConversations 
} from './conversation-helpers';
