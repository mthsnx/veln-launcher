import { createFileRoute } from "@tanstack/react-router";
import { SpamPage } from "@/components/pages/tools";

export const Route = createFileRoute("/_shell/spam")({
  component: SpamPage,
});
