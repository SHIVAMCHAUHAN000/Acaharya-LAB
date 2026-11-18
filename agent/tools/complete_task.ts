import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

// Like Acharya's rule: marking done needs proof and a human OK.
export default defineTool({
  description: "Mark a task as done with a proof note. Requires supervisor approval.",
  inputSchema: z.object({ task_id: z.string(), proof_note: z.string().min(5) }),
  approval: always(),
  async execute({ task_id, proof_note }) {
    const { withTasks } = await import("../lib/store");
    return withTasks((tasks) => {
      const task = tasks.find((t) => t.id === task_id);
      if (!task) throw new Error(`No task with id ${task_id}. Call list_tasks to find the id.`);
      task.status = "done";
      task.proof_note = proof_note;
      return { ok: true, task };
    });
  },
});
