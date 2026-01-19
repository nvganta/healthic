import Chat from '@/components/Chat';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💪</span>
            <h1 className="text-xl font-semibold text-gray-900">Healthic</h1>
          </div>
          <span className="text-sm text-gray-500">Your AI Health Coach</span>
        </div>
      </header>

      {/* Main chat area */}
      <main className="flex-1 max-w-3xl mx-auto w-full">
        <Chat />
      </main>
    </div>
  );
}
