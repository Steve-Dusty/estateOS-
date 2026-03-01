import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  inference,
  voice,
} from "@livekit/agents";
import * as hedra from "@livekit/agents-plugin-hedra";
import * as livekit from "@livekit/agents-plugin-livekit";
import * as silero from "@livekit/agents-plugin-silero";
import { BackgroundVoiceCancellation } from "@livekit/noise-cancellation-node";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    const agent = new voice.Agent({
      instructions:
        "You are a helpful voice AI assistant. You eagerly assist users with their questions. Your responses are concise and to the point, without complex formatting or punctuation including emojis or asterisks.",
    });

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad! as silero.VAD,
      stt: new inference.STT({ model: "deepgram/nova-3", language: "en" }),
      llm: new inference.LLM({ model: "openai/gpt-4.1-mini" }),
      tts: new inference.TTS({
        model: "cartesia/sonic-3",
        voice: "9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
      }),
      turnDetection: new livekit.turnDetector.MultilingualModel(),
    });

    // Start agent session first
    await session.start({
      agent,
      room: ctx.room,
      inputOptions: {
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });

    // Start Hedra avatar — it joins the room as a separate video participant
    const avatar = new hedra.AvatarSession({
      avatarId: process.env.HEDRA_AVATAR_ID || undefined,
    });
    await avatar.start(session, ctx.room);

    await ctx.connect();

    session.generateReply({
      instructions: "Greet the user and offer your assistance.",
    });
  },
});

cli.runApp(
  new ServerOptions({ agent: fileURLToPath(import.meta.url) })
);
