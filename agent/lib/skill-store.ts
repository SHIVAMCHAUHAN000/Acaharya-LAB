// Living skill store for the self-learning loop (R&D).
//
// Skills live in data, not in code, so the agent can improve them without a PR or redeploy:
//   - Supabase (tables from supabase/setup.sql) when SUPABASE_URL + SUPABASE_SECRET_KEY are set
//   - a local JSON file (lab-data/skillstore.json) otherwise, for `eve dev` and lab scripts
// Every change is a new row in lab_skill_versions, so any version can be restored.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { SEED_SKILLS } from "./skill-seed";

export type SkillStatus = "active" | "candidate" | "superseded" | "rejected" | "proposed" | "retired";
export type SkillVersion = {
  id: number; name: string; version: number; description: string; content: string;
  status: SkillStatus; reason: string | null; created_by: string; run_id: number | null; created_at: string;
};
export type EventKind = "tool_error" | "tool_ok" | "lesson_saved" | "skill_loaded";
export type SkillEvent = {
  id: number; created_at: string; session_id: string | null; kind: EventKind;
  tool: string | null; detail: string | null; input: unknown;
};
export type GardenerRun = {
  id: number; started_at: string; finished_at: string | null;
  status: "running" | "applied" | "no_change" | "rejected" | "failed"; summary: string | null; report: unknown;
};

type Table = "lab_skill_versions" | "lab_skill_events" | "lab_gardener_runs";

interface Backend {
  select<T>(table: Table, query: Record<string, string>): Promise<T[]>;
  insert<T>(table: Table, row: Record<string, unknown>): Promise<T>;
  update(table: Table, id: number, patch: Record<string, unknown>): Promise<void>;
}

// ---------- Supabase (PostgREST over fetch, no extra dependency) ----------
function supabaseBackend(): Backend | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const call = async (pathAndQuery: string, init: RequestInit = {}) => {
    const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
      ...init, headers: { ...headers, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res;
  };
  return {
    async select(table, query) {
      return (await call(`${table}?${new URLSearchParams(query)}`)).json();
    },
    async insert(table, row) {
      const res = await call(table, { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=representation" } });
      return (await res.json())[0];
    },
    async update(table, id, patch) {
      await call(`${table}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    },
  };
}

// ---------- Local JSON file (dev and tests) ----------
type FileDb = Record<Table, any[]>;
function fileBackend(): Backend {
  const file = path.join(process.cwd(), "lab-data", "skillstore.json");
  const load = async (): Promise<FileDb> => {
    try { return JSON.parse(await readFile(file, "utf8")); }
    catch { return { lab_skill_versions: [], lab_skill_events: [], lab_gardener_runs: [] }; }
  };
  const save = async (db: FileDb) => {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(db, null, 2));
  };
  let queue: Promise<unknown> = Promise.resolve();
  const locked = <T>(fn: (db: FileDb) => T | Promise<T>, write: boolean) => {
    const run = queue.then(async () => { const db = await load(); const r = await fn(db); if (write) await save(db); return r; });
    queue = run.catch(() => undefined);
    return run;
  };
  // Supports the small subset of PostgREST filters this file uses: eq., gte., in.()
  const matches = (row: any, query: Record<string, string>) => Object.entries(query).every(([k, v]) => {
    if (["select", "order", "limit"].includes(k)) return true;
    if (v.startsWith("eq.")) return String(row[k]) === v.slice(3);
    if (v.startsWith("gte.")) return String(row[k]) >= v.slice(4);
    if (v.startsWith("in.(")) return v.slice(4, -1).split(",").includes(String(row[k]));
    return true;
  });
  return {
    select: (table, query) => locked((db) => {
      let rows = db[table].filter((r) => matches(r, query));
      const [col, dir] = (query.order ?? "id.asc").split(".");
      rows = rows.sort((a, b) => (a[col] > b[col] ? 1 : -1) * (dir === "desc" ? -1 : 1));
      return query.limit ? rows.slice(0, Number(query.limit)) : rows;
    }, false),
    insert: (table, row) => locked((db) => {
      const id = (db[table].at(-1)?.id ?? 0) + 1;
      const full = { id, created_at: new Date().toISOString(), started_at: new Date().toISOString(), ...row };
      db[table].push(full);
      return full;
    }, true),
    update: (table, id, patch) => locked((db) => { Object.assign(db[table].find((r) => r.id === id) ?? {}, patch); }, true),
  };
}

let backend: Backend | undefined;
const db = () => (backend ??= supabaseBackend() ?? fileBackend());
export const storeKind = () => (supabaseBackend() ? "supabase" : "local-file");

// ---------- Skills ----------
let seeded = false;
async function ensureSeeded() {
  if (seeded) return;
  const any = await db().select<SkillVersion>("lab_skill_versions", { select: "id", limit: "1" });
  if (any.length === 0) {
    for (const s of SEED_SKILLS) {
      await db().insert("lab_skill_versions", { ...s, version: 1, status: "active", created_by: "seed", reason: "Initial skill" });
    }
  }
  seeded = true;
}

/** Skills the agent should use. `candidate` mode prefers candidate versions (used only by test runs). */
export async function loadSkills(mode: "active" | "candidate" = "active"): Promise<SkillVersion[]> {
  await ensureSeeded();
  const status = mode === "candidate" ? "in.(active,candidate)" : "eq.active";
  const rows = await db().select<SkillVersion>("lab_skill_versions", { select: "*", status, order: "version.asc" });
  const byName = new Map<string, SkillVersion>();
  for (const r of rows) {
    const current = byName.get(r.name);
    if (!current || r.status === "candidate" || (current.status !== "candidate" && r.version > current.version)) byName.set(r.name, r);
  }
  return [...byName.values()];
}

export async function skillHistory(name?: string): Promise<SkillVersion[]> {
  return db().select<SkillVersion>("lab_skill_versions", { select: "*", ...(name ? { name: `eq.${name}` } : {}), order: "id.asc" });
}

export async function addVersion(v: { name: string; description: string; content: string; status: SkillStatus; reason: string; created_by: string; run_id?: number }) {
  const all = await skillHistory(v.name);
  const version = Math.max(0, ...all.map((r) => r.version)) + 1;
  return db().insert<SkillVersion>("lab_skill_versions", { ...v, version, run_id: v.run_id ?? null });
}

export const setStatus = (id: number, status: SkillStatus) => db().update("lab_skill_versions", id, { status });

/** Make one version the active one (used to apply a tested candidate, or to roll back). */
export async function activate(name: string, version: number, reason = "activated") {
  const all = await skillHistory(name);
  const target = all.find((r) => r.version === version);
  if (!target) throw new Error(`No version ${version} of skill ${name}`);
  for (const r of all) if (r.status === "active" && r.id !== target.id) await setStatus(r.id, "superseded");
  await db().update("lab_skill_versions", target.id, { status: "active", reason: target.reason ?? reason });
}

// ---------- Events ----------
export async function logEvent(e: { kind: EventKind; session_id?: string; tool?: string; detail?: string; input?: unknown }) {
  try {
    await db().insert("lab_skill_events", { session_id: e.session_id ?? null, kind: e.kind, tool: e.tool ?? null, detail: e.detail ?? null, input: e.input ?? null });
  } catch (err) {
    console.warn("[skill-store] logEvent failed:", (err as Error).message); // never break a chat because logging failed
  }
}
export const eventsSince = (iso: string) =>
  db().select<SkillEvent>("lab_skill_events", { select: "*", created_at: `gte.${iso}`, order: "id.asc", limit: "500" });

// ---------- Gardener runs ----------
export const startRun = () => db().insert<GardenerRun>("lab_gardener_runs", { status: "running" });
export const finishRun = (id: number, status: GardenerRun["status"], summary: string, report: unknown) =>
  db().update("lab_gardener_runs", id, { status, summary, report, finished_at: new Date().toISOString() });
export const listRuns = (limit = 10) => db().select<GardenerRun>("lab_gardener_runs", { select: "*", order: "id.desc", limit: String(limit) });
