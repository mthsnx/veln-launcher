import { createFileRoute } from "@tanstack/react-router";
import { ProjectDesk } from "@/components/pages/project-desk";

export const Route = createFileRoute("/_shell/projects/$id")({
  component: function ProjectRoute() {
    const { id } = Route.useParams();
    return <ProjectDesk id={id} />;
  },
});
