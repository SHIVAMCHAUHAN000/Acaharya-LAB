// Runs the Acharya Lab feature tests against a local `eve dev` server.
// Usage: node scripts/run-lab.mjs [baseUrl]
import { Client } from "eve/client";
import { writeFile, mkdir } from "node:fs/promises";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:2000";
const client = new Client({ baseUrl });
const report = [];

async function collect(delivery) {
  const calls = new Map();
  const usage = [];
  const types = {};
  let reply = "";
  for await (const ev of delivery.stream()) {
    types[ev.type] = (types[ev.type] ?? 0) + 1;
    const d = ev.data ?? {};
    if (ev.type === "call.requested") { const cap = d.capability; calls.set(d.callId, { tool: typeof cap === "string" ? cap : (cap?.name ?? cap?.id ?? JSON.stringify(cap)), input: d.input }); }
    if (ev.type === "call.settled") {
      const c = calls.get(d.callId) ?? { tool: d.toolName };
      c.outcome = d.outcome;
      if (d.error) c.error = d.error.message ?? String(d.error);
      calls.set(d.callId, c);
    }
    if (ev.type === "content.completed" && d.phase === "reply") reply = d.value;
    if (ev.type === "usage.recorded") usage.push(d);
    if (ev.type === "turn.settled" || ev.type === "turn.paused") break;
  }
  return { calls: [...calls.values()], usage, types, reply };
}

async function turn(name, message, session) {
  const t0 = Date.now();
  let delivery;
  if (session) delivery = await session.send(message);
  else ({ session, delivery } = await client.sessions.create({ message }));
  const ev = await collect(delivery);
  const res = await delivery.result();
  const entry = { name, message, status: res.status, ms: Date.now() - t0, reply: res.reply || ev.reply,
    calls: ev.calls, interactions: res.interactions, usage: ev.usage, eventTypes: ev.types };
  report.push(entry);
  console.log(`\n=== ${name} (${entry.status}, ${entry.ms} ms)`);
  for (const c of entry.calls) console.log(`  tool ${c.tool} -> ${c.outcome}${c.error ? " | " + c.error : ""}${c.input ? " | " + JSON.stringify(c.input).slice(0, 160) : ""}`);
  console.log("  reply:", (entry.reply ?? "").slice(0, 400).replace(/\n/g, " "));
  return { session, res };
}

const which = process.argv[3] ?? "all";

if (which === "all" || which === "learn") {
  await turn("T1 self-correct + save lesson",
    "Ramesh ke liye ek task banao: 'Prepare the Rosedale garden beds for winter planting by clearing weeds, adding compost and marking rows'. Due 25 Nov 2026.");
  await turn("T2 lesson applied in a NEW session",
    "Sita ke liye task banao: 'Repair the drip irrigation lines in the NewTown nursery near the north gate and then test the water pressure'. Due 26 Nov 2026.");
  await turn("T2c third NEW session: both lessons applied",
    "Arjun ko kaam do: 'Check all the compost pits at the Rosedale site, turn the compost, and report any bad smell or pests to the supervisor'. Due 27 Nov 2026.");
}
if (which === "third") {
  await turn("T2c third NEW session: both lessons applied",
    "Arjun ko kaam do: 'Check all the compost pits at the Rosedale site, turn the compost, and report any bad smell or pests to the supervisor'. Due 27 Nov 2026.");
}
if (which === "all" || which === "memory") {
  await turn("T3a karigar introduces himself",
    "Namaste, main Ramesh Kumar hoon. Mujhse Hindi mein baat karna. Main composting mein naya hoon, isme thodi dikkat hoti hai.");
  await turn("T3b NEW session: personalised help",
    "Aaj mera kya kaam hai? Aur jo sabse mushkil lage woh samjha do.");
}
if (which === "all" || which === "approval") {
  const { session, res } = await turn("T4a complete task -> waits for approval",
    "Ramesh ka garden beds wala task done mark karo. Proof: beds saaf ho gaye, compost daal diya, photo upload kar di.");
  const pending = (res.interactions ?? [])[0];
  if (pending) {
    console.log("  pending interaction:", JSON.stringify(pending).slice(0, 300));
    const opt = (pending.request?.options ?? pending.options ?? []).find((o) => /approve|allow|yes/i.test(o.id ?? o.optionId ?? "")) ;
    const optionId = opt?.id ?? opt?.optionId ?? "approve";
    const resp = await session.respond([{ interactionId: pending.interactionId ?? pending.id, optionId }]);
    const r = await resp.result();
    report.push({ name: "T4b supervisor approves", status: r.status, reply: r.reply });
    console.log(`\n=== T4b supervisor approves (${r.status})\n  reply: ${(r.reply ?? "").slice(0, 300)}`);
  }
}
await mkdir("lab-data", { recursive: true });
await writeFile(`lab-data/report-${which}.json`, JSON.stringify(report, null, 2));
