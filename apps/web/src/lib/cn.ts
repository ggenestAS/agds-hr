import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// The house class combinator (docs/new-project-directives.md §2): clsx +
// tailwind-merge, so later Tailwind utilities win over earlier conflicting ones.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
