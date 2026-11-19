import { defineMemory } from "eve/memory";
import { fileMemory } from "eve/memory/file";

// Shared "lessons learned" for this Acharya: one document for everyone.
export default defineMemory({
  description:
    "Rules this Acharya learned from its own tool errors. One line per rule: '<tool>: <rule>'. Shared by all karigars.",
  provider: fileMemory(),
  // Off during gardener test runs, so a test measures the skills alone.
  scope: (ctx) => (ctx.session.auth.current?.attributes?.mode === "eval" ? null : "acharya-global"),
});
