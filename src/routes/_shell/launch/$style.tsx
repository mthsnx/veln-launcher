import { createFileRoute } from "@tanstack/react-router";
import { Wizard } from "@/components/launch/wizard";

export const Route = createFileRoute("/_shell/launch/$style")({
  component: function LaunchStyle() {
    const { style } = Route.useParams();
    return <Wizard style={style} />;
  },
});
