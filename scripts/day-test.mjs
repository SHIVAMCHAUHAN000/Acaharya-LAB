// Simulates a day of manager chats and counts tool errors (each prompt = a new chat).
//   node scripts/day-test.mjs day1|day2 [agentUrl]
import { Client } from "eve/client";
import { writeFile, mkdir } from "node:fs/promises";

const DAYS = {
  day1: [
    "Ramesh ke liye task banao: 'Prepare the Rosedale garden beds for winter planting by clearing weeds, adding compost and marking rows'. Due 25 Nov 2026.",
    "Sita ke liye task banao: 'Repair the drip irrigation lines in the NewTown nursery near the north gate and then test the water pressure'. Due 26 Nov 2026.",
    "Arjun ke liye task: 'Check all compost pits at Rosedale and turn the compost'. Due 29 Nov 2026.",
    "Sita ka drip irrigation wala task ab 'in progress' hai, status update kar do.",
  ],
  day2: [
    "Arjun ko kaam do: 'Clean out every rainwater drain along the Rosedale entrance road before the rains start next week'. Due 22 Nov 2026.",
    "Ramesh ke liye task: 'Plant the new marigold and tulsi saplings in the NewTown greenhouse beds near the office'. Due 6 Dec 2026.",
    "Sita ke liye task banao: 'Fix the leaking water tank valve behind the Rosedale cowshed'. Due 28 Nov 2026.",
    "Sita ka water tank valve wala task shuru ho gaya hai, uska status 'started' kar do.",
  ],
};

const day = process.argv[2] ?? "day1";
const client = new Client({ baseUrl: process.argv[3] ?? "http://127.0.0.1:2000" });
const results = [];
for (const prompt of DAYS[day]) {
  const { delivery } = await client.sessions.create({ message: prompt });
  const calls = new Map(); const errors = [];
  for await (const ev of delivery.stream()) {
    const d = ev.data ?? {};
    if (ev.type === "call.requested") calls.set(d.callId, d.capability?.name ?? d.capability);
    if (ev.type === "call.settled" && d.outcome === "failed" && !String(calls.get(d.callId)).includes("__")) errors.push(`${calls.get(d.callId)}: ${d.error?.message}`);
    if (ev.type === "turn.settled" || ev.type === "turn.paused") break;
  }
  const res = await delivery.result();
  results.push({ prompt, status: res.status, toolErrors: errors.length, errors, reply: res.reply });
  console.log(`\n[${errors.length} errors] ${prompt}`);
  for (const e of errors) console.log(`   ✗ ${e}`);
  console.log(`   reply: ${(res.reply ?? "").replace(/\s+/g, " ").slice(0, 200)}`);
}
const total = results.reduce((a, r) => a + r.toolErrors, 0);
console.log(`\n${day}: ${total} tool errors in ${results.length} chats`);
await mkdir("lab-data", { recursive: true });
await writeFile(`lab-data/report-${day}.json`, JSON.stringify({ day, total, results }, null, 2));
