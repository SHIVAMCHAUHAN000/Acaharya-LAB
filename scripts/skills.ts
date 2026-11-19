// Inspect and manage the living skills.
//   npx tsx scripts/skills.ts list                  current active skills
//   npx tsx scripts/skills.ts history [name]        every version, with status and reason
//   npx tsx scripts/skills.ts show <name> [version] full text
//   npx tsx scripts/skills.ts rollback <name> <version>
//   npx tsx scripts/skills.ts runs                  last gardener runs
import { activate, listRuns, loadSkills, skillHistory, storeKind } from "../agent/lib/skill-store";

const [cmd = "list", a, b] = process.argv.slice(2);
console.log(`skill store: ${storeKind()}\n`);
if (cmd === "list") {
  for (const s of await loadSkills()) console.log(`${s.name}  v${s.version}  (${s.created_by})  ${s.description}`);
} else if (cmd === "history") {
  for (const s of await skillHistory(a)) console.log(`${s.name} v${s.version}  ${s.status.padEnd(10)} ${s.created_by.padEnd(8)} ${s.created_at}  ${s.reason ?? ""}`);
} else if (cmd === "show") {
  const all = await skillHistory(a);
  const s = b ? all.find((x) => x.version === Number(b)) : all.find((x) => x.status === "active");
  console.log(s ? `${s.name} v${s.version} [${s.status}]\n\n${s.content}` : "not found");
} else if (cmd === "rollback") {
  await activate(a, Number(b), "manual rollback");
  console.log(`${a} is now at v${b}`);
} else if (cmd === "runs") {
  for (const r of await listRuns()) console.log(`#${r.id} ${r.status.padEnd(9)} ${r.started_at}  ${r.summary ?? ""}`);
} else {
  console.log("commands: list | history [name] | show <name> [version] | rollback <name> <version> | runs");
}
