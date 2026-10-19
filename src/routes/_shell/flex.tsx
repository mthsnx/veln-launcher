import { createFileRoute } from "@tanstack/react-router";
import { FlexPage } from "@/components/pages/flex";

export const Route = createFileRoute("/_shell/flex")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : "",
  }),
  component: function FlexRoute() {
    const { id } = Route.useSearch();
    return <FlexPage id={id} />;
  },
});
