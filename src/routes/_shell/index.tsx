import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/components/dashboard";

export const Route = createFileRoute("/_shell/")({
  component: DashboardPage,
});
