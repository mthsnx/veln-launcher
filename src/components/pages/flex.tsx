import { useMemo, useState } from "react";
import { FlexActions, FlexCard } from "@/components/flex-card";
import { Empty, PageIntro } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useVeln } from "@/store/veln";

type Filter = "all" | "up" | "down";

export function FlexPage({ id }: { id: string }) {
  const projects = useVeln((s) => s.projects);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState(id);
  const featured = projects.find((p) => p.id === (selectedId || id)) ?? projects[0];
  const list = useMemo(() => {
    return projects.filter((p) => {
      if (filter === "up") return p.pnlSol > 0 && p.status !== "failed";
      if (filter === "down") return p.pnlSol < 0 || p.status === "failed";
      return true;
    });
  }, [projects, filter]);

  return (
    <div>
      <PageIntro
        kicker="Cards"
        title="Flex cards"
        sub="Every launch mints a card. Save it or copy a caption. Profit and loss share the same frame."
      />
      {!featured ? (
        <Empty title="No cards yet" body="Launch a coin and the first card lands here." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr] lg:items-start">
          <div>
            <FlexCard project={featured} featured />
            <FlexActions project={featured} />
          </div>
          <div>
            <div className="mb-3 flex gap-2">
              {(
                [
                  ["all", "All"],
                  ["up", "Profit"],
                  ["down", "Loss"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className={cn(
                    "min-h-10 rounded-md border px-3 text-sm",
                    filter === k ? "border-gold bg-gold-dim text-gold" : "border-line text-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={cn("rounded-lg text-left", p.id === featured.id && "ring-1 ring-gold")}
                >
                  <FlexCard project={p} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
