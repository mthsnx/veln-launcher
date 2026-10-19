import { createFileRoute } from "@tanstack/react-router";
import { ProjectsPage } from "@/components/pages/projects";

export const Route = createFileRoute("/_shell/projects")({
  component: ProjectsPage,
});
