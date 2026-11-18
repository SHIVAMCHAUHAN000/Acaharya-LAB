---
description: Use when creating, listing, updating or completing karigar tasks.
---

# Task management

1. If the assignee is unclear, call `list_karigars` and match the name.
2. Create one task per job with `create_task`, using the job text as the title.
3. To see work, call `list_tasks` (optionally for one assignee).
4. To complete a task, call `complete_task` with a proof note. A supervisor must approve it.
5. If a tool returns an error, read the message, fix the input and try again once.
