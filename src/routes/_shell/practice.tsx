import { createFileRoute } from "@tanstack/react-router";
import { PracticePage } from "@/components/pages/tools";

export const Route = createFileRoute("/_shell/practice")({
  component: PracticePage,
});
