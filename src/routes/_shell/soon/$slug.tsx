import { createFileRoute } from "@tanstack/react-router";
import { SoonPage } from "@/components/pages/tools";

export const Route = createFileRoute("/_shell/soon/$slug")({
  component: function SoonRoute() {
    const { slug } = Route.useParams();
    return <SoonPage slug={slug} />;
  },
});
