import { createServerFn } from "@tanstack/react-start";

import { grantRoleSchema, revokeRoleSchema } from "./roles.shared.ts";

// Thin transports (§9.3); each impl stays behind the lazy-import seam.
export const rolesPageFn = createServerFn({ method: "GET" }).handler(async () => {
  const { rolesPageHandler } = await import("./roles.impl.server.ts");
  return rolesPageHandler();
});

export const grantRoleFn = createServerFn({ method: "POST" })
  .validator(grantRoleSchema)
  .handler(async ({ data }) => {
    const { grantRoleHandler } = await import("./roles.impl.server.ts");
    return grantRoleHandler(data);
  });

export const revokeRoleFn = createServerFn({ method: "POST" })
  .validator(revokeRoleSchema)
  .handler(async ({ data }) => {
    const { revokeRoleHandler } = await import("./roles.impl.server.ts");
    return revokeRoleHandler(data);
  });
