import { createFileRoute } from "@tanstack/react-router";
import { BuyPage } from "@/components/pages/tools";

export const Route = createFileRoute("/_shell/buy")({
  component: BuyPage,
});
