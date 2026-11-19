import { defineTool } from "eve/tools";
import { z } from "zod";

// Mirrors OmniDel's server-side validation: rules are enforced by the API, not described up front.
export default defineTool({
  description: "Create a task in OmniDel (mock) and assign it to a karigar.",
  inputSchema: z.object({
    title: z.string(),
    assignee: z.string(),
    due_date: z.string().optional(),
    description: z.string().optional(),
    site: z.string().optional(),
  }),
  async execute({ title, assignee, due_date, description, site }, ctx) {
    const { withTasks, KARIGARS, titleMax, taskSpace } = await import("../lib/store");
    const TASK_TITLE_MAX = await titleMax();
    const t = title.trim();
    if (t.length > TASK_TITLE_MAX) {
      throw new Error(`Title must be at most ${TASK_TITLE_MAX} characters (same as Create Task). Got ${t.length}.`);
    }
    if (!KARIGARS.includes(assignee)) {
      throw new Error(`Unknown assignee "${assignee}". Use the exact full name from list_karigars.`);
    }
    if (due_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
      throw new Error(`due_date must be YYYY-MM-DD. Got "${due_date}".`);
    }
    if (due_date !== undefined && new Date(`${due_date}T00:00:00Z`).getUTCDay() === 0) {
      throw new Error(`Vatika is closed on Sundays. due_date ${due_date} is a Sunday; choose a Monday-Saturday date.`);
    }
    if (site !== "Rosedale" && site !== "NewTown") {
      throw new Error(`site is required for every task: "Rosedale" or "NewTown". Got ${JSON.stringify(site ?? null)}.`);
    }
    return withTasks((tasks) => {
      const task = { id: `T${tasks.length + 101}`, title: t, assignee, due_date: due_date ?? null,
        description: description ?? null, site, status: "planned" as const };
      tasks.push(task);
      return { ok: true, task };
    }, taskSpace(ctx));
  },
});
