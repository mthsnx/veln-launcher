import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAIN_ADDRESS } from "@/data/catalog";
import { utcDay } from "@/lib/format";
import { capitalOf, draftCharges, emptyDraft, launchBlocker, pnlToUsd } from "@/lib/plan";
import type { Activity, DayPoint, Draft, LaunchInput, Position, Preset, Project, StyleId, Wallet } from "@/lib/types";
import { generateSolanaWallet, walletFromMnemonic, walletFromSecret } from "@/lib/solana/keys";
import { round, uid } from "@/lib/utils";

type Settings = {
  defaultSlippage: number;
  defaultTip: string;
  hideBalances: boolean;
};

type Book = {
  projects: Project[];
  activity: Activity[];
  days: DayPoint[];
  wallets: Wallet[];
  positions: Position[];
  presets: Preset[];
};

type Data = {
  connected: boolean;
  mainBalance: number;
  mainAddress: string;
  wallets: Wallet[];
  projects: Project[];
  activity: Activity[];
  days: DayPoint[];
  presets: Preset[];
  positions: Position[];
  draft: Draft;
  settings: Settings;
  books: Record<string, Book>;
  signedOut: boolean;
};

type Result = { ok: true; id: string } | { ok: false; error: string };

type Actions = {
  connect: () => void;
  connectLive: (address: string, balance: number) => void;
  disconnect: () => void;
  recordLiveLaunch: (input: { mint: string; signature: string; feeSignature: string; spentSol: number; balance: number; name?: string; symbol?: string }) => string;
  applyLivePnl: (input: { projectId: string; pnlSol: number; balance: number; title: string; subtitle: string }) => void;
  startDraft: (style: StyleId) => void;
  patchDraft: (partial: Partial<Draft>) => void;
  setEqualAmounts: () => void;
  applyBundlePct: () => void;
  savePreset: (name: string) => void;
  applyPreset: (id: string) => void;
  deletePreset: (id: string) => void;
  createWallet: (name: string) => Wallet;
  importWallet: (name: string, address: string) => { ok: true } | { ok: false; error: string };
  importKey: (name: string, material: string) => { ok: true; id: string } | { ok: false; error: string };
  setWalletBalance: (address: string, balance: number) => void;
  removeWallet: (id: string) => void;
  fundWallet: (id: string, amount: number) => { ok: true } | { ok: false; error: string };
  withdraw: (amount: number) => { ok: true } | { ok: false; error: string };
  spend: (id: string, amount: number) => boolean;
  credit: (id: string, amount: number) => void;
  commitLaunch: (input: LaunchInput) => Result;
  launchDraft: () => Result;
  postPnl: (pnlSol: number, title: string, subtitle: string) => void;
  pushActivity: (title: string, subtitle: string, pnlSol?: number, projectId?: string) => void;
  noteSpend: (projectId: string, sol: number) => void;
  openPosition: (projectId: string, costSol: number) => { ok: true } | { ok: false; error: string };
  closePosition: (id: string, factor: number) => { ok: true; pnlSol: number } | { ok: false; error: string };
  patchSettings: (partial: Partial<Settings>) => void;
  resetDemo: () => void;
};

export type VelnStore = Data & Actions;

const memoryStorage: Storage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  key: () => null,
  length: 0,
  clear: () => {},
};

function emptyBook(): Book {
  return { projects: [], activity: [], days: [], wallets: [], positions: [], presets: [] };
}

function takeBook(state: Data): Book {
  return {
    projects: state.projects,
    activity: state.activity,
    days: state.days,
    wallets: state.wallets,
    positions: state.positions,
    presets: state.presets,
  };
}

function seedData(): Data {
  return {
    connected: false,
    mainBalance: 0,
    mainAddress: "",
    ...emptyBook(),
    draft: emptyDraft("bundle"),
    settings: {
      defaultSlippage: 50,
      defaultTip: "0.001",
      hideBalances: false,
    },
    books: {},
    signedOut: false,
  };
}

function addChart(days: Data["days"], pnlUsd: number, ts = Date.now()) {
  const key = utcDay(ts);
  const next = days.map((d) => ({ ...d }));
  const hit = next.find((d) => d.date === key);
  if (hit) hit.pnlUsd = round(hit.pnlUsd + pnlUsd, 2);
  else next.push({ date: key, pnlUsd: round(pnlUsd, 2) });
  return next.slice(-90);
}

function applyCharges(wallets: Wallet[], mainBalance: number, charges: LaunchInput["charges"]) {
  let main = mainBalance;
  const next = wallets.map((w) => ({ ...w }));
  for (const c of charges) {
    if (c.amount <= 0) continue;
    if (c.walletId === "main") {
      if (main + 1e-9 < c.amount) return null;
      main = round(main - c.amount);
      continue;
    }
    const w = next.find((x) => x.id === c.walletId);
    if (!w || w.balance + 1e-9 < c.amount) return null;
    w.balance = round(w.balance - c.amount);
  }
  return { wallets: next, mainBalance: main };
}

export const useVeln = create<VelnStore>()(
  persist(
    (set, get) => ({
      ...seedData(),
      connect: () => set({ connected: true }),
      connectLive: (address, balance) => {
        const current = get();
        const books = { ...current.books };
        if (current.mainAddress) books[current.mainAddress] = takeBook(current);
        const book = current.mainAddress === address ? takeBook(current) : (books[address] ?? emptyBook());
        set({
          connected: true,
          signedOut: false,
          mainAddress: address,
          mainBalance: round(balance, 5),
          books,
          ...book,
        });
      },
      disconnect: () => {
        const current = get();
        const books = { ...current.books };
        if (current.mainAddress) books[current.mainAddress] = takeBook(current);
        set({
          connected: false,
          signedOut: true,
          mainAddress: "",
          mainBalance: 0,
          books,
          ...emptyBook(),
          draft: emptyDraft("bundle"),
        });
      },
      recordLiveLaunch: ({ mint, signature, feeSignature, spentSol, balance, name, symbol }) => {
        const draft = get().draft;
        const project: Project = {
          id: uid("p"),
          style: draft.style,
          name: (name ?? draft.name).trim(),
          symbol: (symbol ?? draft.symbol).trim().toUpperCase(),
          description: draft.description.trim(),
          image: draft.image,
          platform: draft.style === "cto" ? "Pump.fun" : draft.platform,
          buyMode: draft.buyMode,
          pnlSol: 0,
          spentSol,
          walletCount: 1,
          status: "success",
          createdAt: Date.now(),
          source: draft.sourceName || undefined,
          extras: [`Fee ${feeSignature.slice(0, 8)}`],
          mint,
          signature,
        };
        const title = draft.style === "cto" ? "Bought · Pump.fun" : draft.style === "vamp" ? "Vamp live · Pump.fun" : "Launched · Pump.fun";
        set({
          mainBalance: round(balance, 5),
          projects: [project, ...get().projects],
          activity: [
            {
              id: uid("a"),
              projectId: project.id,
              title,
              subtitle: `${project.symbol} · ${mint}`,
              pnlSol: 0,
              createdAt: project.createdAt,
              status: "success",
            },
            ...get().activity,
          ],
        });
        return project.id;
      },
      applyLivePnl: ({ projectId, pnlSol, balance, title, subtitle }) => {
        set({
          mainBalance: round(balance, 5),
          projects: get().projects.map((p) => (p.id === projectId ? { ...p, pnlSol: round(p.pnlSol + pnlSol, 4) } : p)),
          activity: [
            { id: uid("a"), projectId, title, subtitle, pnlSol, createdAt: Date.now(), status: "success" as const },
            ...get().activity,
          ],
          days: addChart(get().days, pnlToUsd(pnlSol)),
        });
      },
      startDraft: (style) => {
        const s = get().settings;
        set({
          draft: {
            ...emptyDraft(style),
            slippage: s.defaultSlippage,
            jitoTip: s.defaultTip,
          },
        });
      },
      patchDraft: (partial) => set({ draft: { ...get().draft, ...partial } }),
      setEqualAmounts: () => {
        const d = get().draft;
        if (d.distribution !== "equal" || d.buyMode === "dev") return;
        const ids = d.bundleWalletIds;
        const total = Number(d.totalSol) || 0;
        const each = ids.length ? round(total / ids.length) : 0;
        const amounts = { ...d.amounts };
        for (const id of ids) amounts[id] = String(each);
        set({ draft: { ...d, amounts } });
      },
      applyBundlePct: () => {
        const d = get().draft;
        const wallets = get().wallets;
        const amounts = { ...d.amounts };
        for (const id of d.bundleWalletIds) {
          const w = wallets.find((x) => x.id === id);
          if (!w) continue;
          const amt = round((w.balance * d.bundlePct) / 100);
          amounts[id] = String(amt);
        }
        set({ draft: { ...d, distribution: "custom", amounts } });
      },
      savePreset: (name) => {
        const d = get().draft;
        const preset: Preset = {
          id: uid("pre"),
          name: name.trim() || "Untitled",
          buyMode: d.buyMode,
          slippage: d.slippage,
          jitoTip: d.jitoTip,
          distribution: d.distribution,
          bundlePct: d.bundlePct,
          devWalletId: d.devWalletId,
          bundleWalletIds: [...d.bundleWalletIds],
          totalSol: d.totalSol,
          devBudget: d.devBudget,
          farmSnipers: d.farmSnipers,
        };
        set({ presets: [preset, ...get().presets].slice(0, 12) });
      },
      applyPreset: (id) => {
        const p = get().presets.find((x) => x.id === id);
        if (!p) return;
        const wallets = get().wallets;
        const devWalletId = wallets.some((w) => w.id === p.devWalletId) ? p.devWalletId : null;
        const bundleWalletIds = p.bundleWalletIds.filter((wid) => wallets.some((w) => w.id === wid));
        set({
          draft: {
            ...get().draft,
            buyMode: p.buyMode,
            slippage: p.slippage,
            jitoTip: p.jitoTip,
            distribution: p.distribution,
            bundlePct: p.bundlePct,
            devWalletId,
            bundleWalletIds,
            totalSol: p.totalSol,
            devBudget: p.devBudget,
            farmSnipers: p.farmSnipers,
          },
        });
        get().setEqualAmounts();
      },
      deletePreset: (id) => set({ presets: get().presets.filter((p) => p.id !== id) }),
      createWallet: (name) => {
        const keys = generateSolanaWallet();
        const w: Wallet = {
          id: uid("w"),
          name: name.trim() || `Wallet ${get().wallets.length + 1}`,
          address: keys.address,
          balance: 0,
          tag: "Seed",
          mnemonic: keys.mnemonic,
          secretKey: keys.secretKey,
        };
        set({ wallets: [w, ...get().wallets] });
        return w;
      },
      importWallet: (name, address) => {
        const addr = address.trim();
        if (addr.length < 32) return { ok: false as const, error: "Address looks too short." };
        if (get().wallets.some((w) => w.address === addr) || addr === get().mainAddress) {
          return { ok: false as const, error: "That address is already on the desk." };
        }
        const w: Wallet = { id: uid("w"), name: name.trim() || "Imported", address: addr, balance: 0, tag: "Watch" };
        set({ wallets: [w, ...get().wallets] });
        return { ok: true as const };
      },
      importKey: (name, material) => {
        const raw = material.trim();
        if (!raw) return { ok: false as const, error: "Paste a seed phrase or a private key." };
        let keys: { address: string; mnemonic: string; secretKey: string };
        try {
          keys = raw.includes(" ") ? walletFromMnemonic(raw) : walletFromSecret(raw);
        } catch (error) {
          return { ok: false as const, error: error instanceof Error ? error.message : "Couldn't read that key." };
        }
        if (get().wallets.some((w) => w.address === keys.address) || keys.address === get().mainAddress) {
          return { ok: false as const, error: "That wallet is already on the desk." };
        }
        const w: Wallet = {
          id: uid("w"),
          name: name.trim() || "Imported",
          address: keys.address,
          balance: 0,
          tag: "Seed",
          mnemonic: keys.mnemonic || undefined,
          secretKey: keys.secretKey,
        };
        set({ wallets: [w, ...get().wallets] });
        return { ok: true as const, id: w.id };
      },
      setWalletBalance: (address, balance) => {
        set({
          wallets: get().wallets.map((w) => (w.address === address ? { ...w, balance: round(balance, 5) } : w)),
        });
      },
      removeWallet: (id) => {
        const d = get().draft;
        set({
          wallets: get().wallets.filter((w) => w.id !== id),
          draft: {
            ...d,
            devWalletId: d.devWalletId === id ? null : d.devWalletId,
            bundleWalletIds: d.bundleWalletIds.filter((x) => x !== id),
          },
        });
      },
      fundWallet: (id, amount) => {
        if (!(amount > 0)) return { ok: false, error: "Enter an amount." };
        if (get().mainBalance + 1e-9 < amount) return { ok: false, error: "Connected wallet doesn't have that much." };
        const w = get().wallets.find((x) => x.id === id);
        if (!w) return { ok: false, error: "Wallet missing." };
        set({
          mainBalance: round(get().mainBalance - amount),
          wallets: get().wallets.map((x) => (x.id === id ? { ...x, balance: round(x.balance + amount), tag: x.tag || "Funded" } : x)),
        });
        return { ok: true };
      },
      withdraw: (amount) => {
        if (!(amount > 0)) return { ok: false, error: "Enter an amount." };
        if (get().mainBalance + 1e-9 < amount) return { ok: false, error: "Not enough unspent SOL." };
        set({ mainBalance: round(get().mainBalance - amount) });
        get().pushActivity("Withdrawal", `${amount.toFixed(4)} SOL queued`, 0);
        return { ok: true };
      },
      spend: (id, amount) => {
        if (!(amount > 0)) return false;
        if (id === "main") {
          if (get().mainBalance + 1e-9 < amount) return false;
          set({ mainBalance: round(get().mainBalance - amount) });
          return true;
        }
        const w = get().wallets.find((x) => x.id === id);
        if (!w || w.balance + 1e-9 < amount) return false;
        set({
          wallets: get().wallets.map((x) => (x.id === id ? { ...x, balance: round(x.balance - amount) } : x)),
        });
        return true;
      },
      credit: (id, amount) => {
        if (!(amount > 0)) return;
        if (id === "main") {
          set({ mainBalance: round(get().mainBalance + amount) });
          return;
        }
        set({
          wallets: get().wallets.map((x) => (x.id === id ? { ...x, balance: round(x.balance + amount) } : x)),
        });
      },
      commitLaunch: (input) => {
        if (get().connected && get().mainAddress && get().mainAddress !== MAIN_ADDRESS) {
          return { ok: false, error: "That tool is still paper-only. Token Launch spends real SOL on Pump.fun." };
        }
        const applied = applyCharges(get().wallets, get().mainBalance, input.charges);
        if (!applied) return { ok: false, error: "A wallet can't cover its share." };
        const spent = round(input.charges.reduce((s, c) => s + c.amount, 0));
        const fail = Math.random() < (input.failChance ?? 0.07);
        let status: Project["status"] = "success";
        let pnlSol = 0;
        let wallets = applied.wallets;
        let mainBalance = applied.mainBalance;
        if (fail) {
          status = "failed";
          pnlSol = -round(Math.min(spent, 0.021));
          const refund = round(spent + pnlSol);
          if (refund > 0 && input.charges[0]) {
            const back = input.charges[0].walletId;
            if (back === "main") mainBalance = round(mainBalance + refund);
            else wallets = wallets.map((w) => (w.id === back ? { ...w, balance: round(w.balance + refund) } : w));
          }
        } else if (Math.random() < 0.36) {
          pnlSol = round(spent * (0.45 + Math.random() * 2.6), 4);
        } else {
          pnlSol = -round(spent * (0.08 + Math.random() * 0.55) + 0.004, 4);
        }
        const project: Project = {
          id: uid("p"),
          style: input.style,
          name: input.name.trim(),
          symbol: input.symbol.trim().toUpperCase(),
          description: input.description.trim(),
          image: input.image,
          platform: input.platform,
          buyMode: input.buyMode,
          pnlSol,
          spentSol: fail ? round(Math.abs(pnlSol)) : spent,
          walletCount: input.walletCount,
          status,
          createdAt: Date.now(),
          source: input.source,
          extras: input.extras ?? [],
        };
        const title =
          status === "failed"
            ? "Launch failed · Solana"
            : input.style === "cto"
              ? "Takeover · Solana"
              : input.style === "vamp"
                ? "Vamp launched · Solana"
                : "Token launched · Solana";
        set({
          wallets,
          mainBalance,
          projects: [project, ...get().projects],
          activity: [
            {
              id: uid("a"),
              projectId: project.id,
              title,
              subtitle: `${project.name} (${project.symbol})`,
              pnlSol,
              createdAt: project.createdAt,
              status,
            },
            ...get().activity,
          ],
          days: addChart(get().days, pnlToUsd(pnlSol)),
        });
        return { ok: true, id: project.id };
      },
      launchDraft: () => {
        const draft = get().draft;
        const err = launchBlocker(draft, get().wallets);
        if (err) return { ok: false, error: err };
        const charges = draftCharges(draft);
        const extras = [
          ...draft.automations.map((a) => a.label),
          draft.farmSnipers ? "Farm snipers armed" : "",
          draft.smartSell ? "Smart sell armed" : "",
          draft.autoTp ? `Auto TP ${draft.autoTp}%` : "",
        ].filter(Boolean);
        return get().commitLaunch({
          style: draft.style,
          name: draft.name,
          symbol: draft.symbol,
          description: draft.description,
          image: draft.image,
          platform: draft.platform,
          buyMode: draft.buyMode,
          walletCount: draft.buyMode === "dev" ? 1 : 1 + draft.bundleWalletIds.length,
          charges,
          extras,
          source: draft.sourceName || undefined,
          failChance: 0.06,
        });
      },
      postPnl: (pnlSol, title, subtitle) => {
        set({
          activity: [
            {
              id: uid("a"),
              title,
              subtitle,
              pnlSol,
              createdAt: Date.now(),
              status: "success",
            },
            ...get().activity,
          ],
          days: addChart(get().days, pnlToUsd(pnlSol)),
        });
      },
      pushActivity: (title, subtitle, pnlSol = 0, projectId) => {
        set({
          activity: [
            {
              id: uid("a"),
              projectId,
              title,
              subtitle,
              pnlSol,
              createdAt: Date.now(),
              status: "success",
            },
            ...get().activity,
          ],
        });
      },
      noteSpend: (projectId, solAmount) => {
        if (!(solAmount > 0)) return;
        set({
          projects: get().projects.map((project) =>
            project.id === projectId ? { ...project, spentSol: round(project.spentSol + solAmount, 5) } : project,
          ),
        });
      },
      openPosition: (projectId, costSol) => {
        if (!(costSol > 0)) return { ok: false, error: "Enter a size." };
        if (!get().spend("main", costSol)) return { ok: false, error: "Connected wallet can't cover that buy." };
        const entry = round(0.00001 + Math.random() * 0.0002, 8);
        const pos: Position = {
          id: uid("pos"),
          projectId,
          costSol,
          tokens: costSol / entry,
          entry,
        };
        set({ positions: [pos, ...get().positions] });
        return { ok: true };
      },
      closePosition: (id, factor) => {
        const pos = get().positions.find((p) => p.id === id);
        if (!pos) return { ok: false, error: "Position already closed." };
        const value = round(pos.costSol * factor);
        const pnlSol = round(value - pos.costSol);
        get().credit("main", Math.max(0, value));
        const project = get().projects.find((p) => p.id === pos.projectId);
        set({ positions: get().positions.filter((p) => p.id !== id) });
        get().postPnl(pnlSol, "DEX sell", project ? `${project.symbol} closed` : "Position closed");
        return { ok: true, pnlSol };
      },
      patchSettings: (partial) => set({ settings: { ...get().settings, ...partial } }),
      resetDemo: () => {
        const current = get();
        const books = { ...current.books };
        if (current.mainAddress) books[current.mainAddress] = emptyBook();
        set({ ...emptyBook(), books, draft: emptyDraft("bundle") });
      },
    }),
    {
      name: "veln-desk-v4",
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage : localStorage)),
      skipHydration: true,
      merge: (persisted, current) => {
        const saved = persisted && typeof persisted === "object" ? (persisted as Partial<Data>) : {};
        const books = saved.books && typeof saved.books === "object" ? saved.books : {};
        return {
          ...current,
          ...emptyBook(),
          connected: false,
          mainBalance: 0,
          mainAddress: "",
          books,
          signedOut: saved.signedOut === true,
          settings: {
            defaultSlippage: Number(saved.settings?.defaultSlippage) || current.settings.defaultSlippage,
            defaultTip: saved.settings?.defaultTip || current.settings.defaultTip,
            hideBalances: saved.settings?.hideBalances === true,
          },
          draft: emptyDraft("bundle"),
        };
      },
      partialize: (s) => {
        const books = { ...s.books };
        if (s.connected && s.mainAddress) books[s.mainAddress] = takeBook(s);
        return { books, settings: s.settings, signedOut: s.signedOut };
      },
    },
  ),
);

export function walletById(id: string | null) {
  if (!id) return undefined;
  return useVeln.getState().wallets.find((w) => w.id === id);
}

export function spentLabel(draft: Draft) {
  return capitalOf(draft);
}
