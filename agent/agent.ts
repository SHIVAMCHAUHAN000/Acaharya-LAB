import { defineAgent } from "eve";
import { anthropic } from "eve/models/anthropic";

// R&D only. Direct Anthropic call with the test key in .env.local (ANTHROPIC_API_KEY).
export default defineAgent({
  model: anthropic("claude-sonnet-5-5"),
  // Direct provider: tell eve the context size so it doesn't look it up on AI Gateway.
  modelContextWindowTokens: 1_000_000,
});
