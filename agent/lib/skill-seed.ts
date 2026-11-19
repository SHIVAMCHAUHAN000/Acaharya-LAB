// Starting skills (version 1). Used to seed an empty skill store; same text as supabase/setup.sql.
export const SEED_SKILLS = [
  {
    name: "task-management",
    description: "Use when creating, listing, updating or completing karigar tasks.",
    content: "# Task management\n\n1. If the assignee is unclear, call `list_karigars` and match the name.\n2. Create one task per job with `create_task`, using the job text as the title.\n3. To see work, call `list_tasks` (optionally for one assignee).\n4. To complete a task, call `complete_task` with a proof note. A supervisor must approve it.\n5. If a tool returns an error, read the message, fix the input and try again once.",
  },
  {
    name: "teaching-style",
    description: "Use when explaining to a karigar how to do a job or learn a skill.",
    content: "# Teaching style\n\n- Start from what the karigar already knows (check `karigar` memory).\n- Give at most 3 numbered steps, each one sentence, with one safety tip if relevant.\n- Use simple words in their language. Avoid English jargon for Hindi speakers.\n- End with one check question, like \"Pehla step kya hoga?\"",
  },
];
