import { defineTool } from "eve/tools";
import { z } from "zod";

// Mock OmniDel status update. Allowed values are enforced by the API, not listed here.
export default defineTool({
  description: "Change a task's status in OmniDel (mock).",
  inputSchema: z.object({ task_id: z.string(), status: z.string() }),
  async execute({ task_id, status }, ctx) {
    const { withTasks, taskSpace } = await import("../lib/store");
    if (status !== "planned" && status !== "doing") {
      throw new Error(`status must be "planned" or "doing" (use complete_task to finish a task). Got "${status}".`);
    }
    return withTasks((tasks) => {
      const task = tasks.find((t) => t.id === task_id);
      if (!task) throw new Error(`No task with id ${task_id}. Call list_tasks to find the id.`);
      task.status = status;
      return { ok: true, task };
    }, taskSpace(ctx));
  },
});
