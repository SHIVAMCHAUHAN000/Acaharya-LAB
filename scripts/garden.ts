// Run the gardener now (instead of waiting for 2 AM).
//   npx tsx scripts/garden.ts                      -> against the local `eve dev` server
//   npx tsx scripts/garden.ts https://acharya-lab.vercel.app
// Needs GARDENER_TOKEN, ANTHROPIC_API_KEY and (for Supabase) SUPABASE_URL + SUPABASE_SECRET_KEY in .env.local.
import { runGardener } from "../agent/lib/gardener";
import { storeKind } from "../agent/lib/skill-store";

const agentUrl = process.argv[2] ?? "http://127.0.0.1:2000";
const token = process.env.GARDENER_TOKEN;
if (!token) throw new Error("Set GARDENER_TOKEN in .env.local (same value as on the agent).");
console.log(`skill store: ${storeKind()} · agent: ${agentUrl}`);
const result = await runGardener({ agentUrl, token, since: process.env.GARDENER_SINCE, log: (l) => console.log(`[gardener] ${l}`) });
console.log(JSON.stringify({ runId: result.runId, status: result.status, summary: (result as any).summary }, null, 2));
