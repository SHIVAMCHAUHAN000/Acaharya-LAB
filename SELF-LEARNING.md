# Self-learning without PRs (Acharya Lab)

**Goal (from Shubham):** can the agent grow by itself, like Hermes/OpenClaw, without a PR for every new skill?
**Answer:** yes, by keeping skills in **Supabase** instead of in the code, and letting a **nightly gardener** improve them, with a test check and rollback.

## How it works

```
 chats ──► capture hook ──► lab_skill_events (errors, lessons, skill loads)
                                   │
                         2:00 AM IST gardener (eve schedule)
                                   │  1. reads the day's mistakes
                                   │  2. model proposes skill edits (+ rules that belong in code)
                                   │  3. safety guards (size, never drop the approval step)
                                   │  4. test check: test chats with current vs candidate skills
                                   ▼
                          lab_skill_versions  ── better? ──► new active version (old one kept)
                                   │            not better ─► rejected
                                   ▼
 every new chat ◄── agent/skills/living.ts loads the active skills at the start of each turn
```

| Layer | Where | Changes how |
|---|---|---|
| Hard rules (tools, approvals) | Code (`agent/tools/`) | PR only |
| **Living skills** | **Supabase `lab_skill_versions`** | **Gardener, nightly, no PR** |
| Lessons / karigar memory | Vercel Blob (eve memory) | During the chat |

## Files

| File | What it does |
|---|---|
| `supabase/setup.sql` | Creates the 3 tables and seeds the 2 starting skills. Run once. |
| `agent/lib/skill-store.ts` | Reads/writes skills, events and runs (Supabase, or a local JSON file when Supabase isn't set) |
| `agent/skills/living.ts` | Loads the active skills from the store at the start of every turn |
| `agent/hooks/capture.ts` | Logs tool errors, saved lessons and skill loads |
| `agent/lib/gardener.ts` | The nightly improvement job |
| `agent/schedules/gardener.ts` | Runs the gardener every night at 2:00 AM India time |
| `agent/channels/eve.ts`, `apps/web/proxy.ts` | Let the gardener's test chats in with `GARDENER_TOKEN` |
| `scripts/garden.ts` | Run the gardener now: `npm run garden` |
| `scripts/skills.ts` | `npm run skills -- list \| history \| show <name> \| rollback <name> <version> \| runs` |
| `scripts/day-test.mjs` | Simulated day of chats that counts tool errors |

## Result (local test, Claude Sonnet 5.5)

| Step | Tool errors |
|---|---|
| **Day 1:** 4 chats (long title, vague site, Sunday date, "in progress" status) | 4 |
| **Gardener:** found 4 error types, rewrote `task-management` to v2; test chats with v2: **5 → 1** | applied |
| **Day 2 without the gardener** (skill v1, lessons memory wiped), 4 new chats with the same kinds of traps | **4** |
| **Day 2 with the gardener** (skill v2, lessons memory wiped), same 4 chats | **0** |

No PR, no redeploy: the new skill was a new row in Supabase, and the next chat used it.
The gardener also listed 4 rules that should move into code (title max 50, site enum, Sunday check, status enum).

## Set up on Vercel

1. Supabase → SQL Editor → run `supabase/setup.sql`.
2. Vercel project `acharya-lab` → Settings → Environment Variables (Production + Preview):
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
   - `GARDENER_TOKEN` (any long random string; also put it in `.env.local` to run the gardener by hand)
3. Push to `main` (auto-deploys). The 2 AM schedule becomes a Vercel Cron Job.
4. Use the chat, then run `npm run garden -- https://acharya-lab.vercel.app` (or wait for 2 AM) and check `npm run skills -- history`.

## Safety

- Test check: a change is kept only if test chats make **fewer** tool errors than with the current skills.
- Guards: skill length limit; any change that would drop the approval step, or that the model marks high-risk, is saved as `proposed` for a human.
- Every version is kept; `npm run skills -- rollback task-management 1` restores an old one instantly.
- Test chats use a separate scratch task list and don't touch the shared lessons memory.
