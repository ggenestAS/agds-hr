import type { ComponentProps } from "react";

import { cn } from "../../lib/cn.ts";

// Loading placeholder primitive (§9.1 route skeletons). bg-muted follows the
// theme, so skeletons render correctly in dark mode.
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}
