import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout for the People section — the index (directory) and $userId (detail)
// render through this Outlet.
export const Route = createFileRoute("/_app/people")({
  component: PeopleLayout,
});

function PeopleLayout() {
  return <Outlet />;
}
