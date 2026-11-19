import { defineHook } from "eve/hooks";

// Records what the gardener learns from: failed and successful tool calls, saved lessons and skill loads.
// Gardener test runs (auth attribute mode=eval) are not recorded.
const pending = new Map<string, { tool: string; kind?: string; input: unknown }>();

function describe(capability: unknown): { tool: string; kind?: string } {
  if (typeof capability === "string") return { tool: capability };
  const c = capability as { name?: string; id?: string; kind?: string; type?: string } | undefined;
  return { tool: c?.name ?? c?.id ?? "unknown", kind: c?.kind ?? c?.type };
}

export default defineHook({
  events: {
    async "call.requested"(event, ctx) {
      if (ctx.session.auth.current?.attributes?.mode === "eval") return;
      const d = event.data as { callId: string; capability: unknown; input: unknown };
      if (process.env.LAB_DEBUG_CAPABILITY) console.info("[capture] capability", JSON.stringify(d.capability));
      pending.set(d.callId, { ...describe(d.capability), input: d.input });
    },
    async "call.settled"(event, ctx) {
      if (ctx.session.auth.current?.attributes?.mode === "eval") return;
      const d = event.data as { callId: string; outcome?: string; error?: { message?: string } };
      const call = pending.get(d.callId);
      pending.delete(d.callId);
      if (!call) return;
      const { logEvent } = await import("../lib/skill-store");
      const base = { session_id: ctx.session.id, tool: call.tool, input: call.input };
      const isSkillLoad = call.tool === "eve__skill" || call.kind === "skill";
      if (isSkillLoad) {
        await logEvent({ ...base, kind: "skill_loaded", detail: (call.input as { name?: string })?.name ?? call.tool });
      } else if (call.tool === "lessons__save_memory") {
        if (d.outcome !== "failed") await logEvent({ ...base, kind: "lesson_saved", detail: (call.input as { text?: string })?.text });
      } else if (call.tool.startsWith("eve__") || call.tool.includes("__")) {
        return; // other built-in and memory tools are not useful to the gardener
      } else if (d.outcome === "failed") {
        await logEvent({ ...base, kind: "tool_error", detail: d.error?.message ?? "failed" });
      } else {
        await logEvent({ ...base, kind: "tool_ok" });
      }
    },
  },
});
