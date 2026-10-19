import { useEffect, useState, type ReactNode } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  CircleDollarSign,
  Copy,
  Crosshair,
  FolderKanban,
  GraduationCap,
  HandCoins,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Radar,
  Rocket,
  Search,
  Bell,
  Send,
  Settings,
  Shuffle,
  Sparkles,
  Store,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { shortAddr, sol } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useVeln } from "@/store/veln";
import { Button, Logo, Modal, SolGlyph, fieldClass } from "@/components/ui";
import { LoginPage } from "@/components/login";

async function logOut() {
  const { disconnectPhantom } = await import("@/lib/solana/phantom");
  await disconnectPhantom();
  useVeln.getState().disconnect();
  toast("Logged out. Connect Phantom to get back in.");
}

function navClass() {
  return "group relative flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-fg data-[status=active]:bg-surface-3 data-[status=active]:text-fg";
}

export function Shell() {
  const [open, setOpen] = useState(false);
  const [booted, setBooted] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const authed = useVeln((s) => s.connected && Boolean(s.mainAddress));

  useEffect(() => {
    let stop = false;
    void (async () => {
      try {
        await Promise.resolve(useVeln.persist.rehydrate());
      } catch {
        useVeln.getState().resetDemo();
      }
      try {
        const { phantomInstalled } = await import("@/lib/solana/phantom");
        if (!stop && phantomInstalled() && !useVeln.getState().signedOut) {
          const { attachPhantom } = await import("@/lib/solana/run-launch");
          await attachPhantom(true);
        }
      } catch {
        /* site is not approved in Phantom yet */
      }
      if (!stop) setBooted(true);
    })();
    const id = window.setInterval(() => {
      if (!useVeln.getState().connected) return;
      void import("@/lib/solana/run-launch").then(({ refreshLiveBalance }) => refreshLiveBalance()).catch(() => undefined);
    }, 20_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  if (!booted || !authed) {
    return (
      <>
        <Toaster position="bottom-right" theme="dark" />
        {booted ? <LoginPage /> : <div className="grid min-h-screen place-items-center bg-black"><Logo className="size-10 text-gold" /></div>}
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg text-fg">
      <Toaster position="bottom-right" theme="dark" />
      {open ? (
        <button type="button" className="fixed inset-0 z-30 bg-overlay lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-line bg-bg-elev transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar onClose={() => setOpen(false)} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3 lg:hidden">
          <button type="button" className="grid size-9 place-items-center rounded-md border border-line" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-4" />
          </button>
          <span className="text-sm font-semibold">Veln</span>
        </div>
        <header className="sticky top-0 z-10 hidden h-14 items-center gap-3 border-b border-line bg-bg/90 px-6 backdrop-blur lg:flex">
          <DeskHello />
        </header>
        <main key={path} className="page-in mx-auto w-full min-w-0 max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </div>
  );
}

function DeskHello() {
  const address = useVeln((s) => s.mainAddress);
  const initials = (address || "V").slice(0, 2).toUpperCase();
  return (
    <>
      <h1 className="truncate text-sm font-semibold">Welcome back{address ? `, ${shortAddr(address)}` : ""}</h1>
      <div className="ml-auto flex items-center gap-1">
        <Link to="/projects" aria-label="Search projects" className="grid size-9 place-items-center rounded-md text-muted hover:bg-white/5 hover:text-fg">
          <Search className="size-4" />
        </Link>
        <Link to="/settings" aria-label="Settings" className="grid size-9 place-items-center rounded-md text-muted hover:bg-white/5 hover:text-fg">
          <Bell className="size-4" />
        </Link>
        <span className="ml-1 grid size-8 place-items-center rounded-full bg-surface-3 text-[11px] font-medium">{initials}</span>
      </div>
    </>
  );
}

function Sidebar({ onClose }: { onClose: () => void }) {
  const connected = useVeln((s) => s.connected);
  const mainBalance = useVeln((s) => s.mainBalance);
  const mainAddress = useVeln((s) => s.mainAddress);
  const hide = useVeln((s) => s.settings.hideBalances);

  return (
    <>
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <Link to="/" className="flex items-center gap-2" aria-label="VELN home">
          <Logo className="size-7" />
          <span className="text-sm font-semibold">Veln</span>
        </Link>
        <button type="button" className="grid size-9 place-items-center rounded-lg text-muted lg:hidden" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </button>
      </div>
      <div className="px-3">
        <div className="rounded-xl border border-line bg-surface px-3.5 py-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
          <div className="flex items-center justify-between text-[11px] tracking-[0.16em] text-faint uppercase">
            <span>{connected ? "Connected" : "Wallet"}</span>
            {connected ? (
              <button type="button" className="text-muted hover:text-fg" onClick={() => void logOut()} aria-label="Log out">
                <LogOut className="size-3.5" />
              </button>
            ) : null}
          </div>
          {connected ? (
            <p className="mt-2 flex items-center gap-2 font-mono text-[1.55rem] font-medium tracking-tight tabular-nums text-fg">
              <SolGlyph className="size-4 text-gold" />
              {hide ? "••••" : sol(mainBalance, 5)}
            </p>
          ) : (
            <Button className="mt-3 w-full" onClick={() => {
              void import("@/lib/solana/run-launch")
                .then(({ attachPhantom }) => attachPhantom(false))
                .then(() => toast.success("Phantom connected"))
                .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Phantom rejected the connection"));
            }}>
              Connect Phantom
            </Button>
          )}
        </div>
      </div>
      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <div className="space-y-1">
          <Item to="/" exact icon={LayoutDashboard} label="Dashboard" />
        </div>
        <Group label="Launch">
          <Item to="/launch" icon={Rocket} label="Token Launch" />
          <Soon to="funded" icon={HandCoins} label="Funded Launch" />
          <Item to="/spam" exact icon={Layers} label="Spam Launch" />
        </Group>
        <Group label="Practice">
          <Item to="/practice" exact icon={GraduationCap} label="Practice zone" />
        </Group>
        <Group label="Trade">
          <Item to="/bump" exact icon={Zap} label="Bump Bot" />
          <Item to="/maker" exact icon={Activity} label="Market Maker" note="Volume booster" />
          <Soon to="snipe" icon={Crosshair} label="Snipe" />
          <Soon to="radar" icon={Radar} label="Radar" />
        </Group>
        <Group label="Tools">
          <Item to="/mixer" exact icon={Shuffle} label="Mixer" />
          <Item to="/disperse" exact icon={Send} label="Token Disperse" />
          <Item to="/buy" exact icon={CircleDollarSign} label="Buy DEX" />
          <Soon to="marketplace" icon={Store} label="Marketplace" />
        </Group>
        <Group label="Account">
          <Item to="/projects" exact icon={FolderKanban} label="Projects" />
          <Item to="/wallets" exact icon={Wallet} label="Wallets" />
          <Item to="/flex" exact icon={Sparkles} label="Flex cards" />
          <Item to="/settings" exact icon={Settings} label="Settings" />
        </Group>
      </nav>
      {connected ? (
        <div className="border-t border-line p-3">
          <button
            type="button"
            className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left text-xs text-muted hover:bg-white/[0.03]"
            onClick={() => {
              void navigator.clipboard.writeText(mainAddress).then(
                () => toast.success("Address copied"),
                () => toast.error("Couldn't copy"),
              );
            }}
          >
            <span className="grid size-7 place-items-center rounded-full bg-gold text-[11px] font-semibold text-ink">V</span>
            <span className="font-mono">{shortAddr(mainAddress)}</span>
            <Copy className="ml-auto size-3.5" />
          </button>
          <button type="button" className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-muted hover:bg-white/[0.03] hover:text-fg" onClick={() => void logOut()}>
            <LogOut className="size-4" />
            Log out
          </button>
        </div>
      ) : null}
    </>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 px-3 text-xs text-faint">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Item({
  to,
  icon: Icon,
  label,
  exact = false,
  note,
}: {
  to: "/" | "/flex" | "/launch" | "/funded" | "/spam" | "/practice" | "/bump" | "/maker" | "/mixer" | "/disperse" | "/buy" | "/projects" | "/wallets" | "/settings";
  icon: typeof Rocket;
  label: string;
  exact?: boolean;
  note?: string;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className={navClass()}
    >
      <Icon className="size-4 shrink-0 text-faint group-data-[status=active]:text-gold" />
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {note ? <span className="block truncate text-[10px] text-faint">{note}</span> : null}
      </span>
    </Link>
  );
}

function Soon({ to, icon: Icon, label, badge = "Soon" }: { to: string; icon: typeof Rocket; label: string; badge?: string }) {
  return (
    <Link
      to="/soon/$slug"
      params={{ slug: to }}
      className={navClass()}
    >
      <Icon className="size-4 shrink-0 text-faint group-data-[status=active]:text-gold" />
      <span className="truncate">{label}</span>
      <span className="ml-auto rounded-full border border-line px-1.5 py-px text-[10px] tracking-wide text-faint">{badge}</span>
    </Link>
  );
}

function StatusBar() {
  const connected = useVeln((s) => s.connected);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("0.1");
  const [dest, setDest] = useState("");
  const address = useVeln((s) => s.mainAddress);

  return (
    <>
      <footer className="flex items-center gap-4 overflow-x-auto border-t border-line bg-black px-4 py-2 text-[11px] text-muted">
        <button type="button" className="shrink-0 rounded-md border border-line-strong px-2 py-1 hover:border-fg/30 hover:text-fg" onClick={() => setOpen(true)}>
          Withdraw
        </button>
        <span className="shrink-0">PnL</span>
        <span className="shrink-0">Markets · Solana</span>
        <span className="hidden shrink-0 sm:inline">Pump.fun</span>
        <span className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden sm:inline">{connected ? "Phantom" : "Offline"}</span>
          <span className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", connected ? "bg-gain" : "bg-loss")} />
            {connected ? "Connected" : "Offline"}
          </span>
        </span>
      </footer>
      <Modal open={open} title="Withdraw" onClose={() => setOpen(false)}>
        <h2 className="text-lg font-semibold">Send SOL</h2>
        <p className="mt-1 text-sm text-muted">Phantom signs a real transfer. No desk fee on a send.</p>
        <label className="mt-4 block text-sm">
          Destination
          <input className={`${fieldClass} mt-2 font-mono`} placeholder="SOL address" value={dest} onChange={(e) => setDest(e.target.value.trim())} />
        </label>
        <label className="mt-4 block text-sm">
          Amount
          <input className={`${fieldClass} mt-2 font-mono`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              void (async () => {
                try {
                  const { transferSol, solBalance } = await import("@/lib/solana/phantom");
                  const { connectLive } = useVeln.getState();
                  if (!address) throw new Error("Connect Phantom first.");
                  const sig = await transferSol(address, dest, Number(amount));
                  const balance = await solBalance(address);
                  connectLive(address, balance);
                  toast.success(`Sent · ${sig.slice(0, 8)}`);
                  setOpen(false);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Send failed");
                }
              })();
            }}
          >
            Confirm
          </Button>
        </div>
      </Modal>
    </>
  );
}
