// The nightly "gardener": turns the day's mistakes into better skills, with no PR or redeploy.
//
//   1. Read what happened since the last run (tool errors, saved lessons, skill loads).
//   2. Ask a model to propose skill edits, plus hard rules that belong in code instead.
//   3. Safety guards: size limits, and never drop the approval step (high-risk edits wait for a human).
//   4. Test check: run test chats against the agent with the current skills and with the candidate
//      skills. Keep the candidate only if it makes fewer tool errors.
//   5. Apply (new active version) or reject, record everything, and write a short digest.

import { generateText, Output } from "ai";
import { z } from "zod";
import { Client } from "eve/client";
import { anthropic } from "eve/models/anthropic";
import {
  addVersion, activate, eventsSince, finishRun, listRuns, loadSkills, setStatus, startRun,
  type SkillEvent, type SkillVersion,
} from "./skill-store";
import { resetEvalTasks } from "./store";

const MAX_SKILL_CHARS = 3000;

const Proposal = z.object({
  changes: z.array(z.object({
    skill: z.string().describe("Existing skill name to update, or a new kebab-case name"),
    description: z.string().describe("When to use the skill, one sentence"),
    content: z.string().describe("The full new skill text in markdown"),
    reason: z.string().describe("Why, in one or two sentences"),
    evidence: z.array(z.string()).describe("The error messages or lessons this is based on"),
    risk: z.enum(["low", "high"]).describe("high if it removes steps, changes approvals, or is unsure"),
  })),
  codeRules: z.array(z.object({
    tool: z.string(),
    rule: z.string(),
    reason: z.string().describe("Why this should be enforced in code (tool input schema) instead of a skill"),
  })),
  testPrompts: z.array(z.string()).describe("3-5 realistic user messages that would hit the learned rules"),
});
type Proposal = z.infer<typeof Proposal>;

type EvalResult = { prompt: string; toolErrors: number; status: string; errors: string[] };

export type GardenerOptions = {
  agentUrl: string;          // where the agent runs, e.g. https://acharya-lab.vercel.app or http://127.0.0.1:2000
  token: string;             // GARDENER_TOKEN, lets test chats use candidate skills
  since?: string;            // ISO time; default = start of the last finished run, or 24 hours ago
  model?: string;            // default claude-sonnet-5-5
  log?: (line: string) => void;
};

export async function runGardener(opts: GardenerOptions) {
  const log = opts.log ?? ((l: string) => console.info(`[gardener] ${l}`));
  const run = await startRun();
  try {
    const previous = (await listRuns(20)).find((r) => r.id !== run.id && r.status !== "running" && r.status !== "failed");
    const since = opts.since ?? previous?.started_at ?? new Date(Date.now() - 24 * 3600_000).toISOString();
    const events = await eventsSince(since);
    const errors = events.filter((e) => e.kind === "tool_error");
    const lessons = events.filter((e) => e.kind === "lesson_saved");
    log(`since ${since}: ${events.length} events, ${errors.length} tool errors, ${lessons.length} lessons`);

    if (errors.length === 0 && lessons.length === 0) {
      await finishRun(run.id, "no_change", "No mistakes since the last run. Nothing to learn.", { since, events: events.length });
      return { runId: run.id, status: "no_change" as const };
    }

    const skills = await loadSkills("active");
    const proposal = await propose(skills, events, opts.model);
    log(`proposal: ${proposal.changes.length} skill changes, ${proposal.codeRules.length} code-rule suggestions, ${proposal.testPrompts.length} test prompts`);

    // Safety guards
    const accepted: Proposal["changes"] = [];
    const forHuman: { change: Proposal["changes"][number]; why: string }[] = [];
    for (const c of proposal.changes) {
      const old = skills.find((s) => s.name === c.skill);
      const why = guard(c, old);
      if (why || c.risk === "high") forHuman.push({ change: c, why: why ?? "Model marked it high risk" });
      else accepted.push(c);
    }
    for (const { change, why } of forHuman) {
      await addVersion({ name: change.skill, description: change.description, content: change.content, status: "proposed", reason: `${change.reason} [needs human: ${why}]`, created_by: "gardener", run_id: run.id });
    }
    if (accepted.length === 0) {
      const summary = `Proposed ${forHuman.length} change(s) that need a human review. Nothing applied.`;
      await finishRun(run.id, "rejected", summary, { since, proposal, forHuman });
      return { runId: run.id, status: "rejected" as const, proposal };
    }

    // Save as candidates, then test current vs candidate skills
    const candidates: SkillVersion[] = [];
    for (const c of accepted) {
      candidates.push(await addVersion({ name: c.skill, description: c.description, content: c.content, status: "candidate", reason: c.reason, created_by: "gardener", run_id: run.id }));
    }
    const prompts = proposal.testPrompts.slice(0, 5);
    log(`testing ${prompts.length} prompts against current and candidate skills...`);
    const before = await evaluate(opts, prompts, "active");
    const after = await evaluate(opts, prompts, "candidate");
    const sum = (r: EvalResult[]) => r.reduce((a, x) => a + x.toolErrors, 0);
    const failedSessions = (r: EvalResult[]) => r.filter((x) => x.status !== "completed" && x.status !== "awaiting-input").length;
    const improved = sum(after) < sum(before) && failedSessions(after) <= failedSessions(before);
    log(`tool errors: current ${sum(before)} -> candidate ${sum(after)} (${improved ? "better" : "not better"})`);

    if (improved) {
      for (const c of candidates) await activate(c.name, c.version);
    } else {
      for (const c of candidates) await setStatus(c.id, "rejected");
    }
    const summary = improved
      ? `Updated ${candidates.map((c) => `${c.name} v${c.version}`).join(", ")}. Test tool errors ${sum(before)} → ${sum(after)}.`
      : `Rejected ${candidates.length} change(s): test tool errors ${sum(before)} → ${sum(after)} (no improvement).`;
    const report = { since, events: events.length, proposal, forHuman, test: { before, after } };
    await finishRun(run.id, improved ? "applied" : "rejected", summary, report);
    log(summary);
    return { runId: run.id, status: improved ? ("applied" as const) : ("rejected" as const), summary, report };
  } catch (err) {
    await finishRun(run.id, "failed", (err as Error).message, null);
    throw err;
  }
}

function guard(c: Proposal["changes"][number], old: SkillVersion | undefined): string | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(c.skill)) return "invalid skill name";
  if (c.content.length > MAX_SKILL_CHARS) return `skill longer than ${MAX_SKILL_CHARS} characters`;
  if (old && /complete_task|approv/i.test(old.content) && !/complete_task|approv/i.test(c.content)) return "would drop the approval step";
  if (old && c.content.trim() === old.content.trim()) return "no change";
  return null;
}

async function propose(skills: SkillVersion[], events: SkillEvent[], model = "claude-sonnet-5-5"): Promise<Proposal> {
  const groups = new Map<string, { tool: string; detail: string; count: number; inputs: unknown[] }>();
  for (const e of events.filter((x) => x.kind === "tool_error")) {
    const key = `${e.tool}|${(e.detail ?? "").replace(/\d+/g, "#").replace(/"[^"]*"/g, '"…"')}`;
    const g = groups.get(key) ?? { tool: e.tool ?? "?", detail: e.detail ?? "", count: 0, inputs: [] };
    g.count++;
    if (g.inputs.length < 2) g.inputs.push(e.input);
    groups.set(key, g);
  }
  const lessons = [...new Set(events.filter((e) => e.kind === "lesson_saved").map((e) => e.detail))];
  const loads: Record<string, number> = {};
  for (const e of events.filter((x) => x.kind === "skill_loaded")) loads[e.detail ?? "?"] = (loads[e.detail ?? "?"] ?? 0) + 1;

  const prompt = `You maintain the skills of "Acharya", an AI work guide for karigars (field workers).
Skills are markdown procedures the agent loads on demand. Improve them using ONLY the evidence below.

## Current skills
${skills.map((s) => `### ${s.name} (v${s.version}) — ${s.description}\n${s.content}`).join("\n\n")}

## Tool errors since the last run (grouped)
${[...groups.values()].map((g) => `- ${g.tool} ×${g.count}: ${g.detail}\n  example input: ${JSON.stringify(g.inputs[0]).slice(0, 300)}`).join("\n") || "(none)"}

## Lessons the agent saved after fixing its own errors
${lessons.map((l) => `- ${l}`).join("\n") || "(none)"}

## Skill loads
${JSON.stringify(loads)}

Rules for your changes:
- Only add rules backed by the tool errors or lessons above. Never invent rules.
- Put each rule into the skill used for that tool (e.g. create_task rules into task-management). Edit the full skill text; keep existing steps that are still right.
- Keep skills short and practical (under ${MAX_SKILL_CHARS} characters). Never remove the approval step for completing tasks.
- If nothing needs to change, return an empty changes list.
- Also list "codeRules": rules simple enough to enforce in the tool's input schema (lengths, formats, enums). Those should become code, not just skill text.
- testPrompts: 3-5 realistic messages a manager might type (Hinglish is fine) that would hit these rules, e.g. a long task title, a Sunday date, a vague site name. Include assignee names Ramesh, Sita or Arjun and dates in Nov/Dec 2026.`;

  const r = await generateText({ model: anthropic(model), output: Output.object({ schema: Proposal }), prompt });
  return r.output as Proposal;
}

async function evaluate(opts: GardenerOptions, prompts: string[], skills: "active" | "candidate"): Promise<EvalResult[]> {
  await resetEvalTasks();
  const client = new Client({
    baseUrl: opts.agentUrl,
    headers: { "x-gardener-token": opts.token, "x-gardener-skills": skills },
  });
  return Promise.all(prompts.map(async (prompt) => {
    const errors: string[] = [];
    try {
      const { delivery } = await client.sessions.create({ message: prompt });
      const toolOf = new Map<string, string>();
      for await (const ev of delivery.stream()) {
        const d = (ev.data ?? {}) as any;
        if (ev.type === "call.requested") toolOf.set(d.callId, typeof d.capability === "string" ? d.capability : (d.capability?.name ?? ""));
        if (ev.type === "call.settled" && d.outcome === "failed") {
          const tool = toolOf.get(d.callId) ?? "";
          if (!tool.includes("__")) errors.push(`${tool}: ${d.error?.message ?? "failed"}`);
        }
        if (ev.type === "turn.settled" || ev.type === "turn.paused") break;
      }
      const res = await delivery.result();
      return { prompt, toolErrors: errors.length, status: res.status, errors };
    } catch (err) {
      return { prompt, toolErrors: errors.length, status: `error: ${(err as Error).message}`, errors };
    }
  }));
}
