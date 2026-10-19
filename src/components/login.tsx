import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/ui";
import { TradingViewChart } from "@/components/tv-chart";
import { cn } from "@/lib/utils";

export function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);

  function connect() {
    setBusy(true);
    setMenu(false);
    void import("@/lib/solana/run-launch")
      .then(({ attachPhantom }) => attachPhantom(false))
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Phantom rejected the connection");
      })
      .finally(() => setBusy(false));
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/80 backdrop-blur-md">
        <nav className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <a href="#top" className="flex items-center gap-2 text-xl font-semibold text-white">
              <Logo className="size-7" />
              VELN
            </a>
            <div className="absolute top-1/2 left-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-8 md:flex">
              <a href="#work" className="text-sm text-white/60 hover:text-white">Getting started</a>
              <a href="#desk" className="text-sm text-white/60 hover:text-white">The desk</a>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <button type="button" disabled={busy} onClick={connect} className="h-10 rounded-md px-4 text-sm text-white hover:bg-white/10 disabled:opacity-50">
                Sign in
              </button>
              <button type="button" disabled={busy} onClick={connect} className="h-10 rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-white/90 disabled:opacity-50">
                {busy ? "Waiting…" : "Open desk"}
              </button>
            </div>
            <button type="button" className="text-white md:hidden" aria-label="Toggle menu" onClick={() => setMenu((open) => !open)}>
              {menu ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </nav>
        {menu ? (
          <div className="border-t border-white/10 bg-black/95 px-6 py-4 md:hidden">
            <a href="#work" className="block py-2 text-sm text-white/60" onClick={() => setMenu(false)}>Getting started</a>
            <a href="#desk" className="block py-2 text-sm text-white/60" onClick={() => setMenu(false)}>The desk</a>
            <button type="button" disabled={busy} onClick={connect} className="mt-3 h-10 w-full rounded-md bg-white text-sm font-medium text-black">
              {busy ? "Waiting…" : "Open desk"}
            </button>
          </div>
        ) : null}
      </header>

      <section id="top" className="flex flex-col items-center px-6 pt-32 pb-20">
        <a href="#work" className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/60">
          Phantom login. No seed phrase.
          <span className="inline-flex items-center gap-1">Read more <ArrowRight /></span>
        </a>
        <h1
          className="max-w-3xl bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-center text-4xl leading-tight font-medium tracking-tight text-transparent md:text-6xl"
        >
          Launch the coin.
          <br />
          Then sit on the book.
        </h1>
        <p className="mt-6 max-w-xl text-center text-sm text-white/60 md:text-base">
          Pump.fun from Phantom. A new mint, a copy of one that is already live, or a batch. The desk only keeps what this wallet signed.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={connect}
          className="mt-10 h-12 rounded-lg bg-gradient-to-b from-white via-white/95 to-white/60 px-8 text-base font-medium text-black hover:scale-[1.02] active:scale-95 disabled:opacity-50"
        >
          {busy ? "Waiting for Phantom…" : "Get started"}
        </button>

        <div id="desk" className="relative mt-16 w-full max-w-6xl px-0">
          <div className="pointer-events-none absolute top-8 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-white/15 blur-3xl" />
          <TradingViewChart className="relative shadow-2xl" />
        </div>
      </section>

      <section id="work" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-3 md:grid-cols-6">
          <article className="rounded-xl border border-white/10 bg-white/[0.03] p-5 md:col-span-4">
            <h2 className="text-lg font-medium">Four moves, then the chart</h2>
            <ol className="mt-4 grid gap-4 sm:grid-cols-2">
              {STEPS.map((step) => (
                <li key={step.n}>
                  <p className="text-sm text-white/40">{step.n}</p>
                  <p className="mt-1 font-medium">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/60">{step.body}</p>
                </li>
              ))}
            </ol>
          </article>
          <article className="flex flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] p-5 md:col-span-2">
            <div>
              <h2 className="text-lg font-medium">Keys stay with you</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/60">Phantom signs. Extra wallets are made in this browser, and you can export the seed.</p>
            </div>
            <p className="mt-6 text-sm text-white/40">A rejected prompt does not move SOL.</p>
          </article>
          {TOOLS.map((tool, i) => (
            <article key={tool.title} className={cn("rounded-xl border border-white/10 bg-white/[0.03] p-5", i < 2 ? "md:col-span-3" : "md:col-span-2")}>
              <h3 className="font-medium">{tool.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{tool.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

const STEPS = [
  { n: "01", title: "Create", body: "Name, ticker, and mode. New bundle, vamp, or takeover." },
  { n: "02", title: "Fund", body: "Phantom pays the dev buy. Extra wallets are yours." },
  { n: "03", title: "Launch", body: "The coin goes on Pump.fun. You sign it." },
  { n: "04", title: "Track", body: "The project desk opens on the chart and your buys." },
];

const TOOLS = [
  { title: "Pump.fun", body: "Create a coin or buy one that already exists. The transaction is the one Phantom shows you." },
  { title: "Batch", body: "Line up several mints and send them together." },
  { title: "Practice", body: "The same desk, on paper. You choose if it dumps or sends." },
  { title: "Wallets", body: "Each extra wallet has a seed you can export." },
];

function ArrowRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 12h16M4 6h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
