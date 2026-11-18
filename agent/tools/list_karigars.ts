import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description: "List the karigars (field workers) who can be assigned tasks.",
  inputSchema: z.object({}),
  async execute() {
    const { KARIGARS } = await import("../lib/store");
    return { karigars: KARIGARS };
  },
});
