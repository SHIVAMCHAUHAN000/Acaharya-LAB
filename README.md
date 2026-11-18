# Acharya Lab (eve 1.0 R&D)

A small test agent to try Vercel **eve 1.0** features for Omnidel Acharya / Ask MahAcharyaji.
**R&D only.** It uses a mock task system (`lab-data/tasks.json`), not OmniDel, and is not deployed.

- Model: **Claude Sonnet 5.5** (`claude-sonnet-5-5`), called directly with the Anthropic API key.
- Results: see `LAB-REPORT.md`.

## Run it on your computer

Needs **Node.js 24 or newer** (check with `node -v`).

```bash
npm install                 # installs eve 1.0.2, ai, zod
npx eve dev                 # opens the chat in your terminal
```

Create `.env.local` in this folder with one line: `ANTHROPIC_API_KEY=<your key from ../.env.local.txt>`. Never commit it.

Re-run the automated tests (in a second terminal while `npx eve dev --no-ui` is running):

```bash
node scripts/run-lab.mjs http://127.0.0.1:2000 all
```

## What's inside

```
agent/
  agent.ts                  model = Claude Sonnet 5.5 (direct Anthropic)
  instructions.md           Acharya persona + "how you learn" rules
  skills/task-management.md how to create/list/complete tasks (loaded on demand)
  skills/teaching-style.md  how to explain a job to a karigar
  tools/create_task.ts      mock OmniDel API with hidden rules (50-char title, site required)
  tools/list_tasks.ts, list_karigars.ts
  tools/complete_task.ts    needs supervisor approval (human-in-the-loop)
  memory/lessons.ts         shared "lessons learned" from tool errors (self-learning)
  memory/karigar.ts         per-person memory (name, language, level)
  lib/store.ts              JSON file store for the mock tasks
scripts/run-lab.mjs         automated feature tests, writes lab-data/report-*.json
```
