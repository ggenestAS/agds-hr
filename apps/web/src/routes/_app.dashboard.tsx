import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";

// First authenticated surface — a placeholder proving the gate, the frame, and
// session context. Real "Albert People" surfaces land in step 10.
export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { session } = Route.useRouteContext();
  return (
    <div className="mx-auto max-w-3xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Signed in
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">
        {session.subject.email}
      </h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Roles: {session.subject.roles.join(", ") || "none"}
        </CardContent>
      </Card>
    </div>
  );
}
