/**
 * User-friendly error handling utilities
 * Maps technical errors to helpful, friendly messages
 */

// Error codes for different failure types
export enum ErrorCode {
  // Network errors
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  SERVER_UNAVAILABLE = 'SERVER_UNAVAILABLE',
  
  // API errors
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  
  // AI errors
  AI_OVERLOADED = 'AI_OVERLOADED',
  AI_RESPONSE_ERROR = 'AI_RESPONSE_ERROR',
  AI_CONTENT_FILTERED = 'AI_CONTENT_FILTERED',
  
  // Database errors
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',
  
  // Validation errors
  MESSAGE_TOO_LONG = 'MESSAGE_TOO_LONG',
  MESSAGE_EMPTY = 'MESSAGE_EMPTY',
  
  // Generic
  UNKNOWN = 'UNKNOWN',
}

// User-friendly error messages
export const errorMessages: Record<ErrorCode, { title: string; message: string; suggestion: string }> = {
  [ErrorCode.NETWORK_OFFLINE]: {
    title: "You're offline",
    message: "It looks like you've lost your internet connection.",
    suggestion: "Please check your connection and try again.",
  },
  [ErrorCode.NETWORK_TIMEOUT]: {
    title: "Request timed out",
    message: "The server is taking longer than expected to respond.",
    suggestion: "Please try again in a moment.",
  },
  [ErrorCode.SERVER_UNAVAILABLE]: {
    title: "Service temporarily unavailable",
    message: "Our servers are currently experiencing high demand.",
    suggestion: "Please wait a moment and try again.",
  },
  [ErrorCode.RATE_LIMITED]: {
    title: "Taking a breather",
    message: "You've sent a lot of messages! I need a quick break.",
    suggestion: "Please wait about a minute before sending another message.",
  },
  [ErrorCode.INVALID_REQUEST]: {
    title: "Something went wrong",
    message: "I couldn't process that message.",
    suggestion: "Please try rephrasing your message.",
  },
  [ErrorCode.UNAUTHORIZED]: {
    title: "Session expired",
    message: "Your session has expired.",
    suggestion: "Please refresh the page to continue.",
  },
  [ErrorCode.AI_OVERLOADED]: {
    title: "I'm a bit overwhelmed",
    message: "My brain is working overtime right now!",
    suggestion: "Please try again in a few seconds.",
  },
  [ErrorCode.AI_RESPONSE_ERROR]: {
    title: "I got confused",
    message: "I had trouble formulating a response.",
    suggestion: "Could you try asking that a different way?",
  },
  [ErrorCode.AI_CONTENT_FILTERED]: {
    title: "I can't respond to that",
    message: "I'm not able to provide a response to this type of question.",
    suggestion: "Please try asking something else related to your health goals.",
  },
  [ErrorCode.DB_CONNECTION_FAILED]: {
    title: "Memory issues",
    message: "I'm having trouble accessing my memory right now.",
    suggestion: "Your conversation will continue, but I might not remember previous context.",
  },
  [ErrorCode.DB_QUERY_FAILED]: {
    title: "Couldn't save that",
    message: "I had trouble saving that information.",
    suggestion: "Don't worry, you can tell me again if needed.",
  },
  [ErrorCode.MESSAGE_TOO_LONG]: {
    title: "That's a lot!",
    message: "Your message is too long for me to process at once.",
    suggestion: "Try breaking it into smaller parts.",
  },
  [ErrorCode.MESSAGE_EMPTY]: {
    title: "Nothing to say?",
    message: "I didn't receive a message.",
    suggestion: "Type something and try again!",
  },
  [ErrorCode.UNKNOWN]: {
    title: "Oops!",
    message: "Something unexpected happened.",
    suggestion: "Please try again. If the problem persists, refresh the page.",
  },
};

/**
 * Parse an error and return a user-friendly error code
 */
export function parseError(error: unknown, statusCode?: number): ErrorCode {
  // Check for network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    // Check navigator.onLine only in browser context (not SSR)
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return ErrorCode.NETWORK_OFFLINE;
    }
    return ErrorCode.NETWORK_TIMEOUT;
  }
  
  // Check status codes
  if (statusCode) {
    if (statusCode === 429) return ErrorCode.RATE_LIMITED;
    if (statusCode === 401) return ErrorCode.UNAUTHORIZED;
    if (statusCode === 400) return ErrorCode.INVALID_REQUEST;
    if (statusCode === 503) return ErrorCode.SERVER_UNAVAILABLE;
    if (statusCode >= 500) return ErrorCode.AI_OVERLOADED;
  }
  
  // Check error messages for specific patterns
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    if (msg.includes('timeout')) return ErrorCode.NETWORK_TIMEOUT;
    if (msg.includes('rate') || msg.includes('quota')) return ErrorCode.RATE_LIMITED;
    if (msg.includes('database') || msg.includes('db')) return ErrorCode.DB_CONNECTION_FAILED;
    if (msg.includes('too long')) return ErrorCode.MESSAGE_TOO_LONG;
    if (msg.includes('empty') || msg.includes('required')) return ErrorCode.MESSAGE_EMPTY;
    if (msg.includes('filter') || msg.includes('blocked')) return ErrorCode.AI_CONTENT_FILTERED;
  }
  
  return ErrorCode.UNKNOWN;
}

/**
 * Get user-friendly error info
 */
export function getUserFriendlyError(error: unknown, statusCode?: number) {
  const code = parseError(error, statusCode);
  return {
    code,
    ...errorMessages[code],
  };
}

/**
 * Format an error for display in the chat
 */
export function formatErrorForChat(error: unknown, statusCode?: number): string {
  const { title, message, suggestion } = getUserFriendlyError(error, statusCode);
  return `**${title}**\n\n${message}\n\n💡 ${suggestion}`;
}
