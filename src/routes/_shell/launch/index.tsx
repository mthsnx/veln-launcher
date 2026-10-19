import { createFileRoute } from "@tanstack/react-router";
import { StylePicker } from "@/components/launch/wizard";

export const Route = createFileRoute("/_shell/launch/")({
  component: StylePicker,
});
