import { createFileRoute } from "@tanstack/react-router";
import { SoonPage } from "@/components/pages/tools";

export const Route = createFileRoute("/_shell/funded")({
  component: function FundedLocked() {
    return <SoonPage slug="funded" />;
  },
});
