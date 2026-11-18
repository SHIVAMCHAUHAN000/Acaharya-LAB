import { Client } from "eve/client";
import { writeFile, rm } from "node:fs/promises";
const client = new Client({ baseUrl: "http://127.0.0.1:2000" });
const out = [];
async function turn(id, message) {
  const { delivery } = await client.sessions.create({ message });
  const calls = new Map();
  for await (const ev of delivery.stream()) { const d = ev.data ?? {};
    if (ev.type === "call.requested") calls.set(d.callId, { tool: d.capability?.name ?? d.capability, input: d.input });
    if (ev.type === "call.settled") { const c = calls.get(d.callId) ?? {}; c.outcome = d.outcome; if (d.error) c.error = d.error.message; }
    if (ev.type === "turn.settled" || ev.type === "turn.paused") break; }
  const res = await delivery.result();
  const e = { id, message, calls: [...calls.values()], reply: res.reply }; out.push(e);
  console.log(`\n=== ${id}`); for (const c of e.calls) console.log(`  ${c.outcome === "failed" ? "✗" : "✓"} ${c.tool}${c.error ? " | " + c.error : ""} | ${JSON.stringify(c.input ?? {}).slice(0, 150)}`);
  console.log("  reply:", (res.reply ?? "").slice(0, 400).replace(/\s+/g, " "));
}
await rm("lab-data/tasks.json", { force: true });
await writeFile("lab-data/config.json", JSON.stringify({ titleMax: 50 }));
await turn("S4-setup", "Ramesh ke liye task banao: 'Prepare the Rosedale garden beds for winter planting by clearing weeds, adding compost and marking rows'. Site Rosedale. Due 25 Nov 2026.");
await writeFile("lab-data/config.json", JSON.stringify({ titleMax: 40 }));
await turn("S4", "Sita ke liye task banao: 'Inspect all greenhouse roof panels and fix every leak before the rains'. Site NewTown. Due 27 Nov 2026.");
await turn("S4-check", "Debug: lessons memory mein abhi exactly kya saved hai? Sirf list karo, kuch change mat karo.");
await writeFile("lab-data/report-s4-rule-change.json", JSON.stringify(out, null, 2));
