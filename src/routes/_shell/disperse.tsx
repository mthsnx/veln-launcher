import { createFileRoute } from "@tanstack/react-router";
import { DispersePage } from "@/components/pages/tools";

export const Route = createFileRoute("/_shell/disperse")({
  component: DispersePage,
});
