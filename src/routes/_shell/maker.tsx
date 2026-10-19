import { createFileRoute } from "@tanstack/react-router";
import { MakerPage } from "@/components/pages/tools";

export const Route = createFileRoute("/_shell/maker")({
  component: MakerPage,
});
