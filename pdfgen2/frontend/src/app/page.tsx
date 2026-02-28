import ChatGenerator from "./components/ChatGenerator";

export default function Home() {
  return (
    <main className="flex flex-col h-screen">
      {/* Top Nav */}
      <header className="flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 4l9 5.75V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.75z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 21V12h6v9" />
          </svg>
        </div>
        <div>
          <h1 className="text-base font-semibold text-gray-900">RealEstate AI Agent</h1>
          <p className="text-xs text-gray-500">Floor plans · Market reports · Property insights</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Online
          </span>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <ChatGenerator />
      </div>
    </main>
  );
}
