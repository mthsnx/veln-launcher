import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/components/pages/settings";

export const Route = createFileRoute("/_shell/settings")({
  component: SettingsPage,
});
