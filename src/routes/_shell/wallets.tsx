import { createFileRoute } from "@tanstack/react-router";
import { WalletsPage } from "@/components/pages/wallets";

export const Route = createFileRoute("/_shell/wallets")({
  component: WalletsPage,
});
