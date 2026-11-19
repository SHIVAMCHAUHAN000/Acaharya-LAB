import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { MemoryDocumentConflictError, type MemoryDocumentBackend } from "eve/memory/file";
import { vercelBlob } from "eve/memory/file/vercel";

// Mock OmniDel task store for the lab (not a real database).
// On Vercel: two private Vercel Blob documents (tasks + config) in the file-memory store,
// under their own prefix so they never mix with memory documents.
// Locally (eve dev, lab scripts): lab-data/tasks.json and lab-data/config.json as before.

export const KARIGARS = ["Ramesh Kumar", "Sita Devi", "Arjun Das"];
export const TASK_TITLE_MAX = 50; // same rule as OmniDel src/lib/field-limits.ts

export type Task = {
  id: string; title: string; assignee: string; due_date: string | null;
  description: string | null; status: "planned" | "doing" | "done"; proof_note?: string;
};

type Doc = { content: string; version: string | null } | null;
type Storage = {
  read(key: string): Promise<Doc>;
  // Writes only if the stored version still equals `version` (null = must not exist yet).
  write(key: string, content: string, version: string | null): Promise<void>;
};

function blobStorage(): Storage | null {
  if (!process.env.VERCEL) return null;
  const storeId = process.env.EVE_MEMORY_BLOB_STORE_ID?.trim() || process.env.BLOB_STORE_ID?.trim();
  const token = process.env.EVE_MEMORY_BLOB_READ_WRITE_TOKEN?.trim() || process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!storeId && !token) {
    throw new Error("Task store needs Vercel Blob: run `eve integration setup file-memory`, then redeploy.");
  }
  const backend: MemoryDocumentBackend = vercelBlob({ prefix: "acharya-lab/mock-omnidel", storeId, token });
  const signal = () => AbortSignal.timeout(15_000);
  return {
    read: (key) => backend.read({ key, signal: signal() }),
    async write(key, content, version) {
      await backend.write({ key, content, expectedVersion: version, signal: signal() });
    },
  };
}

function fileStorage(): Storage {
  const DIR = path.join(process.cwd(), "lab-data");
  const file = (key: string) => path.join(DIR, `${key}.json`);
  return {
    async read(key) {
      try { return { content: await readFile(file(key), "utf8"), version: null }; } catch { return null; }
    },
    async write(key, content) {
      await mkdir(DIR, { recursive: true });
      await writeFile(file(key), content);
    },
  };
}

let storage: Storage | undefined;
const store = () => (storage ??= blobStorage() ?? fileStorage());

// Lab-only: lets a test change a rule while the agent is running (e.g. tighten the title limit).
export async function titleMax(): Promise<number> {
  try {
    const doc = await store().read("config");
    return doc ? (JSON.parse(doc.content).titleMax ?? TASK_TITLE_MAX) : TASK_TITLE_MAX;
  } catch { return TASK_TITLE_MAX; }
}

// "main" = the shared demo tasks. "eval" = a separate scratch list used by the gardener's test runs.
export type TaskSpace = "main" | "eval";
const tasksKey = (space: TaskSpace) => (space === "eval" ? "eval-tasks" : "tasks");

async function readTasks(space: TaskSpace = "main"): Promise<{ tasks: Task[]; version: string | null }> {
  const doc = await store().read(tasksKey(space));
  if (!doc) return { tasks: [], version: null };
  try { return { tasks: JSON.parse(doc.content), version: doc.version }; } catch { return { tasks: [], version: doc.version }; }
}

export async function loadTasks(space: TaskSpace = "main"): Promise<Task[]> {
  try { return (await readTasks(space)).tasks; } catch { return []; }
}
export async function saveTasks(tasks: Task[], space: TaskSpace = "main") {
  const { version } = await readTasks(space);
  await store().write(tasksKey(space), JSON.stringify(tasks, null, 2), version);
}
/** Empties the gardener's scratch task list before a test batch. */
export const resetEvalTasks = () => saveTasks([], "eval");

// Parallel tool calls must not overwrite each other: run read-modify-write one at a time.
// The queue covers one server instance; the Blob version check (ifMatch) covers several
// instances, retrying the whole read-modify-write when another instance wrote first.
let queue: Promise<unknown> = Promise.resolve();
export function withTasks<T>(fn: (tasks: Task[]) => Promise<T> | T, space: TaskSpace = "main"): Promise<T> {
  const run = queue.then(async () => {
    for (let attempt = 1; ; attempt++) {
      const { tasks, version } = await readTasks(space);
      const result = await fn(tasks);
      try {
        await store().write(tasksKey(space), JSON.stringify(tasks, null, 2), version);
        return result;
      } catch (error) {
        if (!MemoryDocumentConflictError.is(error) || attempt >= 5) throw error;
      }
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Which task list a tool call should use: gardener test runs get their own scratch list. */
export function taskSpace(ctx: { session: { auth: { current?: { attributes?: Record<string, unknown> } | null } } }): TaskSpace {
  return ctx.session.auth.current?.attributes?.mode === "eval" ? "eval" : "main";
}
