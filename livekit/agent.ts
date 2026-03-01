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

const DEFAULT_INSTRUCTIONS =
  "You are a helpful voice AI assistant for EstateOS, a real estate intelligence platform. You eagerly assist users with their questions about properties and real estate. Your responses are concise and to the point, without complex formatting or punctuation including emojis or asterisks.";

function buildPropertyInstructions(metadata: string): string {
  try {
    const data = JSON.parse(metadata);
    if (data.propertyAddress) {
      return `You are a knowledgeable real estate agent AI assistant for EstateOS. You are currently helping a client who is interested in a specific property.

PROPERTY DETAILS:
- Address: ${data.propertyAddress}, ${data.propertyCity || ""}
- Price: $${Number(data.propertyPrice || 0).toLocaleString()}
${data.propertyBeds ? `- Bedrooms: ${data.propertyBeds}` : ""}
${data.propertyBaths ? `- Bathrooms: ${data.propertyBaths}` : ""}
${data.propertySqft ? `- Square Footage: ${Number(data.propertySqft).toLocaleString()} sq ft` : ""}
${data.propertyType ? `- Type: ${data.propertyType}` : ""}
${data.propertyYearBuilt ? `- Year Built: ${data.propertyYearBuilt}` : ""}
${data.propertyRoi ? `- ROI: ${data.propertyRoi}%` : ""}
${data.propertyRiskScore ? `- Risk Score: ${data.propertyRiskScore}/100` : ""}
${data.propertyZestimate ? `- Estimated Value: $${Number(data.propertyZestimate).toLocaleString()}` : ""}
${data.propertyDaysOnMarket ? `- Days on Market: ${data.propertyDaysOnMarket}` : ""}
${data.propertyStatus ? `- Status: ${data.propertyStatus}` : ""}

Answer questions about this property knowledgeably. If asked about things you don't have data for (like neighborhood details, schools, etc.), provide helpful general information for the area. Be conversational, warm, and professional. Keep responses concise — this is a voice conversation. Do not use complex formatting, punctuation, emojis, or asterisks.`;
    }
  } catch {
    // Not valid JSON or no property data — use default
  }
  return DEFAULT_INSTRUCTIONS;
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },
  entry: async (ctx: JobContext) => {
    // Try to get property context from room metadata or participant metadata
    let instructions = DEFAULT_INSTRUCTIONS;
    let propertyAddress = "";

    // Check room participants for metadata with property info
    await ctx.connect();

    for (const [, participant] of ctx.room.remoteParticipants) {
      if (participant.metadata) {
        const built = buildPropertyInstructions(participant.metadata);
        if (built !== DEFAULT_INSTRUCTIONS) {
          instructions = built;
          try {
            const data = JSON.parse(participant.metadata);
            propertyAddress = data.propertyAddress || "";
          } catch { /* ignore */ }
          break;
        }
      }
    }

    const agent = new voice.Agent({ instructions });

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

    await session.start({
      agent,
      room: ctx.room,
      inputOptions: {
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    });

    // Start Hedra avatar
    const avatar = new hedra.AvatarSession({
      avatarId: process.env.HEDRA_AVATAR_ID || undefined,
    });
    await avatar.start(session, ctx.room);

    // Generate contextual greeting
    const greeting = propertyAddress
      ? `Greet the user warmly and let them know you're ready to help them with questions about the property at ${propertyAddress}. Keep it brief.`
      : "Greet the user and offer your assistance.";

    session.generateReply({ instructions: greeting });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    // Heavy plugins (Silero VAD, Hedra, noise cancellation) need more time
    // to load in dev mode where there are no prewarmed processes
    initializeProcessTimeout: 30_000,
    numIdleProcesses: 1,
  })
);
