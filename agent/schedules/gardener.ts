import { defineSchedule } from "eve/schedules";

// Every night at 2:00 AM India time: learn from the day's mistakes and improve the living skills.
export default defineSchedule({
  cron: "0 2 * * *",
  timezone: "Asia/Kolkata",
  async run({ waitUntil }) {
    const token = process.env.GARDENER_TOKEN;
    const agentUrl = process.env.GARDENER_AGENT_URL
      ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined);
    if (!token || !agentUrl) {
      console.warn("[gardener] skipped: set GARDENER_TOKEN (and GARDENER_AGENT_URL outside Vercel)");
      return;
    }
    const { runGardener } = await import("../lib/gardener");
    waitUntil(runGardener({ agentUrl, token }).catch((err) => console.error("[gardener] failed:", err)));
  },
});
