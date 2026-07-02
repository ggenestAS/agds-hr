import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "../../lib/cn.ts";

// Cards are reserved for dashboard tiles, semantic callouts, and composers —
// never the default wrapper around flat data (docs/new-project-directives.md
// §9.4). Semantic looks are variants; `warning` is the one added color.
export const cardVariants = cva("rounded-[14px] border bg-card text-card-foreground", {
  variants: {
    variant: {
      default: "border-border shadow-[var(--shadow-soft)]",
      warning: "border-[var(--color-warning)]/40 bg-[var(--color-warning-surface)]",
    },
  },
  defaultVariants: { variant: "default" },
});

export type CardProps = ComponentProps<"div"> & VariantProps<typeof cardVariants>;

export function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 p-5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3 className={cn("font-display text-lg font-semibold tracking-tight", className)} {...props} />
  );
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}
