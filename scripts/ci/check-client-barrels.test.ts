import { describe, expect, test } from "bun:test";

import { findBarrelViolations, isClientScanned } from "./check-client-barrels.ts";

describe("isClientScanned", () => {
  test("scans components/routes/lib but not api, server, or impl files", () => {
    expect(isClientScanned("apps/web/src/routes/_app.dashboard.tsx")).toBe(true);
    expect(isClientScanned("apps/web/src/components/ui/button.tsx")).toBe(true);
    expect(isClientScanned("apps/web/src/lib/theme.ts")).toBe(true);
    expect(isClientScanned("apps/web/src/routes/api/auth.$.ts")).toBe(false);
    expect(isClientScanned("apps/web/src/server/session.impl.server.ts")).toBe(false);
    expect(isClientScanned("apps/web/src/server/policies.ts")).toBe(false);
    expect(isClientScanned("apps/web/src/router.tsx")).toBe(false);
  });
});

describe("findBarrelViolations", () => {
  test("flags a value import from a domain barrel", () => {
    const out = findBarrelViolations("f.tsx", `import { listUsers } from "@agds-hr/identity";`);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain("@agds-hr/identity");
  });

  test("allows import type from a domain barrel", () => {
    expect(
      findBarrelViolations("f.tsx", `import type { DirectoryUser } from "@agds-hr/identity";`),
    ).toHaveLength(0);
  });

  test("allows inline type-only named imports", () => {
    expect(
      findBarrelViolations("f.tsx", `import { type Session } from "@agds-hr/auth";`),
    ).toHaveLength(0);
  });

  test("flags a mixed import (one value binding is enough)", () => {
    expect(
      findBarrelViolations(
        "f.tsx",
        `import { type Session, resolveSession } from "@agds-hr/auth";`,
      ),
    ).toHaveLength(1);
  });

  test("allows value imports from a subpath", () => {
    expect(
      findBarrelViolations("f.tsx", `import { schema } from "@agds-hr/identity/db/schema";`),
    ).toHaveLength(0);
  });

  test("allows the allowlisted shared barrel", () => {
    expect(findBarrelViolations("f.tsx", `import { UserId } from "@agds-hr/shared";`)).toHaveLength(
      0,
    );
  });

  test("flags a default/namespace import from a domain barrel", () => {
    expect(findBarrelViolations("f.tsx", `import * as auth from "@agds-hr/auth";`)).toHaveLength(1);
  });
});
