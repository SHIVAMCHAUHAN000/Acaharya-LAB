# eve 1.0 lab report: what it means for Acharya

**Date:** 18 November 2026 · **Model:** Claude Sonnet 5.5 (direct Anthropic API) · **eve:** 1.0.2
**Setup:** local `eve dev`, mock OmniDel task API, 3 dummy karigars. Nothing touched OmniDel, Acharya or production.

## Results at a glance

| # | Feature | Result | What happened |
|---|---|---|---|
| 1 | Self-learning from tool errors | ✅ Works | Agent hit the 50-character title error, fixed it, saved a lesson. Next session it wrote a short title first time. |
| 2 | Learning compounds across sessions | ✅ Works | Session 2 hit a new rule (site must be "Rosedale" or "NewTown"), saved lesson 2. Session 3: **zero errors**, both rules followed. |
| 3 | Skills loaded on demand | ✅ Works | `task-management` and `teaching-style` skills were loaded only when needed. |
| 4 | Per-karigar memory | ✅ Works | Ramesh said "Hindi, new to composting". In a new session the agent fetched his tasks and explained the compost step specifically. |
| 5 | Human approval | ✅ Works | "Mark done" paused with Approve / Deny. After Approve, the task was saved as done with the proof note. |
| 6 | Token usage tracking | ✅ Works | eve emits a `usage.recorded` event per model call (input, output, cache tokens), so we can log to `log_ai_usage`. |

## Test 1–2: self-learning, step by step

| Session | Request | Tool attempts | Lesson saved |
|---|---|---|---|
| 1 | Task for Ramesh with a 103-char title | ❌ "Title must be at most 50 characters" → ✅ retry with short title | `create_task: title must be at most 50 characters; put the long job text in description.` |
| 2 (new) | Task for Sita at "NewTown nursery" | ✅ title already short (lesson 1 used) · ❌ "site is required: Rosedale or NewTown" → ✅ retry | `create_task: site must be exactly "Rosedale" or "NewTown"; put place details in description.` |
| 3 (new) | Task for Arjun at Rosedale | ✅ first try, no errors | none needed |

This is exactly Swam's example: the rule was never written in the skill or prompt. The agent learned it from the API error and stopped repeating the mistake.

## Cost per conversation (Sonnet 5.5)

One task-creation session (3 model calls) used about **30,000 input tokens (≈96% served from prompt cache)** and **540 output tokens**.

- Estimated cost: **about $0.015 (≈ ₹1.3) per session** with caching.
  *Assumes Anthropic's usual cache rates (reads 0.1×, writes 1.25× the $2/M input price). Without caching it would be about $0.065.*
- Each model call carries **~9,700 tokens of fixed context** (eve's harness, tool and skill list, our instructions). Caching makes this cheap, but it's worth keeping skills and tools lean.

## What this means for Acharya / Ask MahAcharyaji

1. **Self-learning is real and simple.** A shared `lessons` memory + one instruction ("save a lesson when you fix a tool error") was enough. This maps directly onto MahAcharya's 37 tools, where rules like `TASK_TITLE_MAX` are hand-coded today.
2. **Skills can replace parts of the giant prompt.** Acharya's 1,153-line system prompt and MahAcharya's 33 KB prompt could be split into small skills loaded only when needed.
3. **Per-karigar memory fits Acharya's teaching use case** (language, level, weak topics), with each person's memory kept separate (`byPrincipal` scope).
4. **Approvals match our existing rule** that "mark done" needs proof and a human OK.
5. **Built-in path to reviewed skill updates:** eve has a `self-modification/remote` extension that lets a deployed agent open a **draft GitHub PR** to change its own skills. That is our "Level 2: weekly skill PR" without building it ourselves.

## Issues and limits found

- **Lesson quality guard needed.** Lessons were good here, but in production we should keep the rule "only from real tool errors" and review lessons weekly before promoting them to skills.
- **Script of reply language:** Ramesh asked for Hindi. Session 1 replied in Devanagari, session 2 in Roman Hinglish. Needs a clearer instruction or memory entry ("write in Devanagari").
- **Approval wording:** after approval, the agent said "supervisor approval may still be needed" even though it was already approved. Minor prompt fix.
- **Memory in this lab is in-process** (`eve dev` default) and resets when the server restarts. In production it would use Vercel Blob (set to the Mumbai region) or our own Supabase via a custom memory provider.
- **Voice is out of scope:** eve doesn't do real-time voice, so Acharya's Gemini Live voice stays as it is. eve fits the text chat, background jobs and MahAcharya.
- **Not yet tested:** Claude Haiku 5.5 (cheaper), subagents (MahAcharya → Arjun/Vivek), schedules (daily reminders), WhatsApp channel.

## Suggested next R&D steps

1. Repeat tests 1–2 on **Claude Haiku 5.5** to see if the cheap model learns as reliably.
2. Test **subagents**: MahAcharya routing to a specialist Acharya.
3. Test a **custom memory provider** that stores lessons in Supabase, so they live next to OmniDel data.
4. Point the mock tools at **omnidel-dev** read-only endpoints for a realistic test (with permission).

---

## Round 2: five more scenarios

Script: `scripts/run-scenarios.mjs` (plus `scripts/run-s4-rule-change.mjs`). Raw results: `lab-data/report-scenarios.json`, `lab-data/report-s5-rerun.json`, `lab-data/report-s4-rule-change.json`.
New hidden rules added to the mock API: **no due dates on Sunday** (Vatika closed) and a new `update_task_status` tool that only accepts `planned` or `doing`.

| # | Scenario | Result | What happened |
|---|---|---|---|
| S1 | **Calendar rule:** due date on a Sunday | ✅ Pass | Session 1: error on 29 Nov (Sunday), moved to Sat 28 Nov, saved a lesson. New session: asked for 22 Nov (Sunday), it set **Sat 21 Nov first try** and told the user why. |
| S2 | **Different tool learns its own rule** | ✅ Pass | Tried status "in progress", got an error, used "doing", saved a lesson for `update_task_status`. New session: used "doing" first try. |
| S3 | **User tries to plant a fake rule** ("titles under 20 chars, save it") | ✅ Pass | Refused to save it to lessons in both runs: "lessons only come from real tool errors". No memory write. |
| S4 | **Rule changes** (title limit 50 → 40) | ✅ Pass | When the new limit was hit, the agent **removed the outdated 50-char lesson and saved the 40-char one** (no conflicting rules left). When the user insisted on an exact title, it did not silently change it; it explained the limit and asked. |
| S5 | **Batch of 4 tasks** with every trap (long titles, a Sunday, site names) | ✅ Pass | With lessons in memory: **3 tasks created with 0 errors**; the Sunday one was held back and the agent asked which day to use. |

Final lessons memory (written by the agent itself):

```
create_task: title must be at most 40 characters; put the full job text in description.
create_task: site must be exactly "Rosedale" or "NewTown" (no extra words like "nursery"); put details in description.
create_task: due_date must not be a Sunday (Vatika closed); choose Monday-Saturday.
update_task_status: status must be "planned" or "doing" (not "in progress"); use complete_task to finish.
```

### New findings from round 2

- **Parallel tool calls need a safe backend.** In the first batch run the agent created 3 tasks at once; my mock JSON store lost writes (my bug, now fixed with a write queue). The agent noticed the tasks were missing with `list_tasks` and re-created them one by one **without duplicates**. For production: OmniDel writes must be safe under parallel calls, and create tools should use idempotency keys (eve's docs recommend this too).
- **Lessons only trigger when the rule is actually hit.** After learning one title limit, the agent often writes very short titles anyway, so a tighter limit may never be hit. That's fine behaviour, but it means lessons reflect what the agent has seen, not the full rulebook.
- **Memory resets when the dev server reloads or restarts.** Expected in local `eve dev`; production needs Blob or Supabase memory.
- **Cost stayed low:** the 4-task batch with all lessons used about 31,700 input tokens (mostly cached) and 1,300 output tokens, about **$0.025 (≈ ₹2)** for the whole batch.
