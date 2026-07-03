import { createServerFn } from "@tanstack/react-start";

import { impersonateStartSchema } from "./impersonation.shared.ts";

// Thin transports (§9.3); each impl stays behind the lazy-import seam.
export const impersonateStartFn = createServerFn({ method: "POST" })
  .validator(impersonateStartSchema)
  .handler(async ({ data }) => {
    const { impersonateStartHandler } = await import("./impersonation.impl.server.ts");
    return impersonateStartHandler(data);
  });

export const impersonateStopFn = createServerFn({ method: "POST" }).handler(async () => {
  const { impersonateStopHandler } = await import("./impersonation.impl.server.ts");
  return impersonateStopHandler();
});
