import { defineMemory } from "eve/memory";
import { byPrincipal } from "eve/memory/scope";
import { fileMemory } from "eve/memory/file";

// Per-person memory: name, language, level, weak topics.
export default defineMemory({
  description: "Stable facts about this karigar: name, preferred language, experience level, topics they find hard.",
  provider: fileMemory(),
  scope: byPrincipal,
});
