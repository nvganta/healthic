'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ChoicesPanel from './ChoicesPanel';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: Array<{ name: string; args: unknown }>;
}

interface ChoicesData {
  title: string;
  questions: Array<{
    id: string;
    question: string;
    options: string[];
  }>;
}

// Icons
const SendIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const SparkleIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
  </svg>
);

const TargetIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ActivityIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const MoonIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const HeartIcon = () => (
  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

// Format tool name to be more readable
const formatToolName = (name: string) => {
  return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Get icon for tool
const getToolIcon = (toolName: string) => {
  if (toolName.includes('goal')) return <TargetIcon />;
  if (toolName.includes('activity')) return <ActivityIcon />;
  if (toolName.includes('sleep')) return <MoonIcon />;
  return <SparkleIcon />;
};

// Simple markdown-like formatting
const formatMessage = (content: string) => {
  // Convert **bold** to <strong>
  let formatted = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Convert *italic* to <em>
  formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Convert bullet points
  formatted = formatted.replace(/^\* /gm, '&bull; ');
  return formatted;
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [activeChoices, setActiveChoices] = useState<ChoicesData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  // Load conversation history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch('/api/conversations');
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          setConversationId(data.conversation?.id || null);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    }
    loadHistory();
  }, []);

  // Save a message to the database
  const saveMessage = async (role: 'user' | 'assistant', content: string, toolCalls?: Array<{ name: string; args: unknown }>) => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, role, content, toolCalls }),
      });
      const data = await res.json();
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  };

  const sendMessage = async (messageText?: string) => {
    const text = messageText ?? input.trim();
    if (!text || isLoading) return;

    const userMessage = text;
    const userMsgId = crypto.randomUUID();
    if (!messageText) setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', content: userMessage }]);
    setIsLoading(true);

    // Save user message to database
    saveMessage('user', userMessage);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const assistantContent = data.response || 'No response';
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: assistantContent,
            toolCalls: data.toolCalls,
          },
        ]);
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }
        // Show choices panel if agent used present_choices tool
        if (data.choicesData) {
          setActiveChoices(data.choicesData);
        }
        // Save assistant message to database
        saveMessage('assistant', assistantContent, data.toolCalls);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: `Sorry, something went wrong. Please try again.` },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: 'Unable to connect. Please check your connection and try again.' },
      ]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleChoicesSubmit = (answers: string) => {
    setActiveChoices(null);
    sendMessage(answers);
  };

  const handleChoicesDismiss = () => {
    setActiveChoices(null);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    textareaRef.current?.focus();
  };

  const suggestions = [
    { text: "I want to lose 20 pounds in 3 months", icon: <TargetIcon /> },
    { text: "Help me start exercising regularly", icon: <ActivityIcon /> },
    { text: "I need to improve my sleep schedule", icon: <MoonIcon /> },
  ];

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-3 text-slate-400">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce-soft" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce-soft" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce-soft" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm">Loading conversation...</span>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full animate-fade-in">
              {/* Welcome card */}
              <div className="max-w-lg w-full">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-xl shadow-emerald-200 mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to Healthic</h2>
                  <p className="text-slate-500">
                    I&apos;m your personal health coach. Tell me about a goal you want to achieve,
                    and I&apos;ll help you create an actionable plan.
                  </p>
                </div>

                {/* Suggestion cards */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-400 text-center">Try one of these:</p>
                  {suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(suggestion.text)}
                      className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-emerald-100 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-100 transition-all duration-200 group"
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                        {suggestion.icon}
                      </div>
                      <span className="text-left text-slate-700 font-medium">{suggestion.text}</span>
                      <svg className="w-5 h-5 text-slate-300 ml-auto group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-1">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`flex items-start gap-3 px-4 py-4 rounded-xl animate-fade-in ${
                    message.role === 'user'
                      ? 'bg-emerald-50/70 border-l-4 border-emerald-400'
                      : 'bg-white'
                  }`}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
                    message.role === 'user'
                      ? 'bg-emerald-200 text-emerald-700'
                      : 'bg-gradient-to-br from-emerald-400 to-teal-500'
                  }`}>
                    {message.role === 'user' ? <UserIcon /> : <HeartIcon />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold mb-1 ${
                      message.role === 'user' ? 'text-emerald-700' : 'text-teal-600'
                    }`}>
                      {message.role === 'user' ? 'You' : 'Healthic'}
                    </p>
                    <div
                      className="message-content whitespace-pre-wrap leading-relaxed text-slate-700"
                      dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                    />
                    {message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                        {message.toolCalls.map((tool, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full px-3 py-1"
                          >
                            {getToolIcon(tool.name || '')}
                            {formatToolName(tool.name || 'action')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-start gap-3 px-4 py-4 rounded-xl bg-white animate-fade-in">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white animate-pulse-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-teal-600 mb-1">Healthic</p>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce-soft" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce-soft" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce-soft" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm text-slate-400">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-emerald-100 bg-white/80 backdrop-blur-md p-4">
          <form onSubmit={handleFormSubmit} className="max-w-3xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tell me about your health goals..."
                  rows={1}
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-slate-400 transition-all resize-none overflow-y-auto"
                  style={{ maxHeight: '150px' }}
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 disabled:shadow-none"
              >
                <SendIcon />
              </button>
            </div>
            <p className="text-xs text-center text-slate-400 mt-3">
              Healthic provides guidance, not medical advice. Consult a healthcare professional for medical concerns.
            </p>
          </form>
        </div>
      </div>

      {/* Choices panel (right side) */}
      {activeChoices && (
        <>
          {/* Mobile backdrop */}
          <div className="md:hidden fixed inset-0 bg-black/30 z-40" onClick={handleChoicesDismiss} />
          <ChoicesPanel
            title={activeChoices.title}
            questions={activeChoices.questions}
            onSubmit={handleChoicesSubmit}
            onDismiss={handleChoicesDismiss}
          />
        </>
      )}
    </div>
  );
}
