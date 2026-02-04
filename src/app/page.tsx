'use client';

import { useState } from 'react';
import Chat from '@/components/Chat';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import ProfileModal from '@/components/ProfileModal';
import SettingsModal from '@/components/SettingsModal';
import GoalsModal from '@/components/GoalsModal';
import ActivityModal from '@/components/ActivityModal';

interface ConversationItem {
  id: string;
  startedAt: string;
  lastMessageAt: string;
  lastMessage: string;
}

export default function Home() {
  const [chatKey, setChatKey] = useState(0);
  const [isNewChat, setIsNewChat] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGoalsOpen, setIsGoalsOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'dashboard'>('chat');

  const handleNewChat = () => {
    setIsNewChat(true);
    setActiveConversationId(null);
    setChatKey((prev) => prev + 1);
    setIsHistoryOpen(false);
    setActiveView('chat');
  };

  const handleSelectConversation = (conversationId: string) => {
    setIsNewChat(false);
    setActiveConversationId(conversationId);
    setChatKey((prev) => prev + 1);
    setIsHistoryOpen(false);
    setActiveView('chat');
  };

  const fetchConversations = async () => {
    setIsLoadingConversations(true);
    try {
      const res = await fetch('/api/conversations/list');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - Desktop */}
      <div className={`hidden md:block transition-all duration-300 ${isSidebarOpen ? 'w-72' : 'w-0'}`}>
        {isSidebarOpen && <Sidebar onNewChat={handleNewChat} onOpenProfile={() => setIsProfileOpen(true)} onOpenSettings={() => setIsSettingsOpen(true)} onOpenGoals={() => setIsGoalsOpen(true)} onOpenActivity={() => setIsActivityOpen(true)} onOpenDashboard={() => setActiveView('dashboard')} />}
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full z-50 md:hidden transform transition-transform duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onNewChat={handleNewChat} onOpenProfile={() => setIsProfileOpen(true)} onOpenSettings={() => setIsSettingsOpen(true)} onOpenGoals={() => setIsGoalsOpen(true)} onOpenActivity={() => setIsActivityOpen(true)} onOpenDashboard={() => { setActiveView('dashboard'); setIsSidebarOpen(false); }} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-10 backdrop-blur-md bg-white/70 border-b border-emerald-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg md:hidden"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* Desktop toggle */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="hidden md:flex p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                title={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </button>

              <div className="md:hidden flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <span className="font-semibold text-slate-800">Healthic</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* New Chat button */}
              <button
                onClick={handleNewChat}
                className="p-2 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors"
                title="New Chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>

              {/* History button */}
              <div className="relative">
                <button
                  onClick={() => {
                    const opening = !isHistoryOpen;
                    setIsHistoryOpen(opening);
                    if (opening) fetchConversations();
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    isHistoryOpen
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                  title="Chat History"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                {/* History dropdown */}
                {isHistoryOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setIsHistoryOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-30">
                      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-800 text-sm">Chat History</h3>
                        <button
                          onClick={() => setIsHistoryOpen(false)}
                          className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="overflow-y-auto max-h-80">
                        {isLoadingConversations ? (
                          <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>
                        ) : conversations.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 text-sm">No conversations yet</div>
                        ) : (
                          conversations.map((conv) => (
                            <button
                              key={conv.id}
                              onClick={() => handleSelectConversation(conv.id)}
                              className={`w-full text-left px-4 py-3 hover:bg-emerald-50 border-b border-slate-50 transition-colors ${
                                activeConversationId === conv.id ? 'bg-emerald-50' : ''
                              }`}
                            >
                              <p className="text-sm text-slate-700 truncate">{conv.lastMessage}</p>
                              <p className="text-xs text-slate-400 mt-1">
                                {new Date(conv.lastMessageAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <span className="px-3 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                Beta
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden">
          {activeView === 'dashboard' ? (
            <Dashboard onGoToChat={() => setActiveView('chat')} />
          ) : (
            <Chat key={chatKey} isNewChat={isNewChat} loadConversationId={activeConversationId} />
          )}
        </main>
      </div>

      {/* Modals */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <GoalsModal isOpen={isGoalsOpen} onClose={() => setIsGoalsOpen(false)} />
      <ActivityModal isOpen={isActivityOpen} onClose={() => setIsActivityOpen(false)} />
    </div>
  );
}
