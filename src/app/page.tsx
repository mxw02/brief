import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white px-6 py-3.5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f766e] text-sm font-bold text-white shadow-xs">
              B
            </span>
            <span className="text-base font-semibold tracking-tight text-zinc-900">
              Brief
            </span>
            <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
              Self-Hosted
            </span>
          </div>

          <nav className="flex items-center gap-5 text-sm font-medium text-zinc-500">
            <Link
              href="/api/health"
              className="inline-flex items-center gap-1.5 transition-colors hover:text-zinc-900"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              Health
            </Link>
            <a
              href="https://github.com/mxw02/brief"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-zinc-900"
            >
              GitHub
            </a>
            <button
              type="button"
              className="rounded-lg bg-teal-700 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-teal-800 focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
            >
              New Page
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-14">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
              Open Source Confluence Alternative
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
              Fast, structured team documentation — self-hosted.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-zinc-600">
              Brief gives your team a clean, keyboard-first knowledge base with
              full data ownership in PostgreSQL and zero vendor lock-in.
            </p>

            <div className="grid gap-4 pt-2 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Spaces &amp; Pages
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Organize team knowledge in clean, nested hierarchies.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-zinc-900">
                  PostgreSQL
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Reliable storage with full ownership of your data.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Docker Ready
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  Multi-arch images published to GHCR automatically.
                </p>
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-zinc-200/80 bg-zinc-100/70 p-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Workspace Preview
              </span>
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                Ready
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="rounded-xl border border-zinc-200 bg-white p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-900">
                    Architecture &amp; RFCs
                  </span>
                  <span className="rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                    Space
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Updated by{" "}
                  <span className="font-medium text-zinc-700">Human</span>
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-900">
                    Release &amp; Deploy Runbook
                  </span>
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Review
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Drafted by{" "}
                  <span className="font-medium text-emerald-700">Agent</span>
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-900">
                    Q4 Product Roadmap
                  </span>
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#2563eb]">
                    Roadmap
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  Synced with milestones
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
