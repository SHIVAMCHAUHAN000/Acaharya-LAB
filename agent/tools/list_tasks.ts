import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "List tasks, optionally for one assignee (exact full name).",
  inputSchema: z.object({ assignee: z.string().optional() }),
  async execute({ assignee }, ctx) {
    const { loadTasks, taskSpace } = await import("../lib/store");
    const tasks = await loadTasks(taskSpace(ctx));
    return { tasks: assignee ? tasks.filter((t) => t.assignee === assignee) : tasks };
  },
});
