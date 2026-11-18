import { readFileSync } from "node:fs";
import path from "node:path";
import { ArrowLeftIcon, CheckCircle2Icon, MessageSquareIcon } from "lucide-react";
import Link from "next/link";
import { MessageResponse } from "@/components/ai-elements/message";
import { CopyButton } from "./copy-button";

// Rendered once at build time from LAB-REPORT.md in the project root, so the page
// always matches the report in the repo. Still behind the password gate (proxy.ts).
export const dynamic = "force-static";
export const metadata = { title: "Acharya Lab · Report" };

function loadReport(): string {
  // Read only at build time (static page), so don't trace these paths into the server bundle.
  const candidates = [
    path.join(/* turbopackIgnore: true */ process.cwd(), "LAB-REPORT.md"),
    path.join(/* turbopackIgnore: true */ process.cwd(), "..", "..", "LAB-REPORT.md"),
  ];
  for (const file of candidates) {
    try {
      // Drop the top-level heading; the page header shows the title.
      return readFileSync(file, "utf8").replace(/^# .*\r?\n/, "");
    } catch {}
  }
  return "_LAB-REPORT.md was not found at build time._";
}

const STATS = [
  { value: "11 / 11", label: "Scenarios passed", note: "6 features + 5 extra scenarios" },
  { value: "≈ ₹1.3", label: "Cost per chat session", note: "$0.015 with prompt caching" },
  { value: "96%", label: "Input served from cache", note: "~30k input tokens per session" },
  { value: "4", label: "Rules learned on its own", note: "from real tool errors only" },
] as const;

const TRY_IT = [
  { text: "Namaste, tum kaun ho?", shows: "Persona and language" },
  {
    text: "Mera naam Ramesh hai, Hindi mein baat karo, composting mein naya hoon.",
    shows: "Per-person memory (name, language, level)",
  },
  {
    text: "Ramesh ke liye task banao: Prepare the Rosedale garden beds for winter planting by clearing weeds and adding compost. Site Rosedale.",
    shows: "Self-learning: the title is too long, so it fixes it and saves a lesson",
  },
  {
    text: "Sita ke liye task banao: Water the new saplings at NewTown nursery, due 29 Nov 2026.",
    shows: "Hidden rules: exact site name, no Sunday due dates",
  },
  { text: "Ramesh ke saare tasks dikhao", shows: "Listing tasks with a tool call" },
  { text: "Task T101 done hai, photo bhej di hai", shows: "Human approval: Approve / Deny card" },
  { text: "Compost kaise banate hain?", shows: "Teaching style: 3 steps + a check question" },
] as const;

export default function ReportPage() {
  const report = loadReport();
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link className="flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground" href="/">
            <ArrowLeftIcon className="size-4" />
            Back to chat
          </Link>
          <span className="text-muted-foreground text-sm">Acharya Lab · Report</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl space-y-10 px-4 py-8 sm:px-6 sm:py-12">
        <section className="space-y-3">
          <p className="text-muted-foreground text-sm">R&amp;D only · mock data · not connected to OmniDel</p>
          <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">
            eve 1.0 lab report: what it means for Acharya
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Can a Vercel eve agent learn rules from its own tool errors, remember each karigar, load skills on
            demand and pause for human approval, cheaply? Below are the results, then you can try it yourself.
          </p>
          <p className="flex items-center gap-2 text-sm">
            <CheckCircle2Icon aria-hidden className="size-4 text-[#006300] dark:text-[#0ca30c]" />
            <span>
              <span className="font-medium">All tests passed.</span>{" "}
              <span className="text-muted-foreground">Claude Sonnet 5.5 · eve 1.0.2 · 18 Nov 2026</span>
            </span>
          </p>
        </section>

        <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATS.map((stat) => (
            <div className="rounded-xl border bg-card p-4" key={stat.label}>
              <p className="text-muted-foreground text-sm">{stat.label}</p>
              <p className="mt-1 font-semibold text-2xl tabular-nums tracking-tight">{stat.value}</p>
              <p className="mt-1 text-muted-foreground text-xs">{stat.note}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold text-lg">Try it yourself</h2>
              <p className="text-muted-foreground text-sm">
                Copy a message, open the chat and paste it. Open a <em>new chat</em> after the long-title task and
                ask again: it should get the rule right first time.
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm"
              href="/s"
            >
              <MessageSquareIcon className="size-4" />
              Open chat
            </Link>
          </div>
          <ol className="divide-y">
            {TRY_IT.map((item, index) => (
              <li className="flex items-start gap-3 py-3" key={item.text}>
                <span className="mt-0.5 w-5 shrink-0 text-muted-foreground text-sm tabular-nums">{index + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm">{item.text}</p>
                  <p className="mt-0.5 text-muted-foreground text-xs">{item.shows}</p>
                </div>
                <CopyButton text={item.text} />
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Full report" className="space-y-4">
          <h2 className="font-semibold text-lg">Full report</h2>
          <article className="overflow-x-auto rounded-xl border bg-card p-4 text-sm sm:p-6">
            <MessageResponse>{report}</MessageResponse>
          </article>
        </section>
      </div>
    </main>
  );
}
