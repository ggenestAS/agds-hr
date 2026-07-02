import { describe, expect, test } from "bun:test";

import { buttonVariants } from "./button.tsx";
import { cardVariants } from "./card.tsx";

// Variants are the single source of look (§9.4); assert the cva outputs so a
// changed base/variant is a deliberate, reviewed edit.
describe("buttonVariants", () => {
  test("defaults to primary + md", () => {
    const cls = buttonVariants();
    expect(cls).toContain("bg-primary");
    expect(cls).toContain("h-11");
  });

  test("secondary and ghost drop the primary background", () => {
    expect(buttonVariants({ variant: "secondary" })).not.toContain("bg-primary");
    expect(buttonVariants({ variant: "ghost" })).toContain("hover:bg-muted");
  });

  test("size variants set height", () => {
    expect(buttonVariants({ size: "sm" })).toContain("h-9");
    expect(buttonVariants({ size: "icon" })).toContain("w-10");
  });
});

describe("cardVariants", () => {
  test("default uses the border + soft shadow, not the warning surface", () => {
    const cls = cardVariants();
    expect(cls).toContain("border-border");
    expect(cls).not.toContain("warning-surface");
  });

  test("warning variant swaps to the warning surface", () => {
    expect(cardVariants({ variant: "warning" })).toContain("var(--color-warning-surface)");
  });
});
