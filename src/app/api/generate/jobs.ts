/* ── Shared in-memory job state ─────────────────────────────────────── */

export type JobEvent = {
  type: string;
  [key: string]: unknown;
};

export interface JobState {
  events: JobEvent[];
  done: boolean;
  listeners: Set<(event: JobEvent) => void>;
}

const jobs = new Map<string, JobState>();

export function getJob(jobId: string): JobState {
  if (!jobs.has(jobId)) {
    jobs.set(jobId, { events: [], done: false, listeners: new Set() });
  }
  return jobs.get(jobId)!;
}

export function broadcastEvent(jobId: string, event: JobEvent) {
  const state = getJob(jobId);
  state.events.push(event);
  for (const fn of state.listeners) {
    fn(event);
  }
}
