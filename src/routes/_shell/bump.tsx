import { createFileRoute } from "@tanstack/react-router";
import { BumpPage } from "@/components/pages/tools";

export const Route = createFileRoute("/_shell/bump")({
  component: BumpPage,
});
