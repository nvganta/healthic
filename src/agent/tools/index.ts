export { saveGoalTool } from './save-goal';
export { logActivityTool } from './log-activity';
export { getGoalsTool } from './get-goals';
export { getRecentActivityTool } from './get-recent-activity';
export { decomposeGoalTool } from './decompose-goal';
export { detectPatternsTool } from './detect-patterns';

// Phase 2: Conversation persistence and user profiles
export { updateUserProfileTool, getUserProfileTool } from './user-profile';
export { getWeeklyProgressTool, updateWeeklyProgressTool } from './weekly-progress';
export { 
  getOrCreateConversation, 
  saveMessage, 
  getConversationHistory,
  getUserConversations 
} from './conversation-helpers';

// Phase 3: Proactive check-ins
export { 
  checkForProactiveOutreachTool, 
  recordCheckInTool, 
  recordCheckInResponseTool 
} from './proactive-checkins';

// Phase 3: Plan adaptation
export { 
  analyzePlanEffectivenessTool, 
  applyPlanAdaptationTool, 
  getAdaptationHistoryTool 
} from './plan-adaptation';

// Phase 3: Context retrieval (vector search)
export { 
  storeInsightTool, 
  searchContextTool, 
  indexConversationTool, 
  findSimilarSituationsTool 
} from './context-retrieval';

// Phase 3: Tone calibration
export { 
  calibrateToneTool, 
  updateTonePreferenceTool, 
  getToneGuidanceTool 
} from './tone-calibration';

// Phase 3 Advanced: Emotional Intelligence
export {
  analyzeSentimentTool,
  getConversationContextTool,
  detectEscalationTool
} from './emotional-intelligence';

// Phase 3 Advanced: Smart Scheduling
export {
  learnOptimalTimingTool,
  getSmartCheckInScheduleTool,
  generateCheckInMessageTool
} from './smart-scheduling';

// Phase 3 Advanced: User Portrait & Memory
export {
  getUserPortraitTool,
  getCrossSessionContinuityTool,
  markForFollowUpTool,
  updateUserPortraitTool
} from './user-portrait';
