import { createFileRoute } from "@tanstack/react-router";
import { TogglePage } from "./admin.trending";

export const Route = createFileRoute("/admin/featured")({
  component: () => <TogglePage field="is_featured" title="Featured Manager" />,
});
