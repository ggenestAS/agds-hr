import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";

// Placeholder for the People directory (the design's primary surface). The real
// browse/list-detail shape — Level·Path, Country, Band position, Rating, and the
// review-cycle state machine — lands with the `people` product domain (step 10).
export const Route = createFileRoute("/_app/people")({
  component: People,
});

function People() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        People
      </p>
      <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Directory</h1>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Coming with the people domain</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The directory, annual review cycle, calibration, compensation, and appeals surfaces are
          implemented in bootstrap step 10 on this frame.
        </CardContent>
      </Card>
    </div>
  );
}
