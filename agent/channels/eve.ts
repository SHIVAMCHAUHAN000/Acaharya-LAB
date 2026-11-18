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

export default eveChannel({
  auth: [
    sharedPassword,
    // Lets the eve TUI and your Vercel deployments reach the deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev` and the REPL; ignored in production.
    localDev(),
  ],
});
