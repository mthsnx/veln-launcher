import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { BarChart3, ClipboardList, FileText, Users } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { relTime, signedSol, sol } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useVeln } from "@/store/veln";
import { Panel } from "@/components/ui";

export function DashboardPage() {
  const projects = useVeln((s) => s.projects) ?? [];
  const activity = useVeln((s) => s.activity) ?? [];
  const wallets = useVeln((s) => s.wallets) ?? [];
  const main = useVeln((s) => s.mainBalance) ?? 0;
  const address = useVeln((s) => s.mainAddress);
  const hide = useVeln((s) => s.settings?.hideBalances) ?? false;

  const weekAgo = Date.now() - 7 * 86400000;
  const launchedWeek = projects.filter((p) => p.createdAt >= weekAgo).length;
  const soldWeek = activity.filter((a) => a.createdAt >= weekAgo && /sell/i.test(a.title)).length;
  const closed = projects.filter((p) => p.pnlSol !== 0);
  const wins = closed.filter((p) => p.pnlSol > 0).length;
  const hit = closed.length === 0 ? "—" : `${Math.round((wins / closed.length) * 100)}%`;
  const chart = useMemo(() => lastWeeks(projects, activity), [projects, activity]);
  const emptyChart = chart.every((row) => row.launched === 0 && row.sold === 0);

  const stats = [
    { label: "Launches", value: String(projects.length), hint: launchedWeek > 0 ? `+${launchedWeek} this week` : "None this week", icon: FileText },
    { label: "Sells", value: String(activity.filter((a) => /sell/i.test(a.title)).length), hint: soldWeek > 0 ? `+${soldWeek} this week` : "None this week", icon: ClipboardList },
    { label: "Wallets", value: String(wallets.length + (address ? 1 : 0)), hint: hide ? "Balance hidden" : `${sol(main, 3)} SOL on Phantom`, icon: Users },
    { label: "Hit rate", value: hit, hint: closed.length === 0 ? "No closed trades" : `${wins} of ${closed.length} green`, icon: BarChart3 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Panel key={stat.label} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">{stat.label}</p>
              <stat.icon className="size-4 text-faint" />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{stat.value}</p>
            <p className="mt-1 text-xs text-faint">{stat.hint}</p>
          </Panel>
        ))}
      </div>

      <Panel className="p-5">
        <h2 className="font-medium">Launch throughput</h2>
        <p className="mt-1 text-sm text-muted">Coins opened against sells, the last eight weeks.</p>
        {emptyChart ? (
          <p className="py-16 text-center text-sm text-muted">Nothing in this window yet.</p>
        ) : (
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="soldFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fafafa" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#fafafa" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "#71717a", fontSize: 12 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} tick={{ fill: "#71717a", fontSize: 12 }} />
                <Tooltip contentStyle={{ background: "#111113", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
                <Area dataKey="launched" name="Launched" type="monotone" stroke="#a1a1aa" strokeDasharray="4 4" fill="none" strokeWidth={2} />
                <Area dataKey="sold" name="Sold" type="monotone" stroke="#fafafa" fill="url(#soldFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="font-medium">Projects</h2>
          <p className="mt-1 text-sm text-muted">What this wallet has actually launched.</p>
          {projects.length === 0 ? (
            <p className="py-10 text-sm text-muted">No projects yet. <Link to="/launch" className="text-fg underline-offset-4 hover:underline">Start one</Link>.</p>
          ) : (
            <ul className="mt-5 flex flex-col gap-5">
              {projects.slice(0, 4).map((project) => (
                <li key={project.id}>
                  <div className="flex items-center justify-between gap-2">
                    <Link to="/projects/$id" params={{ id: project.id }} className="truncate text-sm font-medium hover:underline">
                      {project.name} <span className="text-muted">${project.symbol}</span>
                    </Link>
                    <span className={cn("rounded-md border border-line px-2 py-0.5 text-[11px]", project.status === "failed" ? "text-loss" : "text-muted")}>
                      {project.status === "failed" ? "Failed" : project.style}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">{project.description || project.platform}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full bg-fg/80" style={{ width: project.status === "success" ? "100%" : "30%" }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-faint">
                    <span>{project.walletCount} wallets · {signedSol(project.pnlSol)} SOL</span>
                    <span>{relTime(project.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="font-medium">Recent activity</h2>
          <p className="mt-1 text-sm text-muted">Signed from this desk.</p>
          {activity.length === 0 ? (
            <p className="py-10 text-sm text-muted">Nothing signed yet.</p>
          ) : (
            <ol className="mt-5 flex flex-col gap-4">
              {activity.slice(0, 6).map((entry) => (
                <li key={entry.id} className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-medium">
                    {entry.title.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">{entry.title}</span>{" "}
                      <span className="text-muted">{entry.subtitle}</span>
                    </p>
                    <p className="text-xs text-faint">{relTime(entry.createdAt)} · {signedSol(entry.pnlSol)} SOL</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  );
}

function lastWeeks(
  projects: { createdAt: number }[],
  activity: { createdAt: number; title: string }[],
) {
  const rows = [];
  for (let i = 7; i >= 0; i -= 1) {
    const end = Date.now() - i * 7 * 86400000;
    const start = end - 7 * 86400000;
    rows.push({
      week: format(end, "MMM d"),
      launched: projects.filter((p) => p.createdAt >= start && p.createdAt < end).length,
      sold: activity.filter((a) => a.createdAt >= start && a.createdAt < end && /sell/i.test(a.title)).length,
    });
  }
  return rows;
}
