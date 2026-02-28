import { NextRequest } from 'next/server';
import { getJob, JobEvent } from '../../jobs';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const state = getJob(jobId);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send all buffered events first
      for (const event of state.events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      if (state.done) {
        controller.close();
        return;
      }

      // Listen for new events
      const listener = (event: JobEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream closed
        }
        if (event.type === 'done' || event.type === 'error') {
          state.listeners.delete(listener);
          try { controller.close(); } catch { /* already closed */ }
        }
      };
      state.listeners.add(listener);

      // Cleanup if client disconnects
      _req.signal.addEventListener('abort', () => {
        state.listeners.delete(listener);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
