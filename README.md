# Acharya Lab (eve 1.0 R&D)

A small test agent to try Vercel **eve 1.0** features for Omnidel Acharya / Ask MahAcharyaji.

> **R&D only.** It uses a **mock** task system with 3 dummy karigars. It is not connected to OmniDel, Acharya or any real data.

| | |
|---|---|
| **Live chat** | https://acharya-lab.vercel.app (password protected) |
| **Model** | Claude Sonnet 5.5 (`claude-sonnet-5-5`), direct Anthropic API |
| **Hosting** | Vercel project `acharya-lab`, team *shivam-kumar-singhs-projects*, region **bom1 (Mumbai)** |
| **Code** | https://github.com/SHIVAMCHAUHAN000/Acaharya-LAB (branch `main` auto-deploys to production) |
| **Results** | [`LAB-REPORT.md`](./LAB-REPORT.md) |

---

## 1. How to use it in the browser

1. Open **https://acharya-lab.vercel.app**.
2. Enter the shared password (ask Shivam). You stay signed in on that browser for 30 days.
3. Type in the box at the bottom and press Enter. Hindi, Hinglish, Bengali and English all work.
4. Every conversation gets its own link (`/s/<id>`). Bookmark it to come back to it, or click **+** for a new chat.

### What you can ask

| Try this | What it shows |
|---|---|
| `Namaste, tum kaun ho?` | Persona and language |
| `Mera naam Ramesh hai, main Hindi mein baat karta hoon, composting mein naya hoon.` | **Per-person memory**: it saves your name, language and level |
| `Kaun kaun karigar hain?` | Tool call: `list_karigars` |
| `Ramesh ke liye task banao: Prepare the Rosedale garden beds for winter planting by clearing weeds and adding compost. Site Rosedale.` | **Self-learning**: the title is too long, the mock API rejects it, the agent fixes it and saves a *lesson* |
| `Sita ke liye task banao at NewTown nursery, due 29 Nov 2026` | More hidden rules: site must be exactly `Rosedale`/`NewTown`, and no Sunday due dates |
| `Ramesh ke saare tasks dikhao` | Tool call: `list_tasks` |
| `Task T101 shuru ho gaya` | Status change (`update_task_status`, only `planned` or `doing`) |
| `Task T101 done hai, photo bhej di hai` | **Human approval**: an Approve / Deny card appears before the task is marked done |
| `Compost kaise banate hain?` | Teaching skill: 3 steps plus one check question |

**What to look for:** the first time a hidden rule is broken you'll see a failed tool call and a retry. In a *new* chat the agent should get it right the first time, because it remembers the lesson.

### What is remembered

| Memory | Scope | Stored in |
|---|---|---|
| `lessons` (rules learned from tool errors) | Shared by everyone | Private Vercel Blob (bom1) |
| `karigar` (name, language, level, weak topics) | Per browser: each signed-in browser is a separate person | Private Vercel Blob (bom1) |
| Mock tasks + config | Shared by everyone | Private Vercel Blob, `acharya-lab/mock-omnidel/` |

Because lessons and tasks are shared, anything one tester teaches the agent shows up for everyone.

---

## 2. Where to see results and reports

| What | Where |
|---|---|
| **Written lab report** (findings, costs, next steps) | [`LAB-REPORT.md`](./LAB-REPORT.md) in this repo |
| **Raw test results** (every tool call, error, reply, token count) | `lab-data/report-*.json` on Shivam's PC. These are git-ignored, so they are **not on GitHub**. Rerun the scripts (section 3) to regenerate them. |
| **Live conversations, tool calls, token usage, errors** | Vercel dashboard → project **acharya-lab** → **Observability → Agent Runs**. To see every run, set trace sampling to 100% in Project Settings. |
| **Server logs / errors** | Vercel dashboard → **acharya-lab** → **Logs**, or `npx vercel logs https://acharya-lab.vercel.app` |
| **Deployments** | Vercel dashboard → **acharya-lab** → **Deployments** |

Report files written by the scripts:

| File | Written by |
|---|---|
| `report-learn.json`, `report-memory.json`, `report-approval.json`, `report-third.json` | `scripts/run-lab.mjs` |
| `report-scenarios.json`, `report-s5-rerun.json` | `scripts/run-scenarios.mjs` |
| `report-s4-rule-change.json` | `scripts/run-s4-rule-change.mjs` |

---

## 3. Run it on your computer

Needs **Node.js 24 or newer** (`node -v`).

```bash
npm install
```

Put the Anthropic key in `.env.local` (one line, never commit it):

```
ANTHROPIC_API_KEY=<key from .env.local.txt, the claude_api_key= line>
```

> `npx eve link` and `vercel env pull` **overwrite** `.env.local`. Add the key line again after running them.

| Command | What it starts |
|---|---|
| `npx eve dev` | Chat in your terminal (TUI) |
| `npm run dev:web` | Browser chat at http://localhost:3000 (starts the agent too). The password gate is off locally unless `EVE_ACCESS_PASSWORD` is set. |
| `npx eve dev --no-ui` | Agent server only, on http://127.0.0.1:2000 (for the test scripts) |

Locally, memory is kept in RAM (it resets on restart) and tasks go to `lab-data/tasks.json`.

### Rerun the automated tests

Start `npx eve dev --no-ui`, then in a second terminal:

```bash
node scripts/run-lab.mjs http://127.0.0.1:2000 all        # learn, memory, approval  (or: learn | memory | approval | third)
node scripts/run-scenarios.mjs http://127.0.0.1:2000      # 5 scenarios S1–S5        (add "s5" to rerun only S5)
node scripts/run-s4-rule-change.mjs                       # title limit 50 → 40 mid-run
```

Results are written to `lab-data/report-*.json`.

---

## 4. Deploying and admin

- **Deploy:** push to `main` on GitHub, **or** from this folder run:
  ```bash
  npx eve deploy --project acharya-lab --team shivam-kumar-singhs-projects-82acd131
  ```
  Always pass `--team`. The Vercel CLI defaults to a different team.
- **Environment variables** (Vercel → acharya-lab → Settings → Environment Variables):

  | Variable | Purpose |
  |---|---|
  | `ANTHROPIC_API_KEY` | Model key (secret) |
  | `EVE_ACCESS_PASSWORD` | Shared chat password (secret) |
  | `EVE_MEMORY_BLOB_STORE_ID` | Blob store for memory and mock tasks (`store_TZp0ovza9M5wcscE`, bom1). Access is via Vercel OIDC, so no token is needed. |

- **Change the password** (logs everyone out):
  ```bash
  npx vercel env add EVE_ACCESS_PASSWORD production,preview --sensitive --force
  ```
  then redeploy.
- **Reset the lab data:** delete the `acharya-lab/mock-omnidel/` and `eve/memory/file/` folders in the Blob store (Vercel → Storage → `eve-memory-acharya-lab-9bsdjafj`).

---

## 5. What's inside

```
agent/
  agent.ts                  model = Claude Sonnet 5.5 (direct Anthropic)
  instructions.md           Acharya persona + "how you learn" rules
  channels/eve.ts           who may call the agent: password cookie, Vercel OIDC, local dev
  skills/task-management.md how to create/list/complete tasks (loaded on demand)
  skills/teaching-style.md  how to explain a job to a karigar
  tools/create_task.ts      mock OmniDel API with hidden rules (title length, site, no Sundays)
  tools/update_task_status.ts  only "planned" or "doing"
  tools/complete_task.ts    needs human approval
  tools/list_tasks.ts, list_karigars.ts
  memory/lessons.ts         shared "lessons learned" from tool errors (self-learning)
  memory/karigar.ts         per-person memory (name, language, level)
  lib/store.ts              mock task store: Vercel Blob on Vercel, lab-data/*.json locally
  lib/access.ts             checks the password cookie on agent requests
apps/web/                   Next.js browser chat (generated by `eve add channel/web`)
  proxy.ts                  password gate for every page
  app/login/, app/api/login/  sign-in page and handler
scripts/                    automated lab tests → lab-data/report-*.json
vercel.json                 region bom1, build command, output directory
LAB-REPORT.md               results and recommendations
```

## Security notes

- Never commit `.env.local`, `.env.local.txt` or any key. They are listed in `.gitignore` and `.vercelignore`.
- The shared password is for an R&D demo only. It is not real user authentication. Don't put real or sensitive data in this agent.
