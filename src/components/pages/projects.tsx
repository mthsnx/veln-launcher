import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { buyModeLabel, styleLabel } from "@/lib/plan";
import { relTime, signedSol } from "@/lib/format";
import type { StyleId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useVeln } from "@/store/veln";
import { TokenMark } from "@/components/token-mark";
import { Empty, PageIntro } from "@/components/ui";

type Filter = "all" | StyleId | "up" | "down";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bundle", label: "Bundle" },
  { id: "vamp", label: "Vamp" },
  { id: "cto", label: "CTO" },
  { id: "up", label: "Profit" },
  { id: "down", label: "Loss" },
];

export function ProjectsPage() {
  const projects = useVeln((s) => s.projects);
  const [filter, setFilter] = useState<Filter>("all");
  const list = projects.filter((p) => {
    if (filter === "all") return true;
    if (filter === "up") return p.pnlSol > 0 && p.status !== "failed";
    if (filter === "down") return p.pnlSol < 0 || p.status === "failed";
    return p.style === filter;
  });

  return (
    <div>
      <PageIntro kicker="Account" title="Projects" sub="Everything this desk has launched or taken over." />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "min-h-10 rounded-md border px-3 text-sm",
              filter === f.id ? "border-gold bg-gold-dim text-gold" : "border-line text-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty title="Nothing in this filter" body="Launch a bundle, vamp a coin, or take one over." />
      ) : (
        <ul className="space-y-2">
          {list.map((p) => {
            return (
              <li key={p.id} className="rounded-lg border border-line bg-surface">
                <Link to="/projects/$id" params={{ id: p.id }} className="flex w-full items-center gap-3 px-3 py-3 text-left">
                  {p.image ? <img src={p.image} alt="" className="size-10 rounded-md object-cover" /> : <TokenMark seed={p.symbol} className="size-10" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-xs text-faint">
                      ${p.symbol} · {styleLabel(p.style)} · {relTime(p.createdAt)}
                    </span>
                  </span>
                  <span className={cn("font-mono text-sm tabular-nums", p.pnlSol >= 0 && p.status !== "failed" ? "text-gain" : "text-loss")}>
                    {signedSol(p.pnlSol)} SOL
                  </span>
                </Link>
                <div className="border-t border-line px-3 py-2 text-xs text-faint">
                  {p.platform} · {buyModeLabel(p.buyMode)} · {p.spentSol.toFixed(3)} SOL in
                  {p.mint ? ` · ${p.mint.slice(0, 4)}…${p.mint.slice(-4)}` : ""}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
