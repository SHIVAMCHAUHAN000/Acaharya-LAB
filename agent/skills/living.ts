import { defineDynamic, defineSkill } from "eve/skills";

// "Living" skills: loaded from the skill store (Supabase) at the start of every turn,
// so the nightly gardener can improve them without a PR or redeploy.
// Test runs from the gardener (auth attribute skills=candidate) see candidate versions instead.
export default defineDynamic(async (ctx) => {
  const mode = ctx.session.auth.current?.attributes?.skills === "candidate" ? "candidate" : "active";
  const skills = await ctx.memo(["living-skills", mode, ctx.turn?.id ?? null], async () => {
    const { loadSkills } = await import("../lib/skill-store");
    return (await loadSkills(mode)).map(({ name, description, content, version }) => ({ name, description, content, version }));
  });
  return Object.fromEntries(
    skills.map((s) => [s.name, defineSkill({ description: s.description, content: s.content, metadata: { version: String(s.version) } })]),
  );
});
