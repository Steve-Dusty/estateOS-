import VoiceAssistant from "./components/VoiceAssistant";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#080C14] text-zinc-100">
      <main className="flex flex-col items-center gap-8 p-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            LiveKit Room
          </h1>
          <p className="text-sm text-zinc-500 font-mono">
            Video + Voice AI
          </p>
        </div>

        <VoiceAssistant />
      </main>
    </div>
  );
}
