import { eveChannel } from "eve/channels/eve";
import { type AuthFn, localDev, vercelOidc } from "eve/channels/auth";
import { verifyAccessCookie } from "../lib/access";

// Browser chat: accept only requests carrying a valid shared-password cookie
// (set by the /login page in apps/web). Each browser gets its own principal,
// so per-person (karigar) memory stays separate per browser.
const sharedPassword: AuthFn<Request> = async (request) => {
  const browserId = await verifyAccessCookie(request.headers.get("cookie"));
  if (!browserId) return null;
  return {
    authenticator: "shared-password",
    principalId: `browser:${browserId}`,
    principalType: "user",
    attributes: {},
  };
};

// Gardener test runs: a server-to-server caller with the GARDENER_TOKEN secret.
// It can ask for the candidate (not yet live) skill versions, and uses a scratch task list.
const gardenerEval: AuthFn<Request> = async (request) => {
  const expected = process.env.GARDENER_TOKEN;
  const got = request.headers.get("x-gardener-token");
  if (!expected || !got || got.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  const skills = request.headers.get("x-gardener-skills") === "candidate" ? "candidate" : "active";
  return {
    authenticator: "gardener-eval",
    principalId: `gardener-eval:${skills}`,
    principalType: "service",
    attributes: { mode: "eval", skills },
  };
};

export default eveChannel({
  auth: [
    gardenerEval,
    sharedPassword,
    // Lets the eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDev(),
  ],
});
