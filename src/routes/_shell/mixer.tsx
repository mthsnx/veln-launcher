import { createFileRoute } from "@tanstack/react-router";
import { MixerPage } from "@/components/pages/tools";

export const Route = createFileRoute("/_shell/mixer")({
  component: MixerPage,
});
