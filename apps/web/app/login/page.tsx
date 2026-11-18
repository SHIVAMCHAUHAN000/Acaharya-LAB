export const metadata = { title: "Acharya Lab · Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 text-foreground">
      <form action="/api/login" method="post" className="w-full max-w-sm space-y-4 rounded-xl border p-6 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Acharya Lab</h1>
          <p className="text-sm text-muted-foreground">R&amp;D test agent (mock data). Enter the shared password to chat.</p>
        </div>
        <input type="hidden" name="returnTo" value={next ?? "/"} />
        <input
          type="password"
          name="password"
          required
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          aria-label="Password"
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error === "config" ? "Access is not configured on the server." : "Wrong password. Try again."}
          </p>
        ) : null}
        <button type="submit" className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
          Enter
        </button>
      </form>
    </main>
  );
}
